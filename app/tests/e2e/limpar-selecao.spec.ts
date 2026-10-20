import { test, expect, selectFieldArea } from './fixtures';
import type { Match } from '../../src/features/rooms/roomsApi';

test('clique no espaço vazio do campo limpa a seleção e preserva os gestos', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'A seleção múltipla por toque foi removida a pedido do usuário.');
  expect((await page.request.post('/api/session', { data: { login: 'amigo', password: 'senha-do-navegador' } })).ok()).toBe(true);
  const upload = await page.request.post('/api/decks', { multipart: { file: {
    name: 'limpar-selecao.cod', mimeType: 'application/xml',
    buffer: Buffer.from('<cockatrice_deck><zone name="main"><card number="4" name="Island"/></zone></cockatrice_deck>'),
  } } });
  expect(upload.status()).toBe(201);
  const { deck } = await upload.json();
  const created = await page.request.post('/api/rooms', { data: {} });
  expect(created.status()).toBe(201);
  const { room } = await created.json();
  expect((await page.request.put(`/api/rooms/${room.id}/participants/me/ready`, { data: { deckId: deck.id } })).ok()).toBe(true);
  expect((await page.request.post(`/api/rooms/${room.id}/start`, { data: {} })).status()).toBe(201);
  const path = `/api/rooms/${room.id}/match`;
  const action = async (fields: Record<string, unknown>): Promise<Match> => {
    const response = await page.request.post(`${path}/actions`, { data: { intentId: crypto.randomUUID(), ...fields } });
    expect(response.ok()).toBe(true);
    return (await response.json()).match;
  };
  const read = async (): Promise<Match> => (await (await page.request.get(path)).json()).match;
  const drawn = await action({ kind: 'draw', count: 4 });
  const ids = drawn.players[0].hand!.map(card => card.id);
  await action({ kind: 'move', cardIds: ids, to: 'battlefield' });
  for (const [index, id] of ids.entries()) await action({ kind: 'position', cardId: id, x: 1 + index, row: 0 });
  await page.route('**/api/cards/image?*', route => route.fulfill({ status: 502, body: 'Imagem indisponível' }));
  await page.goto(`/#/salas/${room.id}`);
  const field = page.getByRole('region', { name: 'Campo', exact: true });
  const canvas = field.locator('[data-battlefield-canvas]');
  const selected = field.locator('.playing-card.is-selected');
  const selectCards = async () => {
    await selectFieldArea(page, field);
    await expect(selected).toHaveCount(4);
  };
  const clear = async () => {
    await canvas.click({ position: { x: 12, y: 8 } });
    await expect(selected).toHaveCount(0);
  };
  await selectCards();
  const before = await read();
  await field.getByRole('button', { name: 'Diminuir zoom', exact: true }).click();
  await expect(selected).toHaveCount(4);
  await clear();
  expect(await read()).toEqual(before);
  await selectCards();
  const first = (await field.locator(`[data-card-id="${ids[0]}"]`).boundingBox())!;
  const last = (await field.locator(`[data-card-id="${ids[3]}"]`).boundingBox())!;
  await page.mouse.move(first.x - 8, first.y + 4);
  await page.mouse.down();
  await page.mouse.move(last.x + last.width + 4, last.y + last.height + 4, { steps: 8 });
  await page.mouse.up();
  await expect(selected).toHaveCount(4);
  await field.locator(`[data-card-id="${ids[0]}"]`).dblclick();
  await expect(field.locator('.is-selected[data-tapped="true"]')).toHaveCount(4);
  const confirmed = await read();
  await clear();
  expect(await read()).toEqual(confirmed);
});
