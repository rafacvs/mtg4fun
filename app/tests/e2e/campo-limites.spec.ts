import { test, expect, returnOpeningHandToLibrary, roomBody } from './fixtures';
import type { Locator, Page } from '@playwright/test';

async function measure(field: Locator) {
  return field.evaluate(scroll => {
    const view = scroll.getBoundingClientRect();
    const cards = [...scroll.querySelectorAll('[data-card-id]')].map(card => card.getBoundingClientRect());
    return {
      left: scroll.scrollLeft, top: scroll.scrollTop,
      cut: cards.filter(box => box.left < view.left - .5 || box.top < view.top - .5).length,
      lastInside: cards.some(box => box.left >= view.left - .5 && box.right <= view.right + .5),
      count: cards.length,
    };
  });
}

// Drags the view from an empty spot of the field, the way a player pans it.
async function pan(page: Page, field: Locator, deltaX: number, deltaY: number) {
  const point = await field.evaluate(scroll => {
    const view = scroll.getBoundingClientRect();
    for (let y = view.top + view.height / 2; y < view.bottom; y += 8) for (let x = view.right - 8; x > view.left; x -= 8) {
      const element = document.elementFromPoint(x, y);
      if (element?.closest('[data-battlefield-canvas]') && !element.closest('.playing-card')) return { x, y };
    }
    return null;
  });
  expect(point).not.toBeNull();
  await page.mouse.move(point!.x, point!.y);
  await page.mouse.down();
  await page.mouse.move(point!.x + deltaX, point!.y + deltaY, { steps: 6 });
  await page.mouse.up();
}

test('arrastar a visão não esconde cartas atrás do trilho e do cabeçalho, em nenhum campo', async ({ browser, baseURL }, info) => {
  test.skip(info.project.name !== 'desktop'); test.setTimeout(60_000);
  const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });
  const other = await browser.newContext({ baseURL });
  try {
    const deckFile = { file: { name: 'deck.cod', mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck><zone name="main"><card number="12" name="Island"/></zone></cockatrice_deck>') } };
    const { room } = await (async () => {
      expect((await context.request.post('/api/session', { data: { login: 'amigo', password: 'senha-do-navegador' } })).ok()).toBeTruthy();
      expect((await other.request.post('/api/session', { data: { login: 'segundo', password: 'senha-do-navegador' } })).ok()).toBeTruthy();
      return (await context.request.post('/api/rooms', { data: roomBody() })).json();
    })();
    await other.request.post(`/api/rooms/${room.id}/participants`, { data: {} });
    for (const request of [context.request, other.request]) {
      const { deck } = await (await request.post('/api/decks', { multipart: deckFile })).json();
      await request.put(`/api/rooms/${room.id}/participants/me/ready`, { data: { deckId: deck.id } });
    }
    expect((await context.request.post(`/api/rooms/${room.id}/start`, { data: {} })).ok()).toBeTruthy();
    const path = `/api/rooms/${room.id}/match`;
    const seat = async (request: typeof context.request) => { const { match } = await (await request.get(path)).json(); return match.players.find((player: { userId: number }) => player.userId === match.viewerId); };
    for (const request of [context.request, other.request]) {
      const ids = (await seat(request)).hand.slice(0, 3).map((card: { id: string }) => card.id);
      for (const [index, id] of ids.entries()) expect((await request.post(`${path}/actions`, { data: { intentId: crypto.randomUUID(), kind: 'move', cardIds: [id], to: 'battlefield', x: index, row: 0 } })).ok()).toBeTruthy();
    }
    await returnOpeningHandToLibrary(context.request, room.id);
    const page = await context.newPage();
    await page.goto(`/#/salas/${room.id}`);
    const own = page.locator('.own-table-surface .battlefield-scroll');
    const rival = page.locator('.opponent-table-surface .battlefield-scroll').first();
    await expect(own.locator('[data-card-id]')).toHaveCount(3);
    await expect(rival.locator('[data-card-id]')).toHaveCount(3);

    for (const field of [own, rival]) {
      await pan(page, field, -400, -400);
      expect(await measure(field)).toMatchObject({ left: 0, top: 0, cut: 0, count: 3 });
    }

    // Cards larger than the view still pan, but the last one is never lost.
    const box = (await own.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3);
    await expect.poll(async () => {
      await page.mouse.wheel(0, -150);
      return own.evaluate(scroll => scroll.scrollWidth > scroll.clientWidth);
    }, { intervals: [150] }).toBe(true);
    await page.waitForTimeout(200);
    await pan(page, own, -3000, -3000);
    await pan(page, own, -3000, -3000);
    const far = await measure(own);
    expect(far.left).toBeGreaterThan(0);
    expect(far.lastInside).toBe(true);

    // Empty cells remain drop targets after zooming back out.
    await page.locator('.own-table-surface').getByRole('button', { name: /^Centralizar campo/ }).click();
    await page.waitForTimeout(200);
    expect(await measure(own)).toMatchObject({ left: 0, top: 0, cut: 0 });
    for (let step = 0; step < 3; step += 1) await page.mouse.wheel(0, 150);
    await page.waitForTimeout(200);
    const card = (await own.locator('[data-card-id]').first().boundingBox())!;
    const cardId = await own.locator('[data-card-id]').first().getAttribute('data-card-id');
    const view = (await own.boundingBox())!;
    await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2);
    await page.mouse.down();
    await page.mouse.move(view.x + view.width - 20, view.y + 40, { steps: 8 });
    await page.mouse.up();
    await expect.poll(async () => (await seat(context.request)).battlefield.find((item: { id: string }) => item.id === cardId).positionX).toBeGreaterThan(2);
  } finally { await context.close(); await other.close(); }
});
