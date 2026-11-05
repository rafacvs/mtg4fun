import { test, expect, roomBody, confirmHands, returnOpeningHandToLibrary } from './fixtures';

test('reserva compartilha mana, zera terrenos e limpa ao passar o turno', async ({ page, browser, baseURL }, info) => {
  test.skip(info.project.name !== 'desktop');
  test.setTimeout(90_000);
  const other = await browser.newContext({ baseURL });
  try {
    const api = page.request;
    let roomId = 0;
    for (const [request, login] of [[api, 'amigo'], [other.request, 'segundo']] as const) {
      expect((await request.post('/api/session', { data: { login, password: 'senha-do-navegador' } })).ok()).toBeTruthy();
      const { deck } = await (await request.post('/api/decks', { multipart: { file: { name: 'mana.cod', mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck><zone name="main"><card number="8" name="Island"/><card number="1" name="Gargos, Vicious Watcher"/></zone></cockatrice_deck>') } } })).json();
      if (!roomId) roomId = (await (await request.post('/api/rooms', { data: roomBody() })).json()).room.id;
      else expect((await request.post(`/api/rooms/${roomId}/participants`, { data: {} })).ok()).toBeTruthy();
      expect((await request.put(`/api/rooms/${roomId}/participants/me/ready`, { data: { deckId: deck.id } })).ok()).toBeTruthy();
    }
    expect((await api.post(`/api/rooms/${roomId}/start`, { data: {} })).ok()).toBeTruthy();
    await returnOpeningHandToLibrary(api, roomId);
    await returnOpeningHandToLibrary(other.request, roomId);
    await confirmHands(roomId, api, other.request);
    const path = `/api/rooms/${roomId}/match`;
    const act = async (data: object) => {
      const response = await api.post(`${path}/actions`, { data: { intentId: crypto.randomUUID(), ...data } });
      expect(response.ok(), await response.text()).toBeTruthy();
      return (await response.json()).match;
    };
    let state = await act({ kind: 'draw', count: 9 });
    const own = state.players.find((p: { userId: number }) => p.userId === state.viewerId);
    const island = own.hand.find((c: { name: string }) => c.name === 'Island').id;
    const creature = own.hand.find((c: { name: string }) => c.name === 'Gargos, Vicious Watcher').id;
    state = await act({ kind: 'move', cardIds: [island, creature], to: 'battlefield' });
    state = await act({ kind: 'position', cardId: creature, x: 4, row: 0 });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/#/salas/${roomId}`);
    const field = page.locator(`[data-field-owner="${state.viewerId}"]`);
    const land = field.locator(`[data-card-id="${island}"]`);
    await expect(land).toBeVisible();
    await land.dblclick();
    const pool = page.getByRole('button', { name: 'Reserva de mana de Amigo da mesa' });
    const exile = field.locator('xpath=ancestor::article').getByRole('region', { name: 'Exílio' });
    await expect.poll(async () => (await pool.boundingBox())!.y - ((await exile.boundingBox())!.y + (await exile.boundingBox())!.height)).toBeGreaterThanOrEqual(0);
    await pool.click();
    let dialog = page.getByRole('dialog', { name: 'Reserva de mana de Amigo da mesa' });
    expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    expect(await pool.evaluate(node => {
      const outer = node.getBoundingClientRect();
      return [...node.querySelectorAll('.mana-orb')].every(orb => { const box = orb.getBoundingClientRect(); return box.left >= outer.left && box.right <= outer.right; });
    })).toBe(true);
    await expect(dialog.getByRole('button', { name: 'Adicionar mana azul: 1' })).toBeVisible();
    const remote = (await (await other.request.get(path)).json()).match;
    expect(remote.players.find((p: { userId: number }) => p.userId === state.viewerId).mana.blue).toBe(1);
    await dialog.getByRole('button', { name: 'Adicionar mana vermelha: 0' }).click();
    await expect(dialog.getByRole('button', { name: 'Adicionar mana vermelha: 1' })).toBeVisible();
    await page.screenshot({ path: info.outputPath('reserva-mana.png') });
    await dialog.getByRole('button', { name: 'Zerar e desvirar terrenos' }).click();
    await expect(land).toHaveAttribute('data-tapped', 'false');
    await expect(dialog.getByRole('button', { name: 'Adicionar mana azul: 0' })).toBeVisible();
    await page.keyboard.press('Escape');
    await land.dblclick();
    await expect(land).toHaveAttribute('data-tapped', 'true');
    await act({ kind: 'turn', direction: 'next' });
    await expect.poll(async () => (await (await other.request.get(path)).json()).match.players.find((p: { userId: number }) => p.userId === state.viewerId).mana).toBeNull();
    await expect(land).toHaveAttribute('data-tapped', 'true');
    await field.locator(`[data-card-id="${creature}"]`).dblclick();
    dialog = page.getByRole('dialog', { name: 'Reserva de mana de Amigo da mesa' });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await land.click({ modifiers: ['Shift'] });
    await field.locator(`[data-card-id="${creature}"]`).click({ modifiers: ['Shift'] });
    const article = field.locator('xpath=ancestor::article');
    await expect(article.getByRole('button', { name: 'Ações da seleção' })).toHaveCount(0);
    const layout = await article.evaluate(node => {
      const mana = node.querySelector('.mana-pool-slot')!.getBoundingClientRect();
      const lands = node.querySelector('.land-count')!.getBoundingClientRect();
      return { manaBottom: mana.bottom, landsTop: lands.top };
    });
    expect(layout.landsTop).toBeGreaterThanOrEqual(layout.manaBottom);
    const rail = article.locator('.zone-column');
    expect(await rail.evaluate(node => node.scrollHeight <= node.clientHeight + 1)).toBe(true);
    await page.screenshot({ path: info.outputPath('reserva-mana-selecao.png') });
  } finally { await other.close(); }
});
