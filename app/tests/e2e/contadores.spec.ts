import type { APIRequestContext, Locator, Page } from '@playwright/test';
import { test, expect, openHand, openMatchRail, openQuickActions } from './fixtures';

async function expectLifeBesideName(table: Locator, life: number) {
  await expect(table).toBeVisible();
  if (await table.locator('.seat-heading').count()) {
    await expect(table.getByRole('heading', { name: /Amigo da mesa/ })).toBeVisible();
    await expect(table.getByRole('textbox', { name: 'Vida', exact: true })).toHaveValue(String(life));
    return;
  }
  const name = table.getByRole('heading', { name: /Amigo da mesa/ });
  const lifeLabel = table.getByLabel(`Vida: ${life}`, { exact: true });
  const identity = table.getByRole('button', { name: 'Abrir jogador Amigo da mesa', exact: true });
  const focus = table.getByRole('button', { name: /^(Ampliar mesa de Amigo da mesa|Voltar à visão geral)$/ });
  await expect(lifeLabel).toBeVisible();
  const [nameBox, lifeBox, identityBox, focusBox] = await Promise.all([name.boundingBox(), lifeLabel.boundingBox(), identity.boundingBox(), focus.boundingBox()]);
  expect(nameBox && lifeBox && identityBox && focusBox).toBeTruthy();
  const ownership = table.locator('.player-ownership');
  const beforeLife = (await ownership.count()) ? await ownership.boundingBox() : nameBox;
  expect(beforeLife).toBeTruthy();
  if (beforeLife !== nameBox) expect(beforeLife!.x - (nameBox!.x + nameBox!.width)).toBeLessThanOrEqual(20);
  expect(lifeBox!.x).toBeGreaterThanOrEqual(beforeLife!.x + beforeLife!.width - 1);
  expect(lifeBox!.x - (beforeLife!.x + beforeLife!.width)).toBeLessThanOrEqual(20);
  expect(Math.abs((lifeBox!.y + lifeBox!.height / 2) - (nameBox!.y + nameBox!.height / 2))).toBeLessThan(14);
  expect(lifeBox!.x).toBeGreaterThanOrEqual(identityBox!.x);
  expect(lifeBox!.x + lifeBox!.width).toBeLessThanOrEqual(identityBox!.x + identityBox!.width + 1);
  expect(focusBox!.x).toBeGreaterThanOrEqual(identityBox!.x + identityBox!.width - 1);
  expect(lifeBox!.x + lifeBox!.width).toBeLessThanOrEqual(focusBox!.x + 1);
}

