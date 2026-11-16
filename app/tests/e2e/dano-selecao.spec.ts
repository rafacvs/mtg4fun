import { test, expect, roomBody, confirmHands, returnOpeningHandToLibrary } from './fixtures';

test('seleção de criaturas soma poder atual e seleção mista não mostra dano', async ({ page, browser, baseURL }, info) => {
  test.skip(info.project.name === 'celular-horizontal');
  test.setTimeout(60_000);
  const other = await browser.newContext({ baseURL });
  try {
    let room = 0;
    for (const [request, login] of [[page.request, 'amigo'], [other.request, 'segundo']] as const) {
      expect((await request.post('/api/session', { data: { login, password: 'senha-do-navegador' } })).ok()).toBeTruthy();
      const { deck } = await (await request.post('/api/decks', { multipart: { file: { name: 'deck.cod', mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck><zone name="main"><card number="10" name="Island"/></zone></cockatrice_deck>') } } })).json();
      if (!room) room = (await (await request.post('/api/rooms', { data: roomBody() })).json()).room.id;
      else expect((await request.post(`/api/rooms/${room}/participants`, { data: {} })).ok()).toBeTruthy();
      expect((await request.put(`/api/rooms/${room}/participants/me/ready`, { data: { deckId: deck.id } })).ok()).toBeTruthy();
    }
    expect((await page.request.post(`/api/rooms/${room}/start`, { data: {} })).ok()).toBeTruthy();
    await confirmHands(room, page.request, other.request);
    await returnOpeningHandToLibrary(page.request, room);
    const path = `/api/rooms/${room}/match`;
    const act = async (fields: object) => { const res = await page.request.post(`${path}/actions`, { data: { intentId: crypto.randomUUID(), ...fields } }); expect(res.ok(), await res.text()).toBeTruthy(); return (await res.json()).match; };
    await act({ kind: 'create-token', tokenName: 'Soldier Token', count: 2 });
    await act({ kind: 'create-custom-token', name: 'Dragão amigo', power: '2', toughness: '2' });
    const drawn = await act({ kind: 'draw', count: 1 });
    const island = drawn.players.find((p: { userId: number }) => p.userId === drawn.viewerId).hand[0].id;
    const moved = await act({ kind: 'move', cardIds: [island], to: 'battlefield' });
    const tokens = moved.players.find((p: { userId: number }) => p.userId === moved.viewerId).battlefield.filter((c: { name: string }) => c.name === 'Soldier Token').map((c: { id: string }) => c.id);
    const custom = moved.players.find((p: { userId: number }) => p.userId === moved.viewerId).battlefield.find((c: { name: string }) => c.name === 'Dragão amigo').id;
    for (const [index, id] of [...tokens, island, custom].entries()) await act({ kind: 'position', cardId: id, x: index + 1, row: 0 });
    await page.setViewportSize(info.project.name === 'celular' ? { width: 320, height: 640 } : { width: 1440, height: 900 });
    await page.goto(`/#/salas/${room}`);
    for (const id of tokens) {
      const card = page.locator(`.own-table-surface .playing-card[data-card-id="${id}"]`);
      await card.click({ modifiers: ['Shift'] });
      await expect(card).toHaveClass(/is-selected/);
    }
    const bar = page.getByRole('toolbar', { name: 'Ações da seleção' });
    await expect(bar.locator('.selection-damage')).toContainText('2');
    const sizes = info.project.name === 'celular' ? [{ width: 320, height: 640 }] : [{ width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 1024, height: 600 }];
    for (const viewport of sizes) {
      await page.setViewportSize(viewport);
      if (info.project.name === 'desktop') {
        const rail = page.locator('.own-table-surface .zone-column');
        const selectionBox = (await rail.getByRole('button', { name: 'Ações da seleção' }).boundingBox())!;
        const landBox = (await rail.getByRole('group', { name: /Terrenos no campo/ }).boundingBox())!;
        expect(selectionBox.y + selectionBox.height).toBeLessThanOrEqual(landBox.y + 1);
      }
      await expect(bar).toBeInViewport();
      const box = (await bar.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
    }
    await bar.getByRole('button', { name: '+1/+1', exact: true }).click();
    await expect(bar.locator('.selection-damage')).toContainText('4');
    await page.locator(`.own-table-surface .playing-card[data-card-id="${island}"]`).click({ modifiers: ['Shift'] });
    await expect(bar.locator('.selection-damage')).toHaveCount(0);
    await page.locator(`.own-table-surface .playing-card[data-card-id="${island}"]`).click({ modifiers: ['Shift'] });
    await page.locator(`.own-table-surface .playing-card[data-card-id="${custom}"]`).click({ modifiers: ['Shift'] });
    await expect(bar.locator('.selection-damage')).toContainText('6');
  } finally { await other.close(); }
});
