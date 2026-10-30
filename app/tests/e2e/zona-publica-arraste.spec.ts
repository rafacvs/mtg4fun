import { test, expect, roomBody, returnOpeningHandToLibrary } from './fixtures';
import type { Match } from '../../src/features/rooms/roomsApi';

test('soltar no visualizador não atravessa para o campo; arrastar para fora continua funcionando', async ({ page }, info) => {
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
    const first = (await cards.nth(0).boundingBox())!, second = (await cards.nth(1).boundingBox())!;
    const before: Match = (await (await api.get(path)).json()).match;
    await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2); await page.mouse.down();
    await page.mouse.move(second.x + second.width / 2, second.y + second.height / 2, { steps: 8 }); await page.mouse.up();
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
  const destination = page.getByRole('region', { name: 'Destinos do arraste' }).getByRole('button', { name: 'Campo', exact: true });
  await expect(destination).toBeVisible();
  const box = (await destination.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 }); await page.mouse.up();
  await expect.poll(async () => (await (await api.get(path)).json()).match.players.find((p: { userId: number }, _i: number, _a: unknown) => p.userId === drawn.viewerId).battlefield.length).toBe(1);
});
