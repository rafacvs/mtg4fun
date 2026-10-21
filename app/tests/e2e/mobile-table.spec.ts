import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

async function touch(page: Page, points: { x: number; y: number; wait?: number }[]) {
  const session = await page.context().newCDPSession(page);
  try {
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: points[0].x, y: points[0].y }] });
    for (const point of points.slice(1)) {
      if (point.wait) await page.waitForTimeout(point.wait);
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x, y: point.y }] });
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally { await session.detach(); }
}

test('mão deslizável, organização, prévia persistente e painéis mobile', async ({ page }, info) => {
  test.skip(info.project.name === 'desktop', 'Gestos reais de toque.');
  test.setTimeout(90_000);
  await page.request.post('/api/session', { data: { login: 'amigo', password: 'senha-do-navegador' } });
  const uploaded = await page.request.post('/api/decks', { multipart: { file: { name: 'mobile.cod', mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck><zone name="main"><card number="40" name="Island"/></zone></cockatrice_deck>') } } });
  const { deck } = await uploaded.json();
  const { room } = await (await page.request.post('/api/rooms', { data: {} })).json();
  await page.request.put(`/api/rooms/${room.id}/participants/me/ready`, { data: { deckId: deck.id } });
  expect((await page.request.post(`/api/rooms/${room.id}/start`, { data: {} })).status()).toBe(201);
  const act = async (data: object) => {
    const response = await page.request.post(`/api/rooms/${room.id}/match/actions`, { data: { intentId: crypto.randomUUID(), ...data } });
    expect(response.ok(), await response.text()).toBe(true);
    return (await response.json()).match;
  };
  await act({ kind: 'draw', count: 15 });
  for (let i = 0; i < 25; i++) await act({ kind: 'roll', sides: 20 });
  // Only artwork is controlled; gestures and game data use the real browser/API/MySQL.
  await page.route('**/api/cards/image?*', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 63 88"><rect width="63" height="88" rx="3" fill="#8daebf"/><text x="5" y="10" font-size="6">Island</text><path d="M4 16h55v38H4z" fill="#456c87"/><path d="M4 43 20 29 36 40 48 24 59 43v11H4z" fill="#b8c8b4"/><rect x="4" y="58" width="55" height="26" fill="#e2e0ce"/><text x="6" y="65" font-size="4">Basic Land — Island</text></svg>' }));
  await page.goto(`/#/salas/${room.id}`);
  const hand = page.getByRole('region', { name: 'Mão', exact: true });
  const cards = hand.locator('.playing-card');
  await expect(cards).toHaveCount(15);
  const row = hand.locator('.zone-cards');
  const box = (await row.boundingBox())!;
  const originalIds = await cards.evaluateAll(nodes => nodes.map(node => node.getAttribute('data-card-id')));
  await touch(page, [{ x: box.x + box.width - 15, y: box.y + 25 }, { x: box.x + box.width - 45, y: box.y + 25, wait: 30 }, { x: box.x + 15, y: box.y + 25, wait: 40 }]);
  await expect.poll(() => row.evaluate(node => node.scrollLeft)).toBeGreaterThan(30);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await cards.evaluateAll(nodes => nodes.map(node => node.getAttribute('data-card-id')))).toEqual(originalIds);
  await row.evaluate(node => { node.scrollLeft = 0; });
  await page.waitForTimeout(300);
  const first = (await cards.first().boundingBox())!;
  await touch(page, [{ x: first.x + 20, y: first.y + 20 }, { x: first.x + 30, y: first.y + 23, wait: 850 }]);
  const preview = page.getByRole('region', { name: 'Prévia da carta', exact: true });
  await expect(preview).toBeVisible();
  await page.waitForTimeout(400);
  await expect(preview).toBeVisible();
  await expect(page.locator('.drag-ghost')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('mobile-previa.png') });
  await page.getByRole('button', { name: 'Prévia', exact: true }).tap();
  await hand.getByRole('button', { name: 'Organizar', exact: true }).tap();
  const firstAgain = (await cards.first().boundingBox())!;
  const second = (await cards.nth(1).boundingBox())!;
  await touch(page, [{ x: firstAgain.x + 10, y: firstAgain.y + 20 }, { x: second.x + second.width - 3, y: second.y + 20, wait: 50 }]);
  await expect(cards.nth(1)).toHaveAttribute('data-card-id', originalIds[0]!);
  await hand.getByRole('button', { name: 'Concluir', exact: true }).tap();
  const field = page.locator('.focused-table .battlefield-scroll');
  const before = (await field.boundingBox())!.height;
  await page.getByRole('button', { name: 'Ocultar mão e ações', exact: true }).tap();
  await expect(hand).toBeHidden();
  await expect.poll(async () => (await field.boundingBox())!.height).toBeGreaterThan(before + 20);
  await page.screenshot({ path: info.outputPath('mobile-campo.png') });
  await page.getByRole('button', { name: 'Mostrar mão (15) e ações', exact: true }).tap();
  await expect(cards.nth(1)).toHaveAttribute('data-card-id', originalIds[0]!);
  await page.getByRole('button', { name: 'Registro', exact: true }).tap();
  const log = page.locator('.match-log ol');
  const logBox = (await log.boundingBox())!;
  expect(logBox.width).toBeGreaterThan(page.viewportSize()!.width * .8);
  const initial = await log.evaluate(node => node.scrollTop);
  await touch(page, [{ x: logBox.x + 80, y: logBox.y + 30 }, { x: logBox.x + 80, y: logBox.y + logBox.height - 20, wait: 50 }]);
  await expect.poll(() => log.evaluate(node => node.scrollTop)).toBeLessThan(initial);
  await page.screenshot({ path: info.outputPath('mobile-registro.png') });
  await page.getByRole('button', { name: 'Jogadores', exact: true }).tap();
  await expect(log).toBeHidden();
  await expect(page.getByRole('button', { name: 'Ver campo de Amigo da mesa' })).toBeVisible();
  await page.screenshot({ path: info.outputPath('mobile-jogadores.png') });
  await page.getByRole('button', { name: 'Ver campo de Amigo da mesa' }).tap();
  await expect(hand).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Ampliar mesa de Amigo da mesa', exact: true }).tap();
  await page.screenshot({ path: info.outputPath('mobile-mesa.png') });
  // A vertical hand drag still plays the actual card; no fabricated success response.
  const playedId = await cards.first().getAttribute('data-card-id');
  const from = (await cards.first().boundingBox())!;
  const fieldBox = (await field.boundingBox())!;
  const targetX = Math.max(fieldBox.x + 12, from.x + from.width / 2);
  const targetY = fieldBox.y + Math.min(fieldBox.height / 2, 40);
  await touch(page, [{ x: from.x + from.width / 2, y: from.y + 20 }, { x: from.x + from.width / 2, y: from.y - 15, wait: 40 }, { x: targetX, y: targetY, wait: 40 }]);
  await expect(field.locator(`[data-card-id="${playedId}"]`)).toBeVisible();
  await expect(cards).toHaveCount(14);
  await page.reload();
  await expect(field.locator(`[data-card-id="${playedId}"]`)).toBeVisible();
  await cards.first().tap();
  await expect(page.getByRole('dialog', { name: 'Imagem de Island', exact: true })).toBeVisible();

});
