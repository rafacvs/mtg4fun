import { test, expect, roomBody } from './fixtures';

test('a ordem de jogadores mostra o comandante de cada deck escolhido', async ({ page, browser, baseURL }, info) => {
  test.skip(info.project.name !== 'desktop');
  const other = await browser.newContext({ baseURL });
  try {
    const decks: number[] = [];
    for (const [request, login, commander] of [[page.request, 'amigo', 'Gargos, Vicious Watcher'], [other.request, 'segundo', 'Mabel, Heir to Cragflame']] as const) {
      expect((await request.post('/api/session', { data: { login, password: 'senha-do-navegador' } })).ok()).toBeTruthy();
      const xml = `<cockatrice_deck><zone name="main"><card number="8" name="Island"/><card number="1" name="${commander}"/></zone></cockatrice_deck>`;
      const response = await request.post('/api/decks', { multipart: { file: { name: 'deck.cod', mimeType: 'application/xml', buffer: Buffer.from(xml) } } });
      expect(response.ok()).toBeTruthy();
      const { deck } = await response.json();
      expect((await request.put(`/api/decks/${deck.id}/commander`, { data: { name: commander } })).ok()).toBeTruthy();
      decks.push(deck.id);
    }
    const { room } = await (await page.request.post('/api/rooms', { data: roomBody({ seats: 2 }) })).json();
    const path = `/api/rooms/${room.id}`;
    expect((await other.request.post(`${path}/participants`, { data: {} })).ok()).toBeTruthy();
    await page.route('**/api/cards/image?*', route => route.fulfill({ path: 'public/library-back.png', contentType: 'image/png' }));
    await page.route(`**${path}/preparation-decks`, async route => {
      const response = await route.fetch();
      if (response.ok() && (await response.json()).decks.length === 0) await new Promise(resolve => setTimeout(resolve, 1200));
      await route.fulfill({ response });
    });
    await page.goto(`/#/salas/${room.id}`);
    expect((await page.request.put(`${path}/participants/me/ready`, { data: { deckId: decks[0] } })).ok()).toBeTruthy();
    expect((await other.request.put(`${path}/participants/me/ready`, { data: { deckId: decks[1] } })).ok()).toBeTruthy();
    await expect.poll(async () => (await (await page.request.get(`${path}/preparation-decks`)).json()).decks.length).toBe(2);
    expect((await page.request.post(`${path}/preparation/start`, { data: {} })).ok()).toBeTruthy();
    await expect(page.locator('.order-seat.own img')).toHaveAttribute('src', /Gargos%2C%20Vicious%20Watcher/);
    await expect(page.locator('.order-seat.other-0 img')).toHaveAttribute('src', /Mabel%2C%20Heir%20to%20Cragflame/);
    await page.waitForTimeout(1500);
    await expect(page.locator('.order-seat.other-0 img')).toHaveAttribute('src', /Mabel%2C%20Heir%20to%20Cragflame/);
  } finally { await other.close(); }
});
