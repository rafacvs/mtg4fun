import { test, expect, roomBody } from './fixtures';

test('arrastar o campo navega sem mover cartas', async ({ page }) => {
  expect((await page.request.post('/api/session', { data: { login: 'amigo', password: 'senha-do-navegador' } })).ok()).toBe(true);
  const upload = await page.request.post('/api/decks', { multipart: { file: { name: 'campo.cod', mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck><zone name="main"><card number="4" name="Island"/></zone></cockatrice_deck>') } } });
  const { deck } = await upload.json();
  const { room } = await (await page.request.post('/api/rooms', { data: roomBody() })).json();
  expect((await page.request.put(`/api/rooms/${room.id}/participants/me/ready`, { data: { deckId: deck.id } })).ok()).toBe(true);
  expect((await page.request.post(`/api/rooms/${room.id}/start`, { data: {} })).ok()).toBe(true);
  await page.goto(`/#/salas/${room.id}`);
  const scroll = page.getByRole('region', { name: 'Campo', exact: true }).locator('.battlefield-scroll');
  await expect(scroll).toBeVisible();
  const box = (await scroll.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -500);
  await expect.poll(() => scroll.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
  await scroll.evaluate(el => { el.scrollLeft = 0; el.scrollTop = 0; });
  const before = await scroll.evaluate(el => ({ x: el.scrollLeft, y: el.scrollTop }));
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 80, box.y + box.height / 2 - 50, { steps: 8 });
  await page.mouse.up();
  const after = await scroll.evaluate(el => ({ x: el.scrollLeft, y: el.scrollTop }));
  expect(after.x).toBeGreaterThan(before.x);
  expect(after.y).toBeGreaterThan(before.y);
});
