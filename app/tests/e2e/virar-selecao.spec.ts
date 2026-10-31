import { test, expect, returnOpeningHandToLibrary, roomBody } from './fixtures';
import type { Match } from '../../src/features/rooms/roomsApi';

test('duplo clique vira e desvira quatro cartas selecionadas por área', async ({ page, browser, baseURL }, info) => {
  test.skip(info.project.name !== 'desktop', 'Duplo clique e seleção por área usam mouse.');
  test.setTimeout(45_000);
  const observer = await browser.newContext({ baseURL });
  try {
    let roomId = 0;
    for (const [request, login] of [[page.request, 'amigo'], [observer.request, 'segundo']] as const) {
      expect((await request.post('/api/session', { data: { login, password: 'senha-do-navegador' } })).ok()).toBe(true);
      const uploaded = await request.post('/api/decks', { multipart: { file: {
        name: 'virar-selecao.cod', mimeType: 'application/xml',
        buffer: Buffer.from('<cockatrice_deck><zone name="main"><card number="5" name="Island"/></zone></cockatrice_deck>'),
      } } });
      expect(uploaded.status()).toBe(201);
      const { deck } = await uploaded.json();
      if (!roomId) roomId = (await (await request.post('/api/rooms', { data: roomBody() })).json()).room.id;
      else expect((await request.post(`/api/rooms/${roomId}/participants`, { data: {} })).ok()).toBe(true);
      expect((await request.put(`/api/rooms/${roomId}/participants/me/ready`, { data: { deckId: deck.id } })).ok()).toBe(true);
    }
    expect((await page.request.post(`/api/rooms/${roomId}/start`, { data: {} })).status()).toBe(201);
    await returnOpeningHandToLibrary(page.request, roomId);
    await returnOpeningHandToLibrary(observer.request, roomId);
    const path = `/api/rooms/${roomId}/match`;
    const action = async (fields: Record<string, unknown>, request = page.request): Promise<Match> => {
      const response = await request.post(`${path}/actions`, { data: { intentId: crypto.randomUUID(), ...fields } });
      expect(response.ok(), await response.text()).toBe(true);
      return (await response.json()).match;
    };
    const read = async (request = page.request): Promise<Match> => {
      const response = await request.get(path);
      expect(response.ok()).toBe(true);
      return (await response.json()).match;
    };
    const drawn = await action({ kind: 'draw', count: 5 });
    const ownId = drawn.viewerId;
    const ids = drawn.players.find(player => player.userId === ownId)!.hand!.map(card => card.id);
    await action({ kind: 'move', cardIds: ids, to: 'battlefield' });
    for (const [index, id] of ids.entries()) await action({ kind: 'position', cardId: id, x: 1 + index, row: 0 });
    // Mixed initial states must all follow the clicked card's target state.
    await action({ kind: 'set_tapped', cardIds: [ids[1]], tapped: true });
    const otherDrawn = await action({ kind: 'draw', count: 1 }, observer.request);
    const otherId = otherDrawn.viewerId;
    const otherCard = otherDrawn.players.find(player => player.userId === otherId)!.hand![0];
    await action({ kind: 'move', cardIds: [otherCard.id], to: 'battlefield' }, observer.request);
    // Only images are controlled; gestures, state, persistence and log use the real API.
    await page.route('**/api/cards/image?*', route => route.fulfill({ status: 502, body: 'Imagem indisponível' }));
    await page.goto(`/#/salas/${roomId}`);
    await expect(page.locator('.own-table-surface')).toBeVisible();
    const field = page.getByRole('article', { name: 'Mesa de Amigo da mesa', exact: true }).getByRole('region', { name: 'Campo', exact: true });
    const selected = field.locator('.playing-card.is-selected');
    const first = field.locator(`[data-card-id="${ids[0]}"]`);
    const last = field.locator(`[data-card-id="${ids[3]}"]`);
    const start = (await first.boundingBox())!;
    const end = (await last.boundingBox())!;
    await page.keyboard.down('Shift');
    await page.mouse.move(start.x - 8, start.y + 4);
    await page.mouse.down();
    await page.mouse.move(end.x + end.width + 4, end.y + end.height + 4, { steps: 8 });
    await page.mouse.up();
    await page.keyboard.up('Shift');
    await expect(selected).toHaveCount(4);
    const sent: { cardIds: string[]; tapped: boolean }[] = [];
    page.on('request', request => {
      if (request.method() === 'POST' && request.url().endsWith(`${path}/actions`)) {
        const body = request.postDataJSON();
        if (body.kind === 'set_tapped') sent.push(body);
      }
    });
    let logs = (await read()).log.length;
    for (const [index, tapped] of [true, false].entries()) {
      await first.dblclick();
      await expect(field.locator(`.is-selected[data-tapped="${tapped}"]`)).toHaveCount(4);
      await expect(selected).toHaveCount(4);
      await expect(field.locator(`[data-card-id="${ids[4]}"]`)).toHaveAttribute('data-tapped', 'false');
      const confirmed = await read();
      expect(confirmed.log).toHaveLength(++logs);
      expect(confirmed.log.at(-1)).toMatchObject({ kind: 'set_tapped', count: 4 });
      expect(sent).toHaveLength(index + 1);
      expect([...sent[index].cardIds].sort()).toEqual(ids.slice(0, 4).sort());
      expect(sent[index].tapped).toBe(tapped);
      const seen = await read(observer.request);
      expect(seen.players.find(player => player.userId === ownId)!.battlefield!.slice(0, 4).every(card => Boolean(card.tapped) === tapped)).toBe(true);
      expect(seen.players.find(player => player.userId === otherId)!.battlefield![0].tapped ?? false).toBe(false);
    }
    // Right-drag selects an area without opening the browser context menu.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const rightStart = (await first.boundingBox())!;
    const rightEnd = (await last.boundingBox())!;
    await page.mouse.move(rightStart.x - 8, rightStart.y + 4);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(rightEnd.x + rightEnd.width + 4, rightEnd.y + rightEnd.height + 4, { steps: 8 });
    await page.mouse.up({ button: 'right' });
    await expect(selected).toHaveCount(4);
    await first.dblclick();
    await expect(field.locator('.is-selected[data-tapped="true"]')).toHaveCount(4);
    await first.dblclick();
    await expect(field.locator('.is-selected[data-tapped="false"]')).toHaveCount(4);
    await first.click({ button: 'right' });
    await expect(selected).toHaveCount(3);
    await first.click({ button: 'right' });
    await expect(selected).toHaveCount(4);
    await expect(page.getByRole('dialog', { name: 'Imagem de Island' })).toHaveCount(0);
    // A double click outside the selection acts only on that card.
    const unselected = field.locator(`[data-card-id="${ids[4]}"]`);
    await unselected.dblclick();
    await expect(unselected).toHaveAttribute('data-tapped', 'true');
    await expect(unselected).toHaveAttribute('aria-pressed', 'false');
    await expect(selected).toHaveCount(4);
    expect((await read()).log.at(-1)).toMatchObject({ kind: 'set_tapped', count: 1 });
    await page.keyboard.press('Escape');
    await expect(selected).toHaveCount(0);
    await first.dblclick();
    await expect(first).toHaveAttribute('data-tapped', 'true');
    await page.reload();
    await expect(first).toHaveAttribute('data-tapped', 'true');
    await expect(unselected).toHaveAttribute('data-tapped', 'true');
    for (const id of ids.slice(1, 4)) await expect(field.locator(`[data-card-id="${id}"]`)).toHaveAttribute('data-tapped', 'false');
    await expect(selected).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: 'Imagem de Island', exact: true })).toHaveCount(0);
  } finally {
    await observer.close();
  }
});
