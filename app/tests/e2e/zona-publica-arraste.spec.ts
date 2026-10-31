import { test, expect, roomBody, returnOpeningHandToLibrary } from './fixtures';
import type { Match } from '../../src/features/rooms/roomsApi';

test('soltar fora de uma carta no visualizador não atravessa para o campo; arrastar para fora continua funcionando', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop'); test.setTimeout(60_000);
  const api = page.request;
  expect((await api.post('/api/session', { data: { login: 'amigo', password: 'senha-do-navegador' } })).ok()).toBeTruthy();
  const { deck } = await (await api.post('/api/decks', { multipart: { file: { name: 'deck.cod', mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck><zone name="main"><card number="8" name="Island"/></zone></cockatrice_deck>') } } })).json();
  const { room } = await (await api.post('/api/rooms', { data: roomBody() })).json();
  await api.put(`/api/rooms/${room.id}/participants/me/ready`, { data: { deckId: deck.id } });
  expect((await api.post(`/api/rooms/${room.id}/start`, { data: {} })).ok()).toBeTruthy();
  await returnOpeningHandToLibrary(api, room.id);
  const path = `/api/rooms/${room.id}/match`;
  const act = async (action: object): Promise<Match> => { const response = await api.post(`${path}/actions`, { data: { intentId: crypto.randomUUID(), ...action } }); expect(response.ok()).toBeTruthy(); return (await response.json()).match; };
  const drawn = await act({ kind: 'draw', count: 4 });
  const ids = drawn.players.find(p => p.userId === drawn.viewerId)!.hand!.map(card => card.id);
  await act({ kind: 'move', cardIds: ids.slice(0, 2), to: 'graveyard' });
  await act({ kind: 'move', cardIds: ids.slice(2), to: 'exile' });
  await page.setViewportSize({ width: 1312, height: 825 }); await page.goto(`/#/salas/${room.id}`);
  for (const [zone, label] of [['graveyard', 'Cemitério'], ['exile', 'Exílio']] as const) {
    const own = page.locator('.own-table-surface');
    await own.locator(`.zone-${zone} .zone-open`).click();
    const panel = page.getByRole('dialog', { name: `${label} de Amigo da mesa` });
    const cards = panel.locator('.playing-card'); await expect(cards).toHaveCount(2);
    const first = (await cards.nth(0).boundingBox())!, header = (await panel.locator('.table-panel-header').boundingBox())!;
    const before: Match = (await (await api.get(path)).json()).match;
    await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2); await page.mouse.down();
    await page.mouse.move(header.x + header.width / 2, header.y + header.height / 2, { steps: 8 }); await page.mouse.up();
    await page.waitForTimeout(300);
    await expect(cards).toHaveCount(2);
    await expect.poll(async () => (await (await api.get(path)).json()).match.log.length).toBe(before.log.length);
    const after: Match = (await (await api.get(path)).json()).match;
    expect(after.players.find(p => p.userId === after.viewerId)![zone]?.map(card => card.id)).toEqual(before.players.find(p => p.userId === before.viewerId)![zone]?.map(card => card.id));
    await panel.getByRole('button', { name: `Fechar ${label.toLocaleLowerCase('pt-BR')}` }).click();
  }
  await page.locator('.own-table-surface .zone-graveyard .zone-open').click();
  const panel = page.getByRole('dialog', { name: 'Cemitério de Amigo da mesa' });
  const source = (await panel.locator('.playing-card').first().boundingBox())!;
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2); await page.mouse.down();
  await page.mouse.move(source.x + source.width / 2 + 12, source.y + source.height / 2, { steps: 3 });
  await expect(page.locator('.drag-ghost')).toBeVisible();
  const box = (await page.locator('.own-table-surface').getByRole('region', { name: 'Campo', exact: true }).boundingBox())!;
  await page.mouse.move(box.x + box.width - 40, box.y + box.height / 2, { steps: 8 }); await page.mouse.up();
  await expect.poll(async () => (await (await api.get(path)).json()).match.players.find((p: { userId: number }, _i: number, _a: unknown) => p.userId === drawn.viewerId).battlefield.length).toBe(1);
});

test('o dono reordena cemitério e exílio arrastando a carta; o oponente só vê', async ({ browser, baseURL }, info) => {
  test.skip(info.project.name !== 'desktop'); test.setTimeout(60_000);
  const owner = await browser.newContext({ baseURL, viewport: { width: 1312, height: 825 } });
  const other = await browser.newContext({ baseURL, viewport: { width: 1312, height: 825 } });
  try {
    const api = owner.request;
    expect((await api.post('/api/session', { data: { login: 'amigo', password: 'senha-do-navegador' } })).ok()).toBeTruthy();
    expect((await other.request.post('/api/session', { data: { login: 'segundo', password: 'senha-do-navegador' } })).ok()).toBeTruthy();
    const upload = (request: typeof api) => request.post('/api/decks', { multipart: { file: { name: 'deck.cod', mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck><zone name="main"><card number="8" name="Island"/></zone></cockatrice_deck>') } } });
    const { deck } = await (await upload(api)).json();
    const { room } = await (await api.post('/api/rooms', { data: roomBody() })).json();
    await api.put(`/api/rooms/${room.id}/participants/me/ready`, { data: { deckId: deck.id } });
    await other.request.post(`/api/rooms/${room.id}/participants`, { data: {} });
    const { deck: second } = await (await upload(other.request)).json();
    await other.request.put(`/api/rooms/${room.id}/participants/me/ready`, { data: { deckId: second.id } });
    expect((await api.post(`/api/rooms/${room.id}/start`, { data: {} })).ok()).toBeTruthy();
    const path = `/api/rooms/${room.id}/match`;
    const read = async () => { const { match } = await (await api.get(path)).json() as { match: Match }; return match.players.find(player => player.userId === match.viewerId)!; };
    const ids = (await read()).hand!.slice(0, 6).map(card => card.id);
    for (const [to, cardIds] of [['graveyard', ids.slice(0, 3)], ['exile', ids.slice(3)]] as const) expect((await api.post(`${path}/actions`, { data: { intentId: crypto.randomUUID(), kind: 'move', cardIds, to } })).ok()).toBeTruthy();
    const page = await owner.newPage();
    await page.goto(`/#/salas/${room.id}`);
    for (const [zone, label, cards] of [['graveyard', 'Cemitério', ids.slice(0, 3)], ['exile', 'Exílio', ids.slice(3)]] as const) {
      await page.locator(`.own-table-surface .zone-${zone} .zone-open`).click();
      const panel = page.getByRole('dialog', { name: `${label} de Amigo da mesa` });
      const rows = panel.locator('.public-zone-card');
      await expect(rows).toHaveCount(3);
      // Shown from the top: the last stored card comes first.
      await expect(rows.first()).toHaveAttribute('data-zone-card-id', cards[2]);
      await expect(panel.locator('.library-drag-handle')).toHaveCount(0);
      const from = (await rows.nth(0).boundingBox())!, to = (await rows.nth(2).boundingBox())!;
      await page.mouse.move(from.x + from.width / 2, from.y + 80);
      await page.mouse.down();
      await page.mouse.move(to.x + to.width / 2, to.y + 80, { steps: 8 });
      await expect(rows.nth(2)).toHaveClass(/drag-target/);
      await page.mouse.up();
      await expect.poll(async () => (await read())[zone]!.map(card => card.id)).toEqual([cards[2], cards[0], cards[1]]);
      await expect(rows.first()).toHaveAttribute('data-zone-card-id', cards[1]);
      await rows.first().locator('.playing-card').press('ArrowRight');
      await expect.poll(async () => (await read())[zone]!.map(card => card.id)).toEqual([cards[2], cards[1], cards[0]]);
      await panel.getByRole('button', { name: `Fechar ${label.toLocaleLowerCase('pt-BR')}` }).click();
    }
    const opponent = await other.newPage();
    await opponent.goto(`/#/salas/${room.id}`);
    await opponent.locator('.opponent-table-surface .zone-graveyard .zone-open').click();
    const seen = opponent.getByRole('dialog', { name: 'Cemitério de Amigo da mesa' });
    await expect(seen.locator('.public-zone-card')).toHaveCount(3);
    const shownCards = seen.locator('.public-zone-card');
    const firstSeen = await shownCards.first().getAttribute('data-zone-card-id');
    const before = (await shownCards.nth(0).boundingBox())!, after = (await shownCards.nth(2).boundingBox())!;
    await opponent.mouse.move(before.x + before.width / 2, before.y + 80);
    await opponent.mouse.down();
    await opponent.mouse.move(after.x + after.width / 2, after.y + 80, { steps: 8 });
    await opponent.mouse.up();
    await opponent.waitForTimeout(300);
    await expect(shownCards.first()).toHaveAttribute('data-zone-card-id', firstSeen!);
  } finally { await owner.close(); await other.close(); }
});
