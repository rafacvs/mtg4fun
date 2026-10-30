import { test, expect, roomBody, returnOpeningHandToLibrary } from './fixtures';
import type { Match } from '../../src/features/rooms/roomsApi';

test('arrastar seleção e soltar sobre carta não abre inspeção', async ({ page }, info) => {
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
  const drawn = await act({ kind: 'draw', count: 2 });
  const cards = drawn.players.find(p => p.userId === drawn.viewerId)!.hand!.slice(-2);
  await act({ kind: 'move', cardIds: cards.map(card => card.id), to: 'battlefield' });
  for (const [index, card] of cards.entries()) await act({ kind: 'position', cardId: card.id, x: index + 1, row: 0 });
  await page.setViewportSize({ width: 1312, height: 825 }); await page.goto(`/#/salas/${room.id}`);
  const field = page.getByRole('article', { name: 'Mesa de Amigo da mesa' });
  const first = field.locator(`.playing-card[data-card-id="${cards[0].id}"]`);
  const second = field.locator(`.playing-card[data-card-id="${cards[1].id}"]`);
  for (const button of ['left', 'right'] as const) {
    await page.keyboard.press('Escape');
    const a = (await first.boundingBox())!, b = (await second.boundingBox())!;
    const start = { x: a.x - 4, y: a.y + 4 };
    expect(await page.evaluate(({x,y}) => !!document.elementFromPoint(x,y)?.closest('[data-battlefield-canvas]') && !document.elementFromPoint(x,y)?.closest('.playing-card'), start)).toBe(true);
    if (button === 'left') await page.keyboard.down('Shift');
    await page.mouse.move(start.x, start.y); await page.mouse.down({ button });
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
    await expect(first).toHaveClass(/is-selected/); await expect(second).toHaveClass(/is-selected/);
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await expect(first).toHaveClass(/is-selected/); await expect(second).not.toHaveClass(/is-selected/);
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await expect(second).toHaveClass(/is-selected/);
    await page.mouse.up({ button });
    if (button === 'left') await page.keyboard.up('Shift');
    await expect(first).toHaveClass(/is-selected/); await expect(second).toHaveClass(/is-selected/);
    await expect(page.getByRole('toolbar', { name: 'Ações da seleção' })).toBeVisible();
    await page.waitForTimeout(400); // A inspeção por clique simples é atrasada para distinguir o duplo clique.
    await expect(page.getByRole('dialog', { name: /Imagem de/ })).toHaveCount(0);
    await expect(second).toHaveClass(/is-selected/, { timeout: 1000 });
  }
  await second.click({ button: 'right' });
  await expect(page.getByRole('dialog', { name: /Imagem de/ })).toBeVisible();
});
