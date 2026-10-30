import { test, expect, roomBody } from './fixtures';

test('arrastar o campo navega sem mover cartas', async ({ page }) => {
  expect((await page.request.post('/api/session', { data: { login: 'amigo', password: 'senha-do-navegador' } })).ok()).toBe(true);
  const upload = await page.request.post('/api/decks', { multipart: { file: { name: 'campo.cod', mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck><zone name="main"><card number="4" name="Island"/></zone></cockatrice_deck>') } } });
  const { deck } = await upload.json();
  const { room } = await (await page.request.post('/api/rooms', { data: roomBody() })).json();
  expect((await page.request.put(`/api/rooms/${room.id}/participants/me/ready`, { data: { deckId: deck.id } })).ok()).toBe(true);
  expect((await page.request.post(`/api/rooms/${room.id}/start`, { data: {} })).ok()).toBe(true);
  const { match } = await (await page.request.get(`/api/rooms/${room.id}/match`)).json();
  const ids = match.players[0].hand.slice(0, 4).map((card: { id: string }) => card.id);
  for (const [index, id] of ids.entries()) expect((await page.request.post(`/api/rooms/${room.id}/match/actions`, { data: { intentId: crypto.randomUUID(), kind: 'move', cardIds: [id], to: 'battlefield', x: index, row: index % 2 } })).ok()).toBe(true);
  await page.goto(`/#/salas/${room.id}`);
  const scroll = page.getByRole('region', { name: 'Campo', exact: true }).locator('.battlefield-scroll');
  await expect(scroll).toBeVisible();
  const box = (await scroll.boundingBox())!;
  // The view only travels when the cards no longer fit it.
  expect(await scroll.evaluate(el => el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight)).toBe(false);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect.poll(async () => {
    await page.mouse.wheel(0, -300);
    return scroll.evaluate(el => el.scrollWidth > el.clientWidth && el.scrollHeight > el.clientHeight);
  }, { intervals: [150] }).toBe(true);
  await scroll.evaluate(el => { el.scrollLeft = 0; el.scrollTop = 0; });
  const before = await scroll.evaluate(el => ({ x: el.scrollLeft, y: el.scrollTop }));
  const empty = await scroll.evaluate(el => {
    const view = el.getBoundingClientRect();
    for (let y = view.top + view.height / 2; y < view.bottom; y += 8) for (let x = view.right - 8; x > view.left; x -= 8) {
      const element = document.elementFromPoint(x, y);
      if (element?.closest('[data-battlefield-canvas]') && !element.closest('.playing-card')) return { x, y };
    }
    return null;
  });
  expect(empty).not.toBeNull();
  await page.mouse.move(empty!.x, empty!.y);
  await page.mouse.down();
  await page.mouse.move(empty!.x - 80, empty!.y - 50, { steps: 8 });
  await page.mouse.up();
  const after = await scroll.evaluate(el => ({ x: el.scrollLeft, y: el.scrollTop }));
  expect(after.x).toBeGreaterThan(before.x);
  expect(after.y).toBeGreaterThan(before.y);
});
