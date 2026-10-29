import { test, expect, returnOpeningHandToLibrary, roomBody } from './fixtures';
import type { Match } from '../../src/features/rooms/roomsApi';

test('marcadores da seleção alteram todas as cartas e persistem', async ({ page, browser, baseURL }) => {
  test.setTimeout(60_000);
  const other = await browser.newContext({ baseURL });
  try {
    let room = 0;
    for (const [request, login] of [[page.request, 'amigo'], [other.request, 'segundo']] as const) {
      expect((await request.post('/api/session', { data: { login, password: 'senha-do-navegador' } })).ok()).toBeTruthy();
      const uploaded = await request.post('/api/decks', { multipart: { file: { name: 'deck.cod', mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck><zone name="main"><card number="5" name="Island"/></zone></cockatrice_deck>') } } });
      const { deck } = await uploaded.json();
      if (!room) room = (await (await request.post('/api/rooms', { data: roomBody() })).json()).room.id;
      else expect((await request.post(`/api/rooms/${room}/participants`, { data: {} })).ok()).toBeTruthy();
      expect((await request.put(`/api/rooms/${room}/participants/me/ready`, { data: { deckId: deck.id } })).ok()).toBeTruthy();
    }
    expect((await page.request.post(`/api/rooms/${room}/start`, { data: {} })).ok()).toBeTruthy();
    await returnOpeningHandToLibrary(page.request, room); await returnOpeningHandToLibrary(other.request, room);
    const path = `/api/rooms/${room}/match`;
    const act = async (fields: object): Promise<Match> => { const res = await page.request.post(`${path}/actions`, { data: { intentId: crypto.randomUUID(), ...fields } }); expect(res.ok()).toBeTruthy(); return (await res.json()).match; };
    const drawn = await act({ kind: 'draw', count: 3 });
    const ids = drawn.players.find(p => p.userId === drawn.viewerId)!.hand!.map(c => c.id);
    await act({ kind: 'move', cardIds: ids, to: 'battlefield' });
    for (const [i, id] of ids.entries()) await act({ kind: 'position', cardId: id, x: i + 1, row: 0 });
    await page.goto(`/#/salas/${room}`);
    await page.getByRole('button', { name: 'Selecionar', exact: true }).click();
    for (const id of ids.slice(0, 2)) await page.locator(`.own-table-surface [data-card-id="${id}"] .playing-card, .own-table-surface .playing-card[data-card-id="${id}"]`).first().click();
    const bar = page.getByRole('toolbar', { name: 'Ações da seleção' });
    await expect(bar).toContainText('2 selecionadas');
    await bar.getByRole('button', { name: '+1/+1', exact: true }).click();
    const getCards = async () => { const match: Match = (await (await page.request.get(path)).json()).match; return match.players.find(p => p.userId === match.viewerId)!.battlefield!.filter(c => ids.includes(c.id)); };
    await expect.poll(async () => (await getCards()).filter(c => c.power === 1 && c.toughness === 1).length).toBe(2);
    await bar.getByRole('button', { name: '-1/-1', exact: true }).click();
    await expect.poll(async () => (await getCards()).filter(c => (c.power ?? 0) === 0 && (c.toughness ?? 0) === 0).length).toBe(3);
    await bar.getByLabel('Poder/resistência').fill('3/-2'); await bar.getByLabel('Poder/resistência').press('Enter');
    await expect.poll(async () => (await getCards()).filter(c => c.power === 3 && c.toughness === -2).length).toBe(2);
    await bar.getByRole('button', { name: 'Marcadores', exact: true }).click();
    await bar.getByRole('button', { name: 'Adicionar marcador azul' }).click();
    await expect.poll(async () => (await getCards()).filter(c => c.markers?.blue === 1).length).toBe(2);
    await page.reload();
    await expect.poll(async () => (await getCards()).filter(c => c.power === 3 && c.toughness === -2 && c.markers?.blue === 1).length).toBe(2);
  } finally { await other.close(); }
});
