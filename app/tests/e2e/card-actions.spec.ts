import { randomUUID } from 'node:crypto';
import type { APIRequestContext, Page } from '@playwright/test';
import { test, expect, openHand, returnOpeningHandToLibrary, roomBody } from './fixtures';
import type { Match } from '../../src/features/rooms/roomsApi';

async function table(api: APIRequestContext, page: Page) {
  expect((await api.post('/api/session', { data: { login: 'amigo', password: 'senha-do-navegador' } })).ok()).toBe(true);
  const { deck } = await (await api.post('/api/decks', { multipart: { file: { name: 'gestos.cod', mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck><zone name="main"><card number="8" name="Island"/></zone></cockatrice_deck>') } } })).json();
  const { room } = await (await api.post('/api/rooms', { data: roomBody() })).json();
  expect((await api.put(`/api/rooms/${room.id}/participants/me/ready`, { data: { deckId: deck.id } })).ok()).toBe(true);
  expect((await api.post(`/api/rooms/${room.id}/start`, { data: {} })).ok()).toBe(true);
  await returnOpeningHandToLibrary(api, room.id);
  const path = `/api/rooms/${room.id}/match`;
  const act = async (data: object) => {
    const response = await api.post(`${path}/actions`, { data: { intentId: randomUUID(), ...data } });
    expect(response.ok()).toBe(true);
    return (await response.json()).match as Match;
  };
  const read = async () => (await (await api.get(path)).json()).match as Promise<Match>;
  await act({ kind: 'draw', count: 3 });
  await page.goto(`/#/salas/${room.id}`);
  await openHand(page);
  return { act, read, path };
}

test('modo seleção oferece barra da mão e do campo e duplo clique continua virando', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'Gestos de mouse/teclado; toque exercitado pelo cenário específico.');
  test.setTimeout(60_000);
  const { read } = await table(page.request, page);
  const hand = page.getByRole('region', { name: 'Mão', exact: true });
  const first = hand.getByRole('button', { name: 'Island', exact: true }).first();
  const id = await first.getAttribute('data-card-id');
  await page.getByRole('button', { name: 'Selecionar', exact: true }).click();
  await first.click();
  const bar = page.getByRole('toolbar', { name: 'Ações da seleção' });
  await expect(bar).toBeVisible();
  await expect(first).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('dialog', { name: 'Imagem de Island' })).toHaveCount(0);
  await expect(bar.getByRole('button', { name: 'Jogar no campo', exact: true })).toBeVisible();
  await expect(bar.getByRole('button', { name: 'Revelar', exact: true })).toBeVisible();
  await expect(bar.getByRole('button', { name: 'Virar', exact: true })).toHaveCount(0);
  await bar.getByRole('button', { name: 'Jogar no campo', exact: true }).click();
  const field = page.locator('[data-battlefield-canvas]').filter({ has: page.locator(`[data-card-id="${id}"]`) });
  const card = field.locator(`[data-card-id="${id}"]`);
  await expect(card).toBeVisible();
  await card.click();
  for (const name of ['Virar', 'Mão', 'Cemitério', 'Exílio', 'Topo', '+1 marcador', 'Mais']) await expect(bar.getByRole('button', { name, exact: true })).toBeVisible();
  await card.dblclick();
  await expect(card).toHaveAttribute('data-tapped', 'true');
  expect((await read()).players[0].battlefield?.find(item => item.id === id)?.tapped).toBe(true);
  await expect(page.getByRole('dialog', { name: 'Imagem de Island' })).toHaveCount(0);
});

test('Mais e clique direito mostram a inspeção e atalhos agem na seleção', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'Gestos de mouse/teclado; toque exercitado pelo cenário específico.');
  test.setTimeout(60_000);
  const { read } = await table(page.request, page);
  const hand = page.getByRole('region', { name: 'Mão', exact: true });
  const bar = page.getByRole('toolbar', { name: 'Ações da seleção' });
  const first = hand.getByRole('button', { name: 'Island', exact: true }).first();
  const id = await first.getAttribute('data-card-id');
  await page.getByRole('button', { name: 'Selecionar', exact: true }).click();
  await first.click();
  await bar.getByRole('button', { name: 'Jogar no campo', exact: true }).click();
  const card = page.locator(`[data-battlefield-canvas] [data-card-id="${id}"]`);
  await card.click();
  await bar.getByRole('button', { name: 'Mais', exact: true }).click();
  const menu = page.getByRole('dialog', { name: 'Imagem de Island', exact: true });
  await expect(menu).toBeVisible();
  for (const title of ['Colocar face para baixo', 'Revelar para todos', 'Criar cópia independente']) await expect(menu.getByRole('button', { name: title, exact: true })).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Ocultar todas reveladas', exact: true })).toHaveCount(0);
  await expect(menu.getByRole('textbox', { name: 'Poder', exact: true })).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Voltar', exact: true })).toHaveCount(0);
  const titles = await menu.getByRole('button').allTextContents();
  for (const title of ['Mão', 'Cemitério', 'Exílio', 'Comando', 'Topo', 'Fundo']) await expect(menu.getByRole('button', { name: title, exact: true })).toBeVisible();
  await menu.getByRole('button', { name: 'Fechar', exact: true }).click();
  await card.click({ button: 'right' });
  await expect(menu).toBeVisible();
  expect(await menu.getByRole('button').allTextContents()).toEqual(titles);
  await page.keyboard.press('Escape');
  await page.keyboard.press('t');
  await expect(card).toHaveAttribute('data-tapped', 'true');
  await page.keyboard.press('u');
  await expect(card).toHaveAttribute('data-tapped', 'false');
  await page.keyboard.press('+');
  await expect.poll(async () => (await read()).players[0].battlefield?.find(item => item.id === id)?.markers?.red).toBe(1);
  await expect(bar.getByRole('button', { name: 'Mão', exact: true })).toBeEnabled();
  await page.keyboard.press('h');
  await expect(hand.locator(`[data-card-id="${id}"]`)).toHaveAttribute('data-pending', 'false');
  if (await hand.locator(`[data-card-id="${id}"]`).getAttribute('aria-pressed') !== 'true') await hand.locator(`[data-card-id="${id}"]`).click();
  await page.keyboard.press('g');
  const grave = page.getByRole('region', { name: 'Cemitério', exact: true });
  await expect(grave.locator(`[data-card-id="${id}"]`)).toHaveAttribute('data-pending', 'false');
  if (await grave.locator(`[data-card-id="${id}"]`).getAttribute('aria-pressed') !== 'true') await grave.locator(`[data-card-id="${id}"]`).click();
  await page.keyboard.press('e');
  await expect(page.getByRole('region', { name: 'Exílio', exact: true }).locator(`[data-card-id="${id}"]`)).toHaveAttribute('data-pending', 'false');
  await page.keyboard.press('Escape');
  await page.keyboard.press('d');
  await expect(hand.locator('[data-card-id]')).toHaveCount(3);
  await page.keyboard.press('n');
  await expect.poll(async () => (await read()).log.at(-1)?.kind).toBe('turn');
  await expect(page.getByRole('button', { name: 'Comprar', exact: true })).toBeEnabled();
  await page.keyboard.press('r');
  await expect(page.getByRole('dialog', { name: 'Ações do jogo', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('f');
  const tokens = page.getByRole('dialog', { name: 'Ações do jogo', exact: true });
  await expect(tokens.getByRole('heading', { name: 'Criar ficha', exact: true })).toBeVisible();
});

test('Shift mantém várias cartas e arraste mostra destinos com destaque antes de mover o conjunto', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'Gestos de mouse/teclado; toque exercitado pelo cenário específico.');
  test.setTimeout(60_000);
  const { act, read } = await table(page.request, page);
  let current = await read();
  const ids = current.players[0].hand!.slice(0, 2).map(card => card.id);
  await act({ kind: 'move', cardIds: ids, to: 'battlefield' });
  await act({ kind: 'position', cardId: ids[0], x: 0, row: 0 });
  await act({ kind: 'position', cardId: ids[1], x: 2, row: 0 });
  const field = page.locator('[data-battlefield-canvas]');
  const first = field.locator(`[data-card-id="${ids[0]}"]`), second = field.locator(`[data-card-id="${ids[1]}"]`);
  await expect(second).toBeVisible();
  await page.getByRole('button', { name: 'Selecionar', exact: true }).click();
  await first.click();
  await second.click({ modifiers: ['Shift'] });
  await expect(field.locator('[aria-pressed="true"]')).toHaveCount(2);
  const start = (await first.boundingBox())!;
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2 + 15, start.y + start.height / 2 + 15, { steps: 3 });
  const targets = page.getByRole('region', { name: 'Destinos do arraste', exact: true });
  for (const name of ['Campo', 'Mão', 'Cemitério', 'Exílio', 'Comando', 'Topo', 'Fundo']) await expect(targets.getByRole('button', { name, exact: true })).toBeVisible();
  const grave = targets.getByRole('button', { name: 'Cemitério', exact: true });
  const end = (await grave.boundingBox())!;
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 8 });
  await expect(grave).toHaveAttribute('aria-current', 'true');
  await expect.poll(() => grave.evaluate(node => getComputedStyle(node).borderColor)).toBe('rgb(217, 169, 78)');
  await page.mouse.up();
  await expect(field.locator('[data-card-id]')).toHaveCount(0);
  await expect.poll(async () => (await read()).players[0].graveyardCount).toBe(2);
  current = await read();
  expect(current.players[0].graveyard?.map(card => card.id).sort()).toEqual([...ids].sort());
});

