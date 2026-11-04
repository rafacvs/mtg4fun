import { test, expect, roomBody, confirmHands, returnOpeningHandToLibrary, openMatchRail } from './fixtures';

test('crônica mantém compras e terrenos por jogador e turno, com timers e total no campo', async ({ page, browser, baseURL }, info) => {
  test.setTimeout(60_000);
  const other = await browser.newContext({ baseURL });
  try {
    const api = page.request;
    let roomId = 0;
    for (const [request, login] of [[api, 'amigo'], [other.request, 'segundo']] as const) {
      expect((await request.post('/api/session', { data: { login, password: 'senha-do-navegador' } })).ok()).toBe(true);
      const { deck } = await (await request.post('/api/decks', { multipart: { file: { name: 'indicadores.cod', mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck><zone name="main"><card number="8" name="Island"/><card number="1" name="Urza&apos;s Saga"/><card number="1" name="Gargos, Vicious Watcher"/></zone></cockatrice_deck>') } } })).json();
      if (!roomId) roomId = (await (await request.post('/api/rooms', { data: roomBody() })).json()).room.id;
      else expect((await request.post(`/api/rooms/${roomId}/participants`, { data: {} })).ok()).toBe(true);
      expect((await request.put(`/api/rooms/${roomId}/participants/me/ready`, { data: { deckId: deck.id } })).ok()).toBe(true);
    }
    expect((await api.post(`/api/rooms/${roomId}/start`, { data: {} })).ok()).toBe(true);
    await returnOpeningHandToLibrary(api, roomId);
    await returnOpeningHandToLibrary(other.request, roomId);
    await confirmHands(roomId, api, other.request);
    const path = `/api/rooms/${roomId}/match`;
    const act = async (data: object, request = api) => {
      const result = await request.post(`${path}/actions`, { data: { intentId: crypto.randomUUID(), ...data } });
      expect(result.ok(), await result.text()).toBe(true);
      return (await result.json()).match;
    };
    await page.goto(`/#/salas/${roomId}`);
    await openMatchRail(page, 'Registro');
    const log = page.getByRole('region', { name: 'Registro da partida' });
    await log.getByRole('button', { name: 'Terrenos / Draws', exact: true }).click();
    await expect(log.getByRole('group', { name: 'Filtrar registro' }).getByRole('button')).toHaveCount(4);
    if (info.project.name === 'desktop') {
      const buttons = log.getByRole('group', { name: 'Filtrar registro' }).getByRole('button');
      const boxes = await buttons.evaluateAll(nodes => nodes.map(node => { const box = node.getBoundingClientRect(); return { x: box.x, y: box.y, right: box.right }; }));
      expect(Math.abs(boxes[0].y - boxes[1].y)).toBeLessThan(1);
      expect(boxes[0].right).toBeLessThanOrEqual(boxes[1].x);
      expect(Math.abs(boxes[0].y - boxes[3].y)).toBeLessThan(1);
    }
    const timer = log.getByLabel('Tempo de partida', { exact: true });
    await expect(timer).toHaveText(/\d{2}:\d{2}:\d{2}/);
    await expect(log.getByLabel('Tempo de sala', { exact: true })).toHaveText(/\d{2}:\d{2}:\d{2}/);
    const initial = await timer.textContent();
    await expect.poll(() => timer.textContent()).not.toBe(initial);
    await expect(log.getByLabel('Compras de Amigo da mesa no turno 1', { exact: true })).toHaveText('0');
    await act({ kind: 'draw', count: 4 });
    const drawn = await act({ kind: 'draw', count: 6 });
    const own = drawn.players.find((p: { userId: number }) => p.userId === drawn.viewerId);
    const selected = ['Island', "Urza's Saga", 'Gargos, Vicious Watcher'].map(name => own.hand.find((c: { name: string }) => c.name === name).id);
    const intentId = crypto.randomUUID();
    await act({ kind: 'move', cardIds: [selected[0]], to: 'battlefield' });
    const move = { intentId, kind: 'move', cardIds: selected.slice(1), to: 'battlefield' };
    expect((await api.post(`${path}/actions`, { data: move })).ok()).toBe(true);
    expect((await api.post(`${path}/actions`, { data: move })).ok()).toBe(true);
    await act({ kind: 'draw', count: 1 }, other.request);
    const lands = page.getByRole('group', { name: 'Terrenos no campo de Amigo da mesa', exact: true });
    await expect(lands.locator('strong')).toHaveText('2');
    await expect(log.getByLabel('Compras de Amigo da mesa no turno 1', { exact: true })).toHaveText('10');
    await expect(log.getByLabel('Terrenos jogados por Amigo da mesa no turno 1', { exact: true })).toHaveText('2');
    await expect(log.getByLabel('Compras de Segundo amigo no turno 1', { exact: true })).toHaveText('1');
    await act({ kind: 'set_tapped', cardIds: [selected[0]], tapped: true });
    await expect(lands.locator('strong')).toHaveText('2');
    await act({ kind: 'turn', direction: 'next' });
    await expect(log.getByLabel('Compras de Amigo da mesa no turno 2', { exact: true })).toHaveText('0');
    await expect(log.getByLabel('Terrenos jogados por Amigo da mesa no turno 2', { exact: true })).toHaveText('0');
    await act({ kind: 'move', cardIds: [selected[1]], to: 'hand' });
    await expect(lands.locator('strong')).toHaveText('1');
    await act({ kind: 'move', cardIds: [selected[1]], to: 'battlefield' });
    await expect(log.getByLabel('Terrenos jogados por Amigo da mesa no turno 2', { exact: true })).toHaveText('1');
    await page.reload();
    await openMatchRail(page, 'Registro');
    await log.getByRole('button', { name: 'Terrenos / Draws', exact: true }).click();
    await expect(log.getByLabel('Terrenos jogados por Amigo da mesa no turno 2', { exact: true })).toHaveText('1');
    await log.getByLabel('Turno 1', { exact: true }).click();
    await expect(log.getByLabel('Terrenos jogados por Amigo da mesa no turno 1', { exact: true })).toHaveText('2');
    await expect(log.getByLabel('Compras de Amigo da mesa no turno 1', { exact: true })).toHaveText('10');
    await log.getByRole('button', { name: 'Jogo', exact: true }).click();
    await expect(log.getByLabel('Resumo do turno 1', { exact: true })).toHaveCount(0);
    await log.getByRole('button', { name: 'Ajustes', exact: true }).click();
    await log.getByRole('button', { name: 'Terrenos / Draws', exact: true }).click();
    await expect(log.getByLabel('Compras de Amigo da mesa no turno 1', { exact: true })).toHaveText('10');
    await page.screenshot({ path: info.outputPath('indicadores.png'), fullPage: true });
    if (info.project.name === 'desktop') {
      await expect(lands).toBeInViewport();
      const bounds = (await lands.boundingBox())!;
      expect(bounds.width).toBeGreaterThan(35);
      const label = (await lands.getByText('Terrenos', { exact: true }).boundingBox())!;
      const rail = (await lands.locator('..').boundingBox())!;
      expect(label.y + label.height).toBeLessThanOrEqual(rail.y + rail.height + 1);
    }
  } finally { await other.close(); }
});
