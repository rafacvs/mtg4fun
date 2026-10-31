import { test, expect, openLibrary, roomBody } from './fixtures';
import type { APIRequestContext, Browser, Page } from '@playwright/test';
import type { Match } from '../../src/features/rooms/roomsApi';

const islands = '<cockatrice_deck><zone name="main"><card number="20" name="Island"/></zone></cockatrice_deck>';

async function login(api: APIRequestContext, user: string) {
  expect((await api.post('/api/session', { data: { login: user, password: 'senha-do-navegador' } })).ok()).toBe(true);
}

async function uploadDeck(api: APIRequestContext, content = islands) {
  const upload = await api.post('/api/decks', { multipart: { file: { name: 'deck.cod', mimeType: 'application/xml', buffer: Buffer.from(content) } } });
  expect(upload.status()).toBe(201);
  return (await upload.json()).deck.id as number;
}

async function soloMatch(page: Page, content = islands) {
  const api = page.request;
  await login(api, 'amigo');
  const deckId = await uploadDeck(api, content);
  const { room } = await (await api.post('/api/rooms', { data: roomBody() })).json();
  expect((await api.put(`/api/rooms/${room.id}/participants/me/ready`, { data: { deckId } })).ok()).toBe(true);
  expect((await api.post(`/api/rooms/${room.id}/start`, { data: {} })).status()).toBe(201);
  return room.id as number;
}

async function duoMatch(page: Page, browser: Browser, baseURL?: string) {
  const other = await browser.newContext({ baseURL });
  await login(page.request, 'amigo');
  await login(other.request, 'segundo');
  const { room } = await (await page.request.post('/api/rooms', { data: roomBody() })).json();
  expect((await other.request.post(`/api/rooms/${room.id}/participants`, { data: {} })).ok()).toBe(true);
  for (const api of [page.request, other.request]) {
    const deckId = await uploadDeck(api);
    expect((await api.put(`/api/rooms/${room.id}/participants/me/ready`, { data: { deckId } })).ok()).toBe(true);
  }
  expect((await page.request.post(`/api/rooms/${room.id}/start`, { data: {} })).status()).toBe(201);
  return { roomId: room.id as number, other };
}