test('modo Selecionar soma toques e segurar inspeciona sem trocar a seleção', async ({ browser, baseURL }, info) => {
  test.skip(info.project.name !== 'desktop', 'Contexto de toque real criado uma vez pelo cenário.');
  test.setTimeout(60_000);
  const context = await browser.newContext({ baseURL, viewport: { width: 1024, height: 768 }, hasTouch: true });
  try {
    const page = await context.newPage();
    await table(context.request, page);
    const hand = page.getByRole('region', { name: 'Mão', exact: true });
    const cards = hand.getByRole('button', { name: 'Island', exact: true });
    await expect(page.getByRole('button', { name: 'Selecionar', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Selecionar', exact: true }).tap();
    await expect(page.getByRole('button', { name: 'Selecionar', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await cards.nth(0).tap();
    await cards.nth(1).tap();
    await expect(hand.locator('[aria-pressed="true"]')).toHaveCount(2);
    const rect = (await cards.nth(2).boundingBox())!;
    const session = await context.newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }] });
    const inspection = page.getByRole('dialog', { name: 'Imagem de Island', exact: true });
    await expect(inspection).toBeVisible();
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await session.detach();
    await expect(inspection).toBeVisible();
    await expect(hand.locator('[aria-pressed="true"]')).toHaveCount(2);
    await inspection.getByRole('button', { name: 'Fechar', exact: true }).tap();
    const bar = page.getByRole('toolbar', { name: 'Ações da seleção' });
    await bar.getByRole('button', { name: 'Jogar no campo', exact: true }).tap();
    await expect(page.locator('[data-battlefield-canvas] [data-card-id]')).toHaveCount(2);
  } finally { await context.close(); }
});

test('carta se move pendente antes da resposta real e volta se o servidor recusar', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'Gestos de mouse/teclado; toque exercitado pelo cenário específico.');
  test.setTimeout(60_000);
  const { read, path } = await table(page.request, page);
  const hand = page.getByRole('region', { name: 'Mão', exact: true });
  const id = (await read()).players[0].hand![0].id;
  const bar = page.getByRole('toolbar', { name: 'Ações da seleção' });
  await page.getByRole('button', { name: 'Selecionar', exact: true }).click();
  for (const accepted of [false, true]) {
    let release!: () => void;
    let arrived!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const sent = new Promise<void>(resolve => { arrived = resolve; });
    let inFlight = false;
    let settled!: () => void;
    const completed = new Promise<void>(resolve => { settled = resolve; });
    await page.route(`**${path}/actions`, async route => {
      const body = route.request().postDataJSON();
      if (body.kind !== 'move') { await route.continue(); return; }
      inFlight = true;
      arrived();
      await gate;
      // Only request latency/input is controlled. The real API decides both
      // success and refusal; no success/error response is fabricated here.
      try { await route.continue(accepted ? undefined : { postData: JSON.stringify({ ...body, to: 'zona-inexistente' }) }); } finally { settled(); }
    });
    try {
      if (await hand.locator(`[data-card-id="${id}"]`).getAttribute('aria-pressed') !== 'true') await hand.locator(`[data-card-id="${id}"]`).click();
      await bar.getByRole('button', { name: 'Cemitério', exact: true }).click();
      await sent;
      const pendingCard = page.getByRole('region', { name: 'Cemitério', exact: true }).locator(`[data-card-id="${id}"]`);
      await expect(pendingCard).toBeVisible();
      await expect(pendingCard).toHaveAttribute('data-pending', 'true');
      await expect(page.getByRole('status').filter({ hasText: 'Ação pendente' })).toBeVisible();
      expect((await read()).players[0].handCount).toBe(3);
      release();
      if (accepted) {
        await expect(pendingCard).toHaveAttribute('data-pending', 'false');
        expect((await read()).players[0].graveyard?.map(card => card.id)).toEqual([id]);
        await page.reload();
        await expect(pendingCard).toBeVisible();
      } else {
        await expect(hand.locator(`[data-card-id="${id}"]`)).toBeVisible();
        await expect(pendingCard).toHaveCount(0);
        await expect(page.getByRole('alert')).toContainText(/zona/i);
        expect((await read()).players[0].graveyardCount).toBe(0);
      }
    } finally { release(); if (inFlight) await completed; await page.unroute(`**${path}/actions`); }
  }
});
