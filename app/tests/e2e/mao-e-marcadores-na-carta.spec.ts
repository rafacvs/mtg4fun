import { test, expect, roomBody, returnOpeningHandToLibrary } from './fixtures';
import type { Match } from '../../src/features/rooms/roomsApi';

test('mão em leque com cartas inteiras e marcadores na lateral da carta', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  test.setTimeout(60_000);
  const api = page.request;
  expect((await api.post('/api/session', { data: { login: 'amigo', password: 'senha-do-navegador' } })).ok()).toBeTruthy();
  const { deck } = await (await api.post('/api/decks', { multipart: { file: { name: 'deck.cod', mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck><zone name="main"><card number="10" name="Island"/></zone></cockatrice_deck>') } } })).json();
  const { room } = await (await api.post('/api/rooms', { data: roomBody() })).json();
  await api.put(`/api/rooms/${room.id}/participants/me/ready`, { data: { deckId: deck.id } });
  expect((await api.post(`/api/rooms/${room.id}/start`, { data: {} })).ok()).toBeTruthy();
  await returnOpeningHandToLibrary(api, room.id);
  const act = async (action: object): Promise<Match> => (await (await api.post(`/api/rooms/${room.id}/match/actions`, { data: { intentId: crypto.randomUUID(), ...action } })).json()).match;
  const drawn = await act({ kind: 'draw', count: 6 });
  const [fieldId, handMarked] = drawn.players[0].hand!.map(card => card.id);
  await act({ kind: 'move', cardIds: [fieldId], to: 'battlefield' });
  for (const [cardId, color, value] of [[fieldId, 'red', 2], [fieldId, 'blue', 11], [handMarked, 'green', 1]] as const) await act({ kind: 'counter', target: 'card', cardId, subject: 'marker', color, operation: 'set', value });

  for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }]) {
    await page.setViewportSize(viewport);
    await page.goto(`/#/salas/${room.id}`);
    const cards = page.getByRole('region', { name: 'Mão', exact: true }).locator('.playing-card');
    await expect(cards).toHaveCount(5);
    const expectedWidth = Math.min(172, Math.max(124, viewport.width * .098)) * .9;
    // Sem rotação, a caixa da carta é a própria carta: inteira, na proporção e dentro da tela.
    const size = await cards.first().evaluate(node => ({ width: (node as HTMLElement).offsetWidth, height: (node as HTMLElement).offsetHeight }));
    expect(Math.abs(size.width - expectedWidth)).toBeLessThanOrEqual(1.5);
    expect(Math.abs(size.height / size.width - 88 / 63)).toBeLessThanOrEqual(.03);
    for (const index of [0, 2, 4]) {
      const box = (await cards.nth(index).boundingBox())!;
      expect(box.y + box.height, `carta ${index}`).toBeLessThanOrEqual(viewport.height + 1);
    }
    const image = await cards.nth(2).locator('img').boundingBox();
    const middle = (await cards.nth(2).boundingBox())!;
    expect(image!.height).toBeGreaterThan(middle.height * .9);
    await expect.poll(() => cards.locator('img').evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0)), { timeout: 15_000 }).toBe(true);
    await page.screenshot({ path: info.outputPath(`mesa-${viewport.width}.png`) });
  }

  const field = page.locator(`.zone-battlefield .playing-card[data-card-id="${fieldId}"]`);
  const box = (await field.boundingBox())!;
  const red = field.getByLabel('marcador vermelho');
  const blue = field.getByLabel('marcador azul');
  await expect(red).toHaveText('2');
  await expect(blue).toHaveText('11');
  const redBox = (await red.boundingBox())!;
  const blueBox = (await blue.boundingBox())!;
  expect(redBox.x).toBeGreaterThanOrEqual(box.x);
  expect(redBox.x + redBox.width).toBeLessThan(box.x + box.width / 2);
  expect(blueBox.y).toBeGreaterThan(redBox.y);
  expect(Math.abs(blueBox.x - redBox.x)).toBeLessThanOrEqual(1);
  expect(redBox.height).toBeLessThanOrEqual(16);
  await expect(page.locator(`.zone-hand .playing-card[data-card-id="${handMarked}"]`).getByLabel('marcador verde')).toHaveText('1');
  await field.screenshot({ path: info.outputPath('marcadores.png') });
});
