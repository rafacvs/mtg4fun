import { randomUUID } from 'node:crypto';
import { test, expect, returnOpeningHandToLibrary } from './fixtures';
import type { Browser, Page, APIRequestContext } from '@playwright/test';

async function prepare(page: Page, browser: Browser, baseURL?: string) {
  let roomId = 0;
  for (const login of ['amigo', 'segundo', 'amigo3', 'amigo4']) {
    const context = login === 'amigo' ? null : await browser.newContext({ baseURL });
    const api: APIRequestContext = context?.request ?? page.request;
    try {
      expect((await api.post('/api/session', { data: { login, password: 'senha-do-navegador' } })).ok()).toBe(true);
      const { deck } = await (await api.post('/api/decks', { multipart: { file: { name: 'mobile48.cod', mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck><zone name="main"><card number="20" name="Island"/></zone></cockatrice_deck>') } } })).json();
      if (!roomId) roomId = (await (await api.post('/api/rooms', { data: {} })).json()).room.id;
      else expect((await api.post(`/api/rooms/${roomId}/participants`, { data: {} })).ok()).toBe(true);
      expect((await api.put(`/api/rooms/${roomId}/participants/me/ready`, { data: { deckId: deck.id } })).ok()).toBe(true);
    } finally { await context?.close(); }
  }
  const path = `/api/rooms/${roomId}/match`;
  expect((await page.request.post(`/api/rooms/${roomId}/start`, { data: {} })).ok()).toBe(true);
  await returnOpeningHandToLibrary(page.request, roomId);
  const act = async (data: object) => {
    const response = await page.request.post(`${path}/actions`, { data: { intentId: randomUUID(), ...data } });
    expect(response.ok()).toBe(true);
    return (await response.json()).match;
  };
  const opponent = await browser.newContext({ baseURL });
  try {
    expect((await opponent.request.post('/api/session', { data: { login: 'segundo', password: 'senha-do-navegador' } })).ok()).toBe(true);
    expect((await opponent.request.post(`${path}/actions`, { data: { kind: 'create-token', intentId: randomUUID(), tokenName: 'Soldier Token' } })).ok()).toBe(true);
  } finally { await opponent.close(); }
  await act({ kind: 'draw', count: 3 });
  await act({ kind: 'create-token', tokenName: 'Soldier Token' });
  // Artwork alone is controlled. Actions, persistence and sessions use the real API.
  await page.route('**/api/cards/image?*', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 63 88"><rect width="63" height="88" fill="#8daebf"/><text x="4" y="12" font-size="7">Island</text></svg>' }));
  await page.goto(`/#/salas/${roomId}`);
  return { path, act };
}

test('celular horizontal mostra oponentes, campo e comandos próprios sem perder a mão', async ({ page, browser, baseURL }, info) => {
  test.skip(info.project.name !== 'celular-horizontal', 'Composição de jogo horizontal.');
  test.setTimeout(90_000);
  const { path } = await prepare(page, browser, baseURL);
  const opponents = page.getByRole('region', { name: 'Oponentes', exact: true });
  await expect(opponents).toBeVisible();
  await expect(opponents.getByRole('article')).toHaveCount(3);
  await expect(opponents.getByRole('button', { name: 'Soldier Token', exact: true })).toBeInViewport({ ratio: 1 });
  const own = page.getByRole('article', { name: 'Mesa de Amigo da mesa', exact: true });
  const field = own.getByRole('region', { name: 'Campo', exact: true });
  const controls = page.getByRole('region', { name: 'Seus comandos', exact: true });
  await expect(field.getByRole('button', { name: 'Soldier Token', exact: true })).toBeInViewport();
  await expect(own.getByRole('textbox', { name: 'Vida', exact: true })).toBeVisible();
  for (const zone of ['Grimório', 'Cemitério', 'Exílio', 'Comando']) await expect(own.getByRole('region', { name: zone, exact: true })).toBeVisible();
  const left = (await opponents.boundingBox())!, center = (await field.boundingBox())!, right = (await controls.boundingBox())!;
  expect(left.x + left.width).toBeLessThanOrEqual(center.x + 2);
  expect(center.x + center.width).toBeLessThanOrEqual(right.x + 2);
  const hand = page.getByRole('region', { name: 'Mão', exact: true });
  await expect(hand.getByRole('button', { name: 'Island', exact: true })).toHaveCount(3);
  await expect(hand.getByRole('button', { name: 'Island', exact: true }).first()).toBeInViewport();
  await controls.getByRole('button', { name: 'Comprar', exact: true }).tap();
  await expect(hand.getByRole('button', { name: 'Island', exact: true })).toHaveCount(4);
  const previousTurn = (await (await page.request.get(path)).json()).match.currentTurn.userId;
  await controls.getByRole('button', { name: 'Passar a vez', exact: true }).tap();
  await expect.poll(async () => (await (await page.request.get(path)).json()).match.currentTurn.userId).not.toBe(previousTurn);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('horizontal48.png') });
});

test('vertical oferece mão e leitura, barra rotulada e mantém a sessão ao girar', async ({ page, browser, baseURL }, info) => {
  test.skip(info.project.name !== 'celular', 'Leitura vertical e mudança de orientação.');
  test.setTimeout(90_000);
  const { path, act } = await prepare(page, browser, baseURL);
  await expect(page.getByText('Gire o aparelho para jogar o campo', { exact: true })).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Controles da mesa', exact: true });
  for (const label of ['Mão', 'Comprar', 'Desvirar', 'Passar a vez', 'Mais']) {
    const button = nav.getByRole('button', { name: label, exact: true });
    await expect(button).toBeVisible();
    expect(await button.innerText()).toContain(label);
    const box = (await button.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  const hand = page.getByRole('region', { name: 'Mão', exact: true });
  const cards = hand.getByRole('button', { name: 'Island', exact: true });
  const ids = await cards.evaluateAll(nodes => nodes.map(node => node.getAttribute('data-card-id')));
  await cards.first().tap();
  const preview = page.getByRole('dialog', { name: 'Imagem de Island', exact: true });
  await expect(preview).toBeVisible();
  await expect(preview.getByRole('img', { name: 'Imagem ampliada de Island', exact: true })).toBeVisible();
  const play = preview.getByRole('button', { name: 'Jogar no campo', exact: true });
  await expect(play).toBeVisible();
  expect((await play.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await play.tap();
  await expect(cards).toHaveCount(2);
  await preview.getByRole('button', { name: 'Fechar', exact: true }).tap();
  await nav.getByRole('button', { name: 'Comprar', exact: true }).tap();
  await expect(cards).toHaveCount(3);
  await hand.getByRole('button', { name: 'Organizar', exact: true }).tap();
  await expect(hand).toHaveClass(/is-organizing/);
  const before = (await (await page.request.get(path)).json()).match;
  const sameDocument = await page.evaluate(() => { (window as Window & { orientationCheck?: string }).orientationCheck = 'same'; return location.href; });
  await page.setViewportSize({ width: 839, height: 393 });
  await expect(page.getByText('Gire o aparelho para jogar o campo', { exact: true })).toBeHidden();
  await expect(hand).not.toHaveClass(/is-organizing/);
  await expect(hand).toBeVisible();
  await expect(cards).toHaveCount(3);
  expect(await page.evaluate(() => (window as Window & { orientationCheck?: string }).orientationCheck)).toBe('same');
  expect(page.url()).toBe(sameDocument);
  const fieldCard = page.locator(`[data-battlefield-canvas] [data-card-id="${ids[0]}"]`);
  await expect(fieldCard).toBeVisible();
  await act({ kind: 'set_tapped', cardIds: [ids[0]], tapped: true });
  await expect(fieldCard).toHaveAttribute('data-tapped', 'true');
  const current = (await (await page.request.get(path)).json()).match;
  expect(current.viewerId).toBe(before.viewerId);
  expect(current.players.find((player: { userId: number }) => player.userId === current.viewerId).hand.map((card: { id: string }) => card.id)).toEqual(before.players.find((player: { userId: number }) => player.userId === before.viewerId).hand.map((card: { id: string }) => card.id));
  await page.setViewportSize({ width: 393, height: 839 });
  await expect(cards).toHaveCount(3);
  await expect(page.getByText('Gire o aparelho para jogar o campo', { exact: true })).toBeVisible();
  await nav.getByRole('button', { name: 'Mais', exact: true }).tap();
  await page.getByRole('button', { name: 'Informações', exact: true }).tap();
  await page.getByRole('button', { name: 'Registro', exact: true }).tap();
  await expect(page.getByRole('group', { name: 'Filtrar registro', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('vertical48.png') });
});

test('toque seleciona várias cartas e a mão horizontal é um leque navegável', async ({ page, browser, baseURL }, info) => {
  test.skip(info.project.name === 'desktop', 'Toque e composição móvel.');
  test.setTimeout(90_000);
  const { path } = await prepare(page, browser, baseURL);
  const hand = page.getByRole('region', { name: 'Mão', exact: true });
  const cards = hand.getByRole('button', { name: 'Island', exact: true });
  await page.getByRole('button', { name: 'Selecionar', exact: true }).tap();
  await cards.nth(0).tap();
  await cards.nth(1).tap();
  await expect(hand.locator('[aria-pressed="true"]')).toHaveCount(2);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const bar = page.getByRole('toolbar', { name: 'Ações da seleção', exact: true });
  await bar.getByRole('button', { name: 'Jogar no campo', exact: true }).tap();
  await expect(cards).toHaveCount(1);
  await expect.poll(async () => (await (await page.request.get(path)).json()).match.players[0].battlefieldCount).toBe(3);
  if (info.project.name === 'celular') await page.setViewportSize({ width: 839, height: 393 });
  const field = page.locator('.own-table-surface [data-battlefield-canvas]');
  await expect(field.locator('[aria-pressed="true"]')).toHaveCount(2);
  await bar.getByRole('button', { name: 'Virar', exact: true }).tap();
  await expect(field.locator('[aria-pressed="true"][data-tapped="true"]')).toHaveCount(2);
  const draw = page.getByRole('region', { name: 'Seus comandos', exact: true }).getByRole('button', { name: 'Comprar', exact: true });
  await draw.tap();
  await expect(cards).toHaveCount(2);
  const firstAngle = await cards.first().evaluate(node => getComputedStyle(node).rotate);
  const lastAngle = await cards.last().evaluate(node => getComputedStyle(node).rotate);
  expect(firstAngle).not.toBe(lastAngle);
  for (const button of await page.getByRole('navigation', { name: 'Controles da mesa', exact: true }).getByRole('button').all()) {
    const box = (await button.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1);
  }
});