test('vida, marcadores e modificador de carta pelo painel com mouse ou toque', async ({ page, browser, baseURL }, info) => {

  test.setTimeout(60_000);
  const api = page.request;
  expect((await api.post('/api/session', { data: { login: 'amigo', password: 'senha-do-navegador' } })).ok()).toBe(true);
  const upload = await api.post('/api/decks', { multipart: { file: { name: 'contadores.cod', mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck version="1"><deckname>Contadores</deckname><zone name="main"><card number="2" name="Island"/></zone></cockatrice_deck>') } } });
  expect(upload.status()).toBe(201);
  const { deck } = await upload.json();
  const { room } = await (await api.post('/api/rooms', { data: {} })).json();
  expect((await api.put(`/api/rooms/${room.id}/participants/me/ready`, { data: { deckId: deck.id } })).ok()).toBe(true);
  const observer = await browser.newContext({ baseURL, viewport: info.project.use.viewport, isMobile: info.project.use.isMobile, hasTouch: info.project.use.hasTouch });
  try {
    expect((await observer.request.post('/api/session', { data: { login: 'segundo', password: 'senha-do-navegador' } })).ok()).toBe(true);
    const otherDeck = await observer.request.post('/api/decks', { multipart: { file: { name: 'outro.cod', mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck version="1"><deckname>Outro</deckname><zone name="main"><card number="2" name="Island"/></zone></cockatrice_deck>') } } });
    expect(otherDeck.status()).toBe(201);
    const otherDeckID = (await otherDeck.json()).deck.id;
    expect((await observer.request.post(`/api/rooms/${room.id}/participants`, { data: {} })).ok()).toBe(true);
    expect((await observer.request.put(`/api/rooms/${room.id}/participants/me/ready`, { data: { deckId: otherDeckID } })).ok()).toBe(true);
    expect((await api.post(`/api/rooms/${room.id}/start`, { data: {} })).status()).toBe(201);
    expect((await api.delete(`/api/decks/${deck.id}`)).status()).toBe(204);
    expect((await observer.request.delete(`/api/decks/${otherDeckID}`)).status()).toBe(204);
    expect((await api.post(`/api/rooms/${room.id}/match/actions`, { data: { intentId: crypto.randomUUID(), kind: 'draw', count: 1 } })).ok()).toBe(true);
    await page.goto(`/#/salas/${room.id}`);
    const activate = async (locator: Locator) => {
      if (info.project.use.hasTouch) await locator.tap(); else await locator.click();
    };
    const press = (name: string) => activate(page.getByRole('button', { name, exact: true }));
    const lifeLog = async () => {
      const body = await (await api.get(`/api/rooms/${room.id}/match`)).json();
      return (body.match.log as { kind: string; result?: string }[]).filter(entry => entry.kind === 'counter' && entry.result?.startsWith('vida =')).map(entry => entry.result);
    };
    const expectLifeLog = async (results: string[]) => {
      await expect.poll(lifeLog).toEqual(results);
      await page.waitForTimeout(350);
      expect(await lifeLog()).toEqual(results);
    };
    const table = page.getByRole('article', { name: 'Mesa de Amigo da mesa', exact: true });
    await expectLifeBesideName(table, 40);
    const viewport = page.viewportSize();
    await page.setViewportSize({ width: 320, height: 568 });
    await expectLifeBesideName(table, 40);
    expect(await table.getByRole('heading', { name: /Amigo da mesa/ }).evaluate(node => {
      const life = node.parentElement?.querySelector('[aria-label^="Vida:"]');
      if (!(life instanceof HTMLElement)) return false;
      const original = node.innerHTML;
      node.textContent = 'Jogador com um nome muito longo para caber neste campo estreito';
      const nameBox = node.getBoundingClientRect();
      const lifeBox = life.getBoundingClientRect();
      const ownership = node.parentElement?.querySelector('.player-ownership');
      const beforeLife = ownership instanceof HTMLElement ? ownership.getBoundingClientRect() : nameBox;
      const fits = getComputedStyle(node).textOverflow === 'ellipsis'
        && node.scrollWidth > node.clientWidth + 1
        && beforeLife.left - nameBox.right <= 20
        && lifeBox.left >= beforeLife.right - 1
        && lifeBox.left - beforeLife.right <= 20
        && lifeBox.left >= 0
        && lifeBox.right <= window.innerWidth
        && lifeBox.width > 12;
      node.innerHTML = original;
      return fits;
    })).toBe(true);
    if (viewport) await page.setViewportSize(viewport);
    await table.getByRole('button', { name: 'Abrir jogador Amigo da mesa', exact: true }).click();
    const panel = page.getByRole('dialog', { name: 'Jogador Amigo da mesa' });
    await expect(panel.getByRole('button', { name: 'Vida', exact: true })).toHaveCount(0);
    await expect(panel.getByText('Vida', { exact: true })).toBeVisible();
    const life = panel.getByRole('textbox', { name: 'Vida', exact: true });
    await expect(life).toBeVisible();
    for (const control of [panel.getByRole('button', { name: 'Diminuir vida', exact: true }), panel.getByRole('button', { name: 'Aumentar vida', exact: true }), life]) {
      const box = await control.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    await life.fill('9');
    await page.waitForTimeout(1_300);
    await expect(life).toBeFocused();
    await expect(life).toHaveValue('9');
    await expect(table.getByLabel('Vida: 40', { exact: true })).toBeVisible();
    expect(await lifeLog()).toEqual([]);
    for (const invalid of ['-', '+', '1.5', '']) {
      await life.fill(invalid);
      await life.blur();
      await expect(life).toHaveValue('40');
    }
    await page.waitForTimeout(400);
    expect(await lifeLog()).toEqual([]);
    await life.fill('0');
    await life.press('Enter');
    await life.blur();
    await expect(table.getByLabel('Vida: 0', { exact: true })).toBeVisible();
    await expectLifeLog(['vida = 0']);
    await life.fill('0');
    await life.press('Enter');
    await life.blur();
    await expectLifeLog(['vida = 0']);
    await life.fill('-5');
    await life.blur();
    await expect(table.getByLabel('Vida: -5', { exact: true })).toBeVisible();
    await expectLifeLog(['vida = 0', 'vida = -5']);
    await activate(panel.getByRole('button', { name: 'Diminuir vida', exact: true }));
    await expect(table.getByLabel('Vida: -6', { exact: true })).toBeVisible();
    await expectLifeLog(['vida = 0', 'vida = -5', 'vida = -6']);
    await activate(panel.getByRole('button', { name: 'Aumentar vida', exact: true }));
    await expect(table.getByLabel('Vida: -5', { exact: true })).toBeVisible();
    await expectLifeLog(['vida = 0', 'vida = -5', 'vida = -6', 'vida = -5']);
    await life.fill('16');
    await press('Marcadores');
    const addRed = panel.getByRole('button', { name: 'Aumentar marcador vermelho', exact: true });
    await activate(addRed);
    await activate(addRed);
    await expect(table.getByLabel('marcador vermelho')).toHaveText('2');
    await expectLifeLog(['vida = 0', 'vida = -5', 'vida = -6', 'vida = -5', 'vida = 16']);
    await expect(table.getByLabel('Vida: 16', { exact: true })).toBeVisible();
    await press('Voltar');
    await expect(panel.getByRole('button', { name: 'Vida', exact: true })).toHaveCount(0);
    const restored = panel.getByRole('textbox', { name: 'Vida', exact: true });
    await expect(restored).toBeEnabled();
    await expect(restored).toHaveValue('16');
    await press('Fechar jogador');
    await openHand(page);
    await press('Island');
    const preview = page.getByRole('dialog', { name: 'Imagem de Island' });
    await expect(preview.getByRole('button', { name: 'Ajustes', exact: true })).toHaveCount(0);
    await preview.getByLabel('Poder', { exact: true }).fill('-1');
    await preview.getByLabel('Poder', { exact: true }).press('Enter');
    await expect(page.getByRole('region', { name: 'Mão', exact: true }).getByLabel('Poder e resistência')).toHaveCount(0);
    const toughnessAmount = preview.getByLabel('Resistência', { exact: true });
    await toughnessAmount.fill('4');
    await toughnessAmount.press('Enter');
    await page.waitForTimeout(1_300);
    await expect(toughnessAmount).toBeFocused();
    await expect(page.getByRole('region', { name: 'Mão', exact: true }).getByLabel('Poder e resistência')).toHaveCount(0);
    const otherPage = await observer.newPage();
    await otherPage.goto(`/#/salas/${room.id}`);
    if (info.project.use.hasTouch) {
      await openMatchRail(otherPage);
      await otherPage.getByRole('navigation', { name: 'Foco da mesa' }).getByRole('button', { name: /^Ver campo de Amigo da mesa$/ }).tap();
    }
    const otherTable = otherPage.getByRole('article', { name: 'Mesa de Amigo da mesa' });
    await expect(otherTable.getByLabel('Vida: 16', { exact: true })).toBeVisible();
    await expect(otherTable.getByLabel('marcador vermelho')).toHaveText('2');
    await otherTable.getByRole('button', { name: 'Abrir jogador Amigo da mesa', exact: true }).click();
    const readOnly = otherPage.getByRole('dialog', { name: 'Jogador Amigo da mesa' });
    await expect(readOnly.getByText('Somente leitura')).toBeVisible();
    await expect(readOnly.getByText('16', { exact: true })).toBeVisible();
    await expect(readOnly.getByRole('textbox', { name: 'Vida', exact: true })).toHaveCount(0);
    await expect(readOnly.getByRole('spinbutton')).toHaveCount(0);
    await expect(readOnly.getByRole('button', { name: 'Diminuir vida', exact: true })).toHaveCount(0);
    await expect(readOnly.getByRole('button', { name: 'Aumentar vida', exact: true })).toHaveCount(0);
    await expect(readOnly.getByRole('button', { name: 'Vida', exact: true })).toHaveCount(0);
    await expect(readOnly.getByLabel('marcador vermelho')).toHaveText('2');
    await readOnly.getByRole('button', { name: 'Fechar jogador' }).click();
    const view = (await (await api.get(`/api/rooms/${room.id}/match`)).json()).match;
    const own = view.players.find((player: { userId: number }) => player.userId === view.viewerId);
    expect((await observer.request.post(`/api/rooms/${room.id}/match/actions`, { data: { intentId: crypto.randomUUID(), kind: 'counter', target: 'card', cardId: own.hand[0].id, subject: 'power', operation: 'set', value: 99 } })).status()).toBe(409);
    await openQuickActions(otherPage);
    await otherPage.getByRole('button', { name: 'Ações', exact: true }).click();
    const otherPanel = otherPage.getByRole('dialog', { name: 'Ações do jogo' });
    await expect(otherPanel.getByRole('button', { name: 'Vida', exact: true })).toHaveCount(0);
    await expect(otherPanel.getByRole('button', { name: 'Marcadores', exact: true })).toHaveCount(0);
    await expect(otherPage.getByText('-1/+4', { exact: true })).toHaveCount(0);
    await page.reload();
    await openHand(page);
    await expect(table.getByLabel('Vida: 16', { exact: true })).toBeVisible();
    await expect(table.getByLabel('marcador vermelho')).toHaveText('2');
    await expect(page.getByRole('region', { name: 'Mão', exact: true }).getByLabel('Poder e resistência')).toHaveCount(0);
  } finally { await observer.close(); }
});

const deckFile = {
  name: 'par.cod',
  mimeType: 'application/xml',
  buffer: Buffer.from('<cockatrice_deck version="1"><deckname>Par</deckname><zone name="main"><card number="2" name="Island"/></zone></cockatrice_deck>'),
};

async function islandStats(request: APIRequestContext, roomId: number) {
  const match = (await (await request.get(`/api/rooms/${roomId}/match`)).json()).match;
  const player = match.players.find((item: { userId: number }) => item.userId === match.viewerId);
  const card = [...player.hand ?? [], ...player.battlefield ?? []].find((item: { name: string }) => item.name === 'Island');
  const changes = (match.log as { kind: string; result?: string }[]).filter(entry => entry.kind === 'counter' && entry.result === 'contador de carta alterado').length;
  return { power: card?.power ?? 0, toughness: card?.toughness ?? 0, changes, id: card?.id as string };
}

async function prepareIsland(page: Page, partner?: APIRequestContext) {
  const api = page.request;
  expect((await api.post('/api/session', { data: { login: 'amigo', password: 'senha-do-navegador' } })).ok()).toBe(true);
  const upload = await api.post('/api/decks', { multipart: { file: deckFile } });
  expect(upload.status()).toBe(201);
  const deckId = (await upload.json()).deck.id;
  const { room } = await (await api.post('/api/rooms', { data: {} })).json();
  expect((await api.put(`/api/rooms/${room.id}/participants/me/ready`, { data: { deckId } })).ok()).toBe(true);
  if (partner) {
    expect((await partner.post('/api/session', { data: { login: 'segundo', password: 'senha-do-navegador' } })).ok()).toBe(true);
    const otherUpload = await partner.post('/api/decks', { multipart: { file: { ...deckFile, name: 'outro-par.cod' } } });
    expect(otherUpload.status()).toBe(201);
    const otherDeckId = (await otherUpload.json()).deck.id;
    expect((await partner.post(`/api/rooms/${room.id}/participants`, { data: {} })).ok()).toBe(true);
    expect((await partner.put(`/api/rooms/${room.id}/participants/me/ready`, { data: { deckId: otherDeckId } })).ok()).toBe(true);
    expect((await api.post(`/api/rooms/${room.id}/start`, { data: {} })).status()).toBe(201);
    expect((await partner.delete(`/api/decks/${otherDeckId}`)).status()).toBe(204);
  } else expect((await api.post(`/api/rooms/${room.id}/start`, { data: {} })).status()).toBe(201);
  expect((await api.delete(`/api/decks/${deckId}`)).status()).toBe(204);
  expect((await api.post(`/api/rooms/${room.id}/match/actions`, { data: { intentId: crypto.randomUUID(), kind: 'draw', count: 1 } })).ok()).toBe(true);
  await page.goto(`/#/salas/${room.id}`);
  await openHand(page);
  await page.getByRole('region', { name: 'Mão', exact: true }).getByRole('button', { name: 'Island', exact: true }).click();
  const preview = page.getByRole('dialog', { name: 'Imagem de Island' });
  await expect(preview).toBeVisible();
  return { roomId: room.id as number, api, preview };
}

test('edita poder e resistência direto no detalhe, em par e com permissão', async ({ page, browser, baseURL }, info) => {
  test.setTimeout(90_000);
  const observer = await browser.newContext({ baseURL, viewport: info.project.use.viewport, isMobile: info.project.use.isMobile, hasTouch: info.project.use.hasTouch });
  try {
    const { roomId, api, preview } = await prepareIsland(page, observer.request);
    const read = () => islandStats(api, roomId);
    const power = preview.getByLabel('Poder', { exact: true });
    const toughness = preview.getByLabel('Resistência', { exact: true });
    const minus = preview.getByRole('button', { name: 'Diminuir poder e resistência', exact: true });
    const plus = preview.getByRole('button', { name: 'Aumentar poder e resistência', exact: true });
    await expect(preview.getByRole('button', { name: 'Ajustes', exact: true })).toHaveCount(0);
    await expect(preview.getByRole('button', { name: 'Marcadores', exact: true })).toBeVisible();
    await expect(power).toHaveCount(1);
    await expect(toughness).toHaveCount(1);
    await expect(preview.getByRole('button', { name: 'Diminuir Poder', exact: true })).toHaveCount(0);
    await expect(preview.getByRole('button', { name: 'Aumentar Poder', exact: true })).toHaveCount(0);
    await expect(preview.getByRole('button', { name: 'Diminuir Resistência', exact: true })).toHaveCount(0);
    await expect(preview.getByRole('button', { name: 'Aumentar Resistência', exact: true })).toHaveCount(0);
    const viewport = page.viewportSize();
    await page.setViewportSize({ width: 320, height: 568 });
    await plus.scrollIntoViewIfNeeded();
    const dialog = (await preview.boundingBox())!;
    const boxes = await Promise.all([minus, power, toughness, plus].map(async control => (await control.boundingBox())!));
    for (const box of boxes) {
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(dialog.x - 1);
      expect(box.x + box.width).toBeLessThanOrEqual(dialog.x + dialog.width + 1);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(568);
    }
    expect(boxes[0].x).toBeLessThan(boxes[1].x);
    expect(boxes[1].x).toBeLessThan(boxes[2].x);
    expect(boxes[2].x).toBeLessThan(boxes[3].x);
    expect(Math.abs((boxes[0].y + boxes[0].height / 2) - (boxes[3].y + boxes[3].height / 2))).toBeLessThan(8);
    if (viewport) await page.setViewportSize(viewport);

    await power.fill('9');
    await page.waitForTimeout(1_300);
    await expect(power).toBeFocused();
    await expect(power).toHaveValue('9');
    expect(await read()).toMatchObject({ power: 0, toughness: 0, changes: 0 });
    for (const invalid of ['1.5', '', '-', '+']) {
      await power.fill(invalid);
      await power.blur();
      await expect(power).toHaveValue('0');
    }
    await page.waitForTimeout(400);
    expect(await read()).toMatchObject({ power: 0, toughness: 0, changes: 0 });
    await power.fill('-1');
    await power.press('Enter');
    await power.blur();
    await expect.poll(read).toMatchObject({ power: -1, toughness: 0, changes: 1 });
    await power.fill('-1');
    await power.press('Enter');
    await power.blur();
    await page.waitForTimeout(400);
    expect(await read()).toMatchObject({ power: -1, changes: 1 });
    await toughness.fill('4');
    await toughness.blur();
    await expect.poll(read).toMatchObject({ power: -1, toughness: 4, changes: 2 });
    await expect(page.getByRole('region', { name: 'Mão', exact: true }).getByLabel('Poder e resistência')).toHaveCount(0);

    await power.fill('2');
    await power.press('Enter');
    await toughness.fill('-1');
    await toughness.blur();
    await expect.poll(read).toMatchObject({ power: 2, toughness: -1, changes: 4 });
    const activate = async (locator: Locator) => { if (info.project.use.hasTouch) await locator.tap(); else await locator.click(); };
    await activate(plus);
    await expect.poll(read).toMatchObject({ power: 3, toughness: 0, changes: 6 });
    await expect(page.getByRole('region', { name: 'Mão', exact: true }).getByLabel('Poder e resistência')).toHaveCount(0);
    await activate(minus);
    await expect.poll(read).toMatchObject({ power: 2, toughness: -1, changes: 8 });
    await power.fill('0');
    await power.press('Enter');
    await toughness.fill('0');
    await toughness.blur();
    await expect.poll(read).toMatchObject({ power: 0, toughness: 0, changes: 10 });
    await activate(plus);
    await expect.poll(read).toMatchObject({ power: 1, toughness: 1, changes: 12 });
    await activate(minus);
    await expect.poll(read).toMatchObject({ power: 0, toughness: 0, changes: 14 });
    await power.fill(String(Number.MAX_SAFE_INTEGER));
    await power.press('Enter');
    await expect.poll(read).toMatchObject({ power: Number.MAX_SAFE_INTEGER, toughness: 0 });
    await power.fill(String(Number.MAX_SAFE_INTEGER + 1));
    await power.blur();
    await expect(power).toHaveValue(String(Number.MAX_SAFE_INTEGER));
    await page.waitForTimeout(400);
    expect((await read()).power).toBe(Number.MAX_SAFE_INTEGER);
    await power.fill('2');
    await power.press('Enter');
    await toughness.fill('-1');
    await toughness.blur();
    await expect.poll(read).toMatchObject({ power: 2, toughness: -1 });

    await page.reload();
    await openHand(page);
    await page.getByRole('region', { name: 'Mão', exact: true }).getByRole('button', { name: 'Island', exact: true }).click();
    const restored = page.getByRole('dialog', { name: 'Imagem de Island' });
    await expect(restored.getByLabel('Poder', { exact: true })).toHaveValue('2');
    await expect(restored.getByLabel('Resistência', { exact: true })).toHaveValue('-1');
    await expect(page.getByRole('region', { name: 'Mão', exact: true }).getByLabel('Poder e resistência')).toHaveCount(0);
    await restored.getByRole('button', { name: 'Mover para…', exact: true }).click();
    await restored.getByRole('button', { name: 'Campo', exact: true }).click();
    await expect.poll(async () => (await read()).power).toBe(2);

    const otherPage = await observer.newPage();
    await otherPage.goto(`/#/salas/${roomId}`);
    if (info.project.use.hasTouch) {
      await openMatchRail(otherPage);
      await otherPage.getByRole('navigation', { name: 'Foco da mesa' }).getByRole('button', { name: /^Ver campo de Amigo da mesa$/ }).tap();
    }
    const otherTable = otherPage.getByRole('article', { name: 'Mesa de Amigo da mesa' });
    await expect(otherTable.getByLabel('Poder e resistência')).toHaveCount(0);
    await otherTable.getByRole('button', { name: 'Island', exact: true }).click();
    const readOnly = otherPage.getByRole('dialog', { name: 'Imagem de Island' });
    await expect(readOnly.getByLabel('Poder', { exact: true })).toHaveCount(0);
    await expect(readOnly.getByLabel('Resistência', { exact: true })).toHaveCount(0);
    await expect(readOnly.getByRole('button', { name: 'Aumentar poder e resistência', exact: true })).toHaveCount(0);
    await expect(readOnly.getByRole('button', { name: 'Diminuir poder e resistência', exact: true })).toHaveCount(0);
    const island = await read();
    expect((await observer.request.post(`/api/rooms/${roomId}/match/actions`, { data: { intentId: crypto.randomUUID(), kind: 'counter', target: 'card', cardId: island.id, subject: 'power', operation: 'set', value: 99 } })).status()).toBe(409);
    expect(await read()).toMatchObject({ power: 2, toughness: -1 });
  } finally { await observer.close(); }
});

test('falha parcial de resistência não repete o poder já confirmado', async ({ page }) => {
  test.setTimeout(60_000);
  const { roomId, api, preview } = await prepareIsland(page);
  const read = () => islandStats(api, roomId);
  const seen: { subject: string; intentId: string }[] = [];
  let failToughness = true;
  await page.route('**/match/actions', async route => {
    const body = route.request().postDataJSON() as { kind?: string; subject?: string; intentId?: string };
    if (body.kind === 'counter' && (body.subject === 'power' || body.subject === 'toughness')) {
      seen.push({ subject: body.subject, intentId: body.intentId ?? '' });
      if (failToughness && body.subject === 'toughness') {
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'falha controlada da resistência' }) });
        return;
      }
    }
    await route.continue();
  });
  await preview.getByRole('button', { name: 'Aumentar poder e resistência', exact: true }).click();
  await expect(preview.getByText('Poder confirmado. Resistência ficou pendente.')).toBeVisible();
  await expect.poll(read).toMatchObject({ power: 1, toughness: 0, changes: 1 });
  expect(seen.map(item => item.subject)).toEqual(['power', 'toughness']);
  await expect(preview.getByRole('button', { name: 'Tentar novamente', exact: true })).toHaveCount(0);
  failToughness = false;
  await preview.getByRole('button', { name: 'Aumentar poder e resistência', exact: true }).click();
  await expect.poll(read).toMatchObject({ power: 1, toughness: 1, changes: 2 });
  expect(seen.map(item => item.subject)).toEqual(['power', 'toughness', 'toughness']);
  await expect(preview.getByText('Poder confirmado. Resistência ficou pendente.')).toHaveCount(0);
});

test('confirmação incerta reenvia só a etapa pendente do par', async ({ page }) => {
  test.setTimeout(60_000);
  const { roomId, api, preview } = await prepareIsland(page);
  const read = () => islandStats(api, roomId);
  const seen: { subject: string; intentId: string }[] = [];
  let failToughness = true;
  await page.route('**/match/actions', async route => {
    const body = route.request().postDataJSON() as { kind?: string; subject?: string; intentId?: string };
    if (body.kind === 'counter' && (body.subject === 'power' || body.subject === 'toughness')) {
      seen.push({ subject: body.subject, intentId: body.intentId ?? '' });
      if (failToughness && body.subject === 'toughness') {
        await route.abort('failed');
        return;
      }
    }
    await route.continue();
  });
  const plus = preview.getByRole('button', { name: 'Aumentar poder e resistência', exact: true });
  await plus.click();
  await expect(preview.getByText('Poder confirmado. Resistência ficou pendente.')).toBeVisible();
  await expect(preview.getByRole('alert').filter({ hasText: 'Não foi possível confirmar' })).toBeVisible();
  await expect.poll(read).toMatchObject({ power: 1, toughness: 0, changes: 1 });
  expect(seen.filter(item => item.subject === 'power').map(item => item.intentId)).toHaveLength(1);
  const toughnessIntents = () => seen.filter(item => item.subject === 'toughness').map(item => item.intentId);
  expect(toughnessIntents()).toHaveLength(2);
  expect(new Set(toughnessIntents()).size).toBe(1);
  const sent = seen.length;
  await plus.click({ force: true });
  await page.waitForTimeout(300);
  expect(seen).toHaveLength(sent);
  expect((await read()).power).toBe(1);
  failToughness = false;
  await preview.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect.poll(read).toMatchObject({ power: 1, toughness: 1, changes: 2 });
  expect(seen.filter(item => item.subject === 'power')).toHaveLength(1);
  expect(new Set(toughnessIntents()).size).toBe(1);
  expect(toughnessIntents().length).toBe(3);

  await preview.getByRole('button', { name: 'Fechar', exact: true }).click();
  await expect(preview).toHaveCount(0);
  let failPower = true;
  await page.unroute('**/match/actions');
  const retried: { subject: string; intentId: string }[] = [];
  await page.route('**/match/actions', async route => {
    const body = route.request().postDataJSON() as { kind?: string; subject?: string; intentId?: string };
    if (body.kind === 'counter' && (body.subject === 'power' || body.subject === 'toughness')) {
      retried.push({ subject: body.subject, intentId: body.intentId ?? '' });
      if (failPower && body.subject === 'power') {
        await route.abort('failed');
        return;
      }
    }
    await route.continue();
  });
  await openHand(page);
  await page.getByRole('region', { name: 'Mão', exact: true }).getByRole('button', { name: 'Island', exact: true }).click();
  const fieldPreview = page.getByRole('dialog', { name: 'Imagem de Island' });
  await fieldPreview.getByRole('button', { name: 'Aumentar poder e resistência', exact: true }).click();
  await expect(fieldPreview.getByRole('alert')).toContainText('Não foi possível confirmar');
  await expect(fieldPreview.getByText('Poder confirmado. Resistência ficou pendente.')).toHaveCount(0);
  expect(retried.map(item => item.subject)).toEqual(['power', 'power']);
  expect((await read()).power).toBe(1);
  failPower = false;
  await fieldPreview.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect.poll(read).toMatchObject({ power: 2, toughness: 1 });
  expect(retried.filter(item => item.subject === 'toughness')).toEqual([]);
  expect(new Set(retried.map(item => item.intentId)).size).toBe(1);
});
