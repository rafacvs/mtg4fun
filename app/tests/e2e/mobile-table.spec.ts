import { randomUUID } from 'node:crypto';
import { test, expect, openMatchRail, closeMatchRail, returnOpeningHandToLibrary, roomBody } from './fixtures';
import type { Page } from '@playwright/test';

async function touch(page: Page, points: { x: number; y: number }[]) {
  const session = await page.context().newCDPSession(page);
  try {
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [points[0]] });
    for (const point of points.slice(1)) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally { await session.detach(); }
}

test('mão móvel navega, organiza, inspeciona ao segurar e continua após girar', async ({ page }, info) => {
  test.skip(info.project.name === 'desktop', 'Gestos reais de toque.');
  test.setTimeout(90_000);
  expect((await page.request.post('/api/session', { data: { login: 'amigo', password: 'senha-do-navegador' } })).ok()).toBe(true);
  const { deck } = await (await page.request.post('/api/decks', { multipart: { file: { name: 'mobile.cod', mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck><zone name="main"><card number="40" name="Island"/></zone></cockatrice_deck>') } } })).json();
  const { room } = await (await page.request.post('/api/rooms', { data: roomBody() })).json();
  expect((await page.request.put(`/api/rooms/${room.id}/participants/me/ready`, { data: { deckId: deck.id } })).ok()).toBe(true);
  expect((await page.request.post(`/api/rooms/${room.id}/start`, { data: {} })).status()).toBe(201);
  await returnOpeningHandToLibrary(page.request, room.id);
  const path = `/api/rooms/${room.id}/match`;
  const act = async (data: object) => {
    const response = await page.request.post(`${path}/actions`, { data: { intentId: randomUUID(), ...data } });
    expect(response.ok()).toBe(true);
    return (await response.json()).match;
  };
  await act({ kind: 'draw', count: 15 });
  // Only artwork is controlled. Sessions, gestures, actions and persistence are real.
  await page.route('**/api/cards/image?*', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 63 88"><rect width="63" height="88" fill="#8daebf"/><text x="5" y="10" font-size="6">Island</text></svg>' }));
  await page.setViewportSize({ width: 839, height: 393 });
  await page.goto(`/#/salas/${room.id}`);
  const hand = page.getByRole('region', { name: 'Mão', exact: true });
  const row = hand.getByLabel('Cartas da mão', { exact: true });
  const cards = hand.getByRole('button', { name: 'Island', exact: true });
  await expect(cards).toHaveCount(15);
  const originalIds = await cards.evaluateAll(nodes => nodes.map(node => node.getAttribute('data-card-id')));
  const box = (await row.boundingBox())!;
  await touch(page, [{ x: box.x + box.width - 15, y: box.y + 25 }, { x: box.x + box.width / 2, y: box.y + 25 }, { x: box.x + 15, y: box.y + 25 }]);
  await expect.poll(() => row.evaluate(node => node.scrollLeft)).toBeGreaterThan(30);
  expect(await cards.evaluateAll(nodes => nodes.map(node => node.getAttribute('data-card-id')))).toEqual(originalIds);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await row.evaluate(node => { node.scrollLeft = 0; });
  const first = (await cards.first().boundingBox())!;
  const session = await page.context().newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: first.x + first.width / 2, y: first.y + 25 }] });
  const inspection = page.getByRole('dialog', { name: 'Imagem de Island', exact: true });
  await expect(inspection).toBeVisible();
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await session.detach();
  await expect(inspection).toBeVisible();
  await expect(hand.locator('[aria-pressed="true"]')).toHaveCount(0);
  await inspection.getByRole('button', { name: 'Fechar', exact: true }).tap();
  const start = (await cards.first().boundingBox())!;
  const drag = await page.context().newCDPSession(page);
  await drag.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: start.x + start.width / 2, y: start.y + 20 }] });
  await drag.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + start.width / 2, y: start.y - 20 }] });
  const target = page.getByRole('region', { name: 'Destinos do arraste', exact: true }).getByRole('button', { name: 'Campo', exact: true });
  await expect(target).toBeVisible();
  const destination = (await target.boundingBox())!;
  await drag.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: destination.x + destination.width / 2, y: destination.y + destination.height / 2 }] });
  await expect(target).toHaveAttribute('aria-current', 'true');
  await drag.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await drag.detach();
  const fieldCard = page.locator(`[data-battlefield-canvas] [data-card-id="${originalIds[0]}"]`);
  await expect(fieldCard).toBeVisible();
  await expect(cards).toHaveCount(14);
  const nav = page.getByRole('navigation', { name: 'Controles da mesa', exact: true });
  await nav.getByRole('button', { name: 'Comprar', exact: true }).tap();
  await expect(cards).toHaveCount(15);
  await act({ kind: 'set_tapped', cardIds: [originalIds[0]], tapped: true });
  await expect(fieldCard).toHaveAttribute('data-tapped', 'true');
  await nav.getByRole('button', { name: 'Desvirar', exact: true }).tap();
  await expect(fieldCard).toHaveAttribute('data-tapped', 'false');
  await page.setViewportSize({ width: 393, height: 839 });
  await expect(cards).toHaveCount(15);
  // A normal touch keeps the card actionable; only a deliberate hold opens
  // inspection. This uses the real match API and the selected card can then
  // be played through the public action bar.
  await cards.first().tap();
  await expect(hand.locator('[aria-pressed="true"]')).toHaveCount(1);
  await expect(page.getByRole('toolbar', { name: 'Ações da seleção', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Imagem de Island', exact: true })).toHaveCount(0);
  await page.getByRole('toolbar', { name: 'Ações da seleção', exact: true }).getByRole('button', { name: 'Limpar seleção', exact: true }).tap();
  await hand.getByRole('button', { name: 'Organizar', exact: true }).tap();
  const oldFirst = await cards.first().getAttribute('data-card-id');
  await cards.first().focus();
  await page.keyboard.press('Alt+ArrowRight');
  expect(await cards.nth(1).getAttribute('data-card-id')).toBe(oldFirst);
  await hand.getByRole('button', { name: 'Concluir', exact: true }).tap();
  const grid = (await row.boundingBox())!;
  await touch(page, [{ x: grid.x + 50, y: grid.y + grid.height - 30 }, { x: grid.x + 50, y: grid.y + grid.height / 2 }, { x: grid.x + 50, y: grid.y + 30 }]);
  await expect.poll(() => row.evaluate(node => node.scrollTop)).toBeGreaterThan(30);
  await expect(page.getByRole('region', { name: 'Destinos do arraste', exact: true })).toHaveCount(0);
  await openMatchRail(page, 'Registro');
  await expect(page.getByRole('group', { name: 'Filtrar registro', exact: true })).toBeVisible();
  await closeMatchRail(page);
  await page.reload();
  await expect(cards).toHaveCount(15);
  await page.setViewportSize({ width: 839, height: 393 });
  await expect(fieldCard).toHaveAttribute('data-tapped', 'false');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('mobile-gestures48.png') });
});
