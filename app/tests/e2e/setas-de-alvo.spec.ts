import { test, expect, roomBody, confirmHands } from './fixtures';

test('setas de cartas são compartilhadas e Escape limpa apenas as próprias', async ({ page, browser, baseURL }, info) => {
  test.skip(info.project.name !== 'desktop');
  test.setTimeout(90_000);
  const other = await browser.newContext({ baseURL });
  try {
    const api = page.request;
    let roomId = 0;
    for (const [request, login] of [[api, 'amigo'], [other.request, 'segundo']] as const) {
      expect((await request.post('/api/session', { data: { login, password: 'senha-do-navegador' } })).ok()).toBeTruthy();
      const { deck } = await (await request.post('/api/decks', { multipart: { file: { name: 'setas.cod', mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck><zone name="main"><card number="20" name="Island"/></zone></cockatrice_deck>') } } })).json();
      if (!roomId) roomId = (await (await request.post('/api/rooms', { data: roomBody() })).json()).room.id;
      else expect((await request.post(`/api/rooms/${roomId}/participants`, { data: {} })).ok()).toBeTruthy();
      expect((await request.put(`/api/rooms/${roomId}/participants/me/ready`, { data: { deckId: deck.id } })).ok()).toBeTruthy();
    }
    expect((await api.post(`/api/rooms/${roomId}/start`, { data: {} })).ok()).toBeTruthy();
    await confirmHands(roomId, api, other.request);
    const path = `/api/rooms/${roomId}/match`;
    const act = async (request: typeof api, data: object) => {
      const response = await request.post(`${path}/actions`, { data: { intentId: crypto.randomUUID(), ...data } });
      expect(response.ok(), await response.text()).toBeTruthy();
      return (await response.json()).match;
    };
    let state = (await (await api.get(path)).json()).match;
    const own = state.players.find((p: { userId: number }) => p.userId === state.viewerId);
    const cardIds = own.hand.slice(0, 2).map((card: { id: string }) => card.id);
    expect(cardIds).toHaveLength(2);
    state = await act(api, { kind: 'move', cardIds, to: 'battlefield' });
    const opponentId = state.players.find((p: { userId: number }) => p.userId !== state.viewerId).userId;
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/#/salas/${roomId}`);
    const source = page.locator(`.battlefield-canvas [data-card-id="${cardIds[0]}"]`).first();
    const target = page.locator(`.battlefield-canvas [data-card-id="${cardIds[1]}"]`).first();
    await expect(source).toBeVisible();
    const a = (await source.boundingBox())!, b = (await target.boundingBox())!;
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
    await expect(page.locator('.target-arrows .target-arrow-line')).toHaveCount(1);
    await page.mouse.up({ button: 'right' });
    await expect.poll(async () => (await (await other.request.get(path)).json()).match.arrows.length).toBe(1);
    const life = page.locator(`[data-arrow-player="${opponentId}"]:visible`).first();
    const lifeBox = (await life.boundingBox())!;
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(lifeBox.x + lifeBox.width / 2, lifeBox.y + lifeBox.height / 2, { steps: 8 });
    await page.mouse.up({ button: 'right' });
    await expect.poll(async () => (await (await other.request.get(path)).json()).match.arrows.length).toBe(2);
    await page.screenshot({ path: info.outputPath('setas.png') });
    await act(other.request, { kind: 'arrow_add', cardId: cardIds[0], playerId: opponentId });
    await expect.poll(async () => (await (await api.get(path)).json()).match.arrows.length).toBe(3);
    await page.reload();
    await expect(page.locator('.target-arrows .target-arrow-line')).toHaveCount(3);
    await expect(page.locator('.target-arrows .target-arrow-head')).toHaveCount(3);
    for (const playerId of [state.viewerId, opponentId]) {
      const arrow = page.locator(`.target-arrows [data-arrow-owner="${playerId}"] .target-arrow-line`).first();
      const seat = page.locator(`[data-field-owner="${playerId}"]`).locator('xpath=ancestor::article').locator('.seat-number');
      await expect.poll(() => arrow.evaluate(node => getComputedStyle(node).stroke)).toBe(await seat.evaluate(node => getComputedStyle(node).backgroundColor));
    }
    const otherPage = await other.newPage();
    await otherPage.setViewportSize({ width: 1440, height: 900 });
    await otherPage.goto(`/#/salas/${roomId}`);
    await expect(otherPage.locator('.target-arrows .target-arrow-line')).toHaveCount(3);
    for (const playerId of [state.viewerId, opponentId]) {
      const arrow = otherPage.locator(`.target-arrows [data-arrow-owner="${playerId}"] .target-arrow-line`).first();
      const seat = otherPage.locator(`[data-field-owner="${playerId}"]`).locator('xpath=ancestor::article').locator('.seat-number');
      await expect.poll(() => arrow.evaluate(node => getComputedStyle(node).stroke)).toBe(await seat.evaluate(node => getComputedStyle(node).backgroundColor));
    }
    await page.keyboard.press('Escape');
    await expect.poll(async () => (await (await other.request.get(path)).json()).match.arrows.length).toBe(1);
    const remaining = (await (await other.request.get(path)).json()).match;
    expect(remaining.arrows[0].ownerId).toBe(remaining.viewerId);
  } finally { await other.close(); }
});
