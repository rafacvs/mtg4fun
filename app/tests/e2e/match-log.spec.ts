import { randomUUID } from 'node:crypto';
import type { APIRequestContext } from '@playwright/test';
import type { Match } from '../../src/features/rooms/roomsApi';
import { test, expect, openMatchRail, returnOpeningHandToLibrary, roomBody } from './fixtures';

async function prepare(api: APIRequestContext, other: APIRequestContext) {
  let roomId = 0;
  const decks: { request: APIRequestContext; id: number }[] = [];
  for (const [index, request] of [api, other].entries()) {
    expect((await request.post('/api/session', { data: { login: index ? 'segundo' : 'amigo', password: 'senha-do-navegador' } })).ok()).toBe(true);
    const { deck } = await (await request.post('/api/decks', { multipart: { file: { name: 'registro.cod', mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck><zone name="main"><card number="8" name="Island"/></zone></cockatrice_deck>') } } })).json();
    if (!roomId) roomId = (await (await request.post('/api/rooms', { data: roomBody() })).json()).room.id;
    else expect((await request.post(`/api/rooms/${roomId}/participants`, { data: {} })).ok()).toBe(true);
    expect((await request.put(`/api/rooms/${roomId}/participants/me/ready`, { data: { deckId: deck.id } })).ok()).toBe(true);
    decks.push({ request, id: deck.id });
  }
  expect((await api.post(`/api/rooms/${roomId}/start`, { data: {} })).status()).toBe(201);
  for (const { request } of decks) await returnOpeningHandToLibrary(request, roomId);
  for (const { request, id } of decks) expect((await request.delete(`/api/decks/${id}`)).ok()).toBe(true);
  const action = async (fields: Record<string, unknown>, request = api): Promise<Match> => {
    const response = await request.post(`/api/rooms/${roomId}/match/actions`, { data: { intentId: randomUUID(), ...fields } });
    expect(response.ok(), await response.text()).toBe(true);
    return (await response.json()).match;
  };
  return { roomId, action };
}

test('registro separa ajustes do jogo sem esconder compras', async ({ page, browser, baseURL }) => {
  test.setTimeout(90_000);
  const observer = await browser.newContext({ baseURL });
  try {
    const { roomId, action } = await prepare(page.request, observer.request);
    const created = await action({ kind: 'create-token', tokenName: 'Soldier Token' });
    const token = created.players.find(player => player.userId === created.viewerId)!.battlefield![0];
    await action({ kind: 'draw', count: 1 });
    await action({ kind: 'position', cardId: token.id, x: 240, row: 2 });
    const consulted = await action({ kind: 'consult', consultFrom: 'top', count: 2 });
    const window = consulted.players.find(player => player.userId === consulted.viewerId)!.consulted!;
    await action({ kind: 'reorder', cardIds: window.map(card => card.id).reverse() });
    await page.goto(`/#/salas/${roomId}`);
    await openMatchRail(page, 'Registro');
    const log = page.getByRole('region', { name: 'Registro da partida', exact: true });
    await expect(log.getByRole('button', { name: 'Jogo', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(log).toContainText('comprou 1 carta(s)');
    await expect(log).not.toContainText('reposicionou');
    await expect(log).not.toContainText('consultou');
    await expect(log).not.toContainText('reorganizou');
    await log.getByRole('button', { name: 'Ajustes', exact: true }).click();
    await expect(log).toContainText('reposicionou 1 carta(s)');
    await expect(log).toContainText('consultou o grimório em privado');
    await expect(log).toContainText('reorganizou uma consulta privada');
    await expect(log).not.toContainText('comprou');
    await log.getByRole('button', { name: 'Tudo', exact: true }).click();
    await expect(log).toContainText('comprou 1 carta(s)');
    await expect(log).toContainText('reposicionou');
  } finally { await observer.close(); }
});

test('registro agrupa ações seguidas no turno e recolhe os turnos anteriores', async ({ page, browser, baseURL }) => {
  test.setTimeout(90_000);
  const observer = await browser.newContext({ baseURL });
  try {
    const { roomId, action } = await prepare(page.request, observer.request);
    await action({ kind: 'create-token', tokenName: 'Soldier Token' });
    const created = await action({ kind: 'create-token', tokenName: 'Soldier Token' });
    const cards = created.players.find(player => player.userId === created.viewerId)!.battlefield!;
    await action({ kind: 'set_tapped', cardIds: [cards[0].id], tapped: true });
    await action({ kind: 'set_tapped', cardIds: [cards[1].id], tapped: true });
    await action({ kind: 'turn', direction: 'next' });
    await action({ kind: 'draw', count: 1 }, observer.request);
    await page.goto(`/#/salas/${roomId}`);
    await openMatchRail(page, 'Registro');
    const log = page.getByRole('region', { name: 'Registro da partida', exact: true });
    const turns = log.locator('details');
    await expect(turns).toHaveCount(2);
    await expect(turns.first().getByLabel('Turno 2', { exact: true })).toBeVisible();
    await expect(turns.first()).toHaveAttribute('open', '');
    await expect(turns.first()).toContainText('Segundo amigo comprou 1 carta(s)');
    await expect(turns.nth(1)).not.toHaveAttribute('open', '');
    await expect(turns.nth(1).getByText('Amigo da mesa alterou virar/desvirar de 2 carta(s).')).toBeHidden();
    await turns.nth(1).getByLabel('Turno 1', { exact: true }).click();
    const tapping = turns.nth(1).getByRole('listitem').filter({ hasText: 'alterou virar/desvirar' });
    await expect(tapping).toHaveCount(1);
    await expect(tapping).toContainText('alterou virar/desvirar de 2 carta(s)');
    await expect(tapping.getByRole('button', { name: 'Prévia de Soldier Token no registro', exact: true })).toHaveCount(2);
  } finally { await observer.close(); }
});