test('a mesa só libera as ações quando todos confirmam a mão', async ({ page, browser, baseURL }, info) => {
  test.setTimeout(60_000);
  const { roomId, other } = await duoMatch(page, browser, baseURL);
  try {
    await page.goto(`/#/salas/${roomId}`);
    const hand = page.getByRole('navigation', { name: 'Confirmação da mão', exact: true });
    const mulligan = hand.getByRole('button', { name: 'Mulligan', exact: true });
    const confirm = hand.getByRole('button', { name: 'Confirmar mão', exact: true });
    await expect(confirm).toBeVisible();
    await expect(mulligan).toBeVisible();
    expect((await mulligan.boundingBox())!.x).toBeLessThan((await confirm.boundingBox())!.x);
    await expect(hand.getByRole('status')).toContainText('Segundo amigo');
    for (const name of ['Comprar', 'Desvirar', 'Ações', 'Passar turno', 'Comandos', 'Abrir crônica', 'Passar a vez']) await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
    await page.screenshot({ path: info.outputPath('antes-de-confirmar.png') });

    // Mulligan manual: o grimório continua acessível para quem não confirmou.
    await page.locator('.library-open').first().click();
    await expect(page.getByRole('dialog', { name: /grimório/i })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: /grimório/i })).toHaveCount(0);

    await confirm.click();
    const undo = hand.getByRole('button', { name: 'Desconfirmar mão', exact: true });
    await expect(undo).toBeVisible();
    await expect(mulligan).toHaveCount(0);
    await undo.click();
    await expect(confirm).toBeVisible();
    await expect(mulligan).toBeVisible();
    await expect(page.locator('.own-dock .playing-card, .own-dock [data-card-id]').first()).toBeVisible();
    await confirm.click();
    await expect(undo).toBeVisible();

    const refused = await other.request.post(`/api/rooms/${roomId}/match/actions`, { data: { intentId: crypto.randomUUID(), kind: 'turn', direction: 'next' } });
    expect(refused.status()).toBe(409);
    expect((await other.request.post(`/api/rooms/${roomId}/match/actions`, { data: { intentId: crypto.randomUUID(), kind: 'keep_hand', cardIds: [] } })).ok()).toBe(true);

    await expect(hand).toHaveCount(0);
    if (info.project.use.hasTouch) await expect(page.getByRole('button', { name: 'Comandos', exact: true })).toBeVisible();
    else {
      await expect(page.getByRole('button', { name: 'Comprar', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Passar turno', exact: true })).toBeVisible();
    }
    await page.screenshot({ path: info.outputPath('depois-de-confirmar.png') });
  } finally { await other.close(); }
});

test('a inspeção cria a quantidade de fichas pedida', async ({ page }, info) => {
  test.setTimeout(60_000);
  const roomId = await soloMatch(page, '<cockatrice_deck><zone name="main"><card number="1" name="Mabel, Heir to Cragflame"/></zone></cockatrice_deck>');
  expect((await page.request.post(`/api/rooms/${roomId}/match/actions`, { data: { intentId: crypto.randomUUID(), kind: 'keep_hand', cardIds: [] } })).ok()).toBe(true);
  await page.goto(`/#/salas/${roomId}`);
  const click = (locator: ReturnType<Page['locator']>) => info.project.use.hasTouch ? locator.tap() : locator.click();
  await click(page.locator('.playing-card[aria-label="Mabel, Heir to Cragflame"]'));
  const preview = page.getByRole('dialog', { name: 'Imagem de Mabel, Heir to Cragflame' });
  const quantity = preview.getByLabel('Quantidade de fichas: Cragflame');
  await expect(quantity).toHaveValue('1');
  const create = preview.getByRole('button', { name: 'Criar ficha feita pela carta: Cragflame' });
  await quantity.fill('0');
  await expect(create).toBeDisabled();
  await quantity.fill('5');
  await page.screenshot({ path: info.outputPath('quantidade-de-fichas.png') });
  await click(create);
  await expect(page.locator('.playing-card[aria-label="Cragflame"]')).toHaveCount(5);
});

test('soltar mais de três cartas no campo abre as pilhas necessárias', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'Seleção por retângulo e arraste usam mouse');
  test.setTimeout(60_000);
  const roomId = await soloMatch(page, '<cockatrice_deck><zone name="main"><card number="5" name="Island"/></zone></cockatrice_deck>');
  expect((await page.request.post(`/api/rooms/${roomId}/match/actions`, { data: { intentId: crypto.randomUUID(), kind: 'keep_hand', cardIds: [] } })).ok()).toBe(true);
  await page.setViewportSize({ width: 1312, height: 825 });
  await page.goto(`/#/salas/${roomId}`);
  const hand = page.getByRole('region', { name: 'Mão', exact: true });
  const cards = hand.getByRole('button', { name: 'Island', exact: true });
  await expect(cards).toHaveCount(5);
  const canvas = hand.getByLabel('Cartas da mão');
  const empty = await canvas.evaluate(element => {
    const box = element.getBoundingClientRect();
    for (let x = box.right - 2; x > box.left; x -= 4) for (let y = box.top + 2; y < box.bottom; y += 4) {
      const target = document.elementFromPoint(x, y);
      if (target && element.contains(target) && !target.closest('.playing-card')) return { x, y };
    }
    return null;
  });
  expect(empty).not.toBeNull();
  const first = (await cards.first().boundingBox())!;
  await page.mouse.move(empty!.x, empty!.y);
  await page.mouse.down();
  await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(hand.getByRole('button', { pressed: true })).toHaveCount(5);

  const start = (await cards.nth(2).boundingBox())!;
  const field = (await page.getByRole('article', { name: 'Mesa de Amigo da mesa' }).locator('[data-battlefield-canvas]').boundingBox())!;
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(field.x + 60, field.y + 60, { steps: 10 });
  await page.mouse.up();

  await expect(page.locator('.match-board [role="alert"]')).toHaveCount(0);
  await expect(hand.getByRole('button', { name: 'Island', exact: true })).toHaveCount(0);
  const { match } = await (await page.request.get(`/api/rooms/${roomId}/match`)).json() as { match: Match };
  const field2 = match.players[0].battlefield!;
  expect(field2).toHaveLength(5);
  const sizes = [...new Set(field2.map(card => `${card.row}:${card.positionX}`))].map(cell => field2.filter(card => `${card.row}:${card.positionX}` === cell).length).sort();
  expect(sizes).toEqual([2, 3]);
});
