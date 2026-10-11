import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

test('arrasta cartas para fileiras, sobrepõe e reposiciona cada uma independentemente', async ({ page }, testInfo) => {
  test.setTimeout(45_000);
  const api = page.context().request;
  expect((await api.post('/api/session', { data: { login: 'amigo', password: 'senha-do-navegador' } })).ok()).toBe(true);
  const uploaded = await api.post('/api/decks', { multipart: { file: { name: 'posicoes.cod', mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck version="1"><deckname>Posições</deckname><zone name="main"><card number="4" name="Island"/></zone></cockatrice_deck>') } } });
  expect(uploaded.status()).toBe(201);
  const { deck } = await uploaded.json();
  const created = await api.post('/api/rooms', { data: {} });
  const { room } = await created.json();
  expect((await api.put(`/api/rooms/${room.id}/participants/me/ready`, { data: { deckId: deck.id } })).ok()).toBe(true);
  expect((await api.post(`/api/rooms/${room.id}/start`, { data: {} })).status()).toBe(201);

  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto(`/#/salas/${room.id}`);
  const hand = page.getByRole('region', { name: 'Mão', exact: true });
  const field = page.getByRole('region', { name: 'Campo', exact: true });
  await page.getByRole('button', { name: 'Ações', exact: true }).click();
  await page.getByRole('button', { name: 'Comprar cartas', exact: true }).click();
  await page.getByRole('button', { name: 'Comprar cartas', exact: true }).click();
  await page.getByRole('button', { name: 'Fechar ações', exact: true }).click();
  const cards = hand.getByRole('button', { name: 'Island', exact: true });
  await expect(cards).toHaveCount(2);
  await cards.nth(0).dragTo(field, { steps: 8 });
  await expect(field.getByRole('button', { name: 'Island', exact: true })).toHaveCount(1);
  await cards.nth(0).dragTo(field, { steps: 8 });
  const fieldCards = field.getByRole('button', { name: 'Island', exact: true });
  await expect(fieldCards).toHaveCount(2);
  const first = await fieldCards.nth(0).boundingBox();
  const second = await fieldCards.nth(1).boundingBox();
  expect(Math.abs(first!.x - second!.x)).toBeLessThan(3);
  expect(Math.abs(first!.y - second!.y)).toBeLessThan(3);

  const fieldBox = await field.boundingBox();
  const target = { x: fieldBox!.x + 8, y: fieldBox!.y + fieldBox!.height / 3 };
  if (testInfo.project.use.hasTouch) await dragWithTouch(page, second!, target);
  else {
    await page.mouse.move(second!.x + second!.width / 2, second!.y + second!.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 8 });
    await page.mouse.up();
  }
  await expect(fieldCards).toHaveCount(2);
  const moved = await fieldCards.nth(1).boundingBox();
  expect(Math.abs(first!.x - moved!.x)).toBeGreaterThan(10);
  const rows = await field.locator('.positioned-card').evaluateAll(cards => cards.map(card => Number.parseFloat((card as HTMLElement).style.top)));
  expect(rows.some(row => Math.abs(row - 100 / 3) < 0.01)).toBe(true);
});

async function dragWithTouch(page: Page, source: { x: number; y: number; width: number; height: number }, target: { x: number; y: number }) {
  const session = await page.context().newCDPSession(page);
  const start = { x: source.x + source.width / 2, y: source.y + source.height / 2, id: 1 };
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
  for (let step = 1; step <= 8; step += 1) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + (target.x - start.x) * step / 8, y: start.y + (target.y - start.y) * step / 8, id: 1 }] });
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await session.detach();
}
