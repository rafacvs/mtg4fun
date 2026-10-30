import { test, expect, openQuickActions, closeQuickActions, returnOpeningHandToLibrary, roomBody } from './fixtures';
import type { Browser, TestInfo } from '@playwright/test';

async function prepare(browser: Browser, baseURL: string | undefined, info: TestInfo) {
  const context = await browser.newContext({ baseURL, viewport: info.project.use.viewport, isMobile: info.project.use.isMobile, hasTouch: info.project.use.hasTouch });
  const api = context.request;
  await api.post('/api/session', { data: { login: 'amigo', password: 'senha-do-navegador' } });
  const { deck } = await (await api.post('/api/decks', { multipart: { file: { name: 'folha.cod', mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck version="1"><deckname>Folha</deckname><zone name="main"><card number="2" name="Island"/><card number="1" name="Fire // Ice"/><card number="1" name="Urza&#39;s Saga"/></zone></cockatrice_deck>') } } })).json();
  const { room } = await (await api.post('/api/rooms', { data: roomBody() })).json();
  await api.put(`/api/rooms/${room.id}/participants/me/ready`, { data: { deckId: deck.id } });
  expect((await api.post(`/api/rooms/${room.id}/start`, { data: {} })).status()).toBe(201);
  await returnOpeningHandToLibrary(api, room.id);
  const page = await context.newPage();
  await page.goto(`/#/salas/${room.id}`);
  const panel = page.getByRole('dialog', { name: 'Grimório', exact: true });
  const open = () => page.getByRole('button', { name: 'Abrir ações do grimório' }).click();
  const read = async () => {
    const { match } = await (await api.get(`/api/rooms/${room.id}/match`)).json();
    return match.players.find((player: { userId: number }) => player.userId === match.viewerId);
  };
  return { context, page, panel, open, read };
}

test('busca filtra, envia em duas etapas e só fecha pelos dois botões', async ({ browser, baseURL }, info) => {
  test.setTimeout(60_000);
  const game = await prepare(browser, baseURL, info);
  const { page, panel, open, read } = game;
  try {
    await open();
    await panel.getByRole('button', { name: 'Buscar no grimório', exact: true }).click();
    await expect(panel.locator('.search-card')).toHaveCount(4);
    await expect(panel.getByText('4 de 4 cartas')).toBeVisible();
    const types = panel.getByRole('group', { name: 'Filtrar por tipo' });
    await types.getByRole('button', { name: 'Terrenos', exact: true }).click();
    await expect(panel.locator('.search-card')).toHaveCount(3);
    await expect(panel.locator('.search-card').filter({ hasText: 'Fire // Ice' })).toHaveCount(0);
    await types.getByRole('button', { name: 'Todos', exact: true }).click();

    // No way out except the two buttons: no X, no Escape, no click outside, not even a reload.
    await expect(panel.getByRole('button', { name: /^(Minimizar consulta|Fechar painel do grimório)$/ })).toHaveCount(0);
    const closing = panel.getByRole('region', { name: 'Fechar a busca' });
    await expect(closing.getByRole('status')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(panel).toBeVisible();
    await expect(closing.getByRole('status')).toHaveText('A busca só fecha por um destes botões.');
    await page.mouse.click(3, 3);
    await expect(panel).toBeVisible();
    await page.reload();
    await expect(panel).toBeVisible();
    await expect(closing.getByRole('status')).toHaveCount(0);

    // Hand and battlefield have no position; ordered zones do.
    const step = panel.getByRole('region', { name: 'Ações da seleção' });
    const send = step.locator('.search-send');
    const top = step.getByRole('group', { name: 'Posição' }).getByRole('button', { name: 'Topo', exact: true });
    await expect(send).toBeDisabled();
    await expect(step.getByRole('button', { name: 'Mão', exact: true })).toBeDisabled();
    await panel.locator('.search-card').first().click();
    await expect(step).toContainText('1 selecionada');
    await expect(step).toContainText('Posição · não se aplica');
    await expect(top).toBeDisabled();
    await expect(send).toHaveText(/Enviar 1 carta\s*para a mão/);
    await step.getByRole('button', { name: 'Campo', exact: true }).click();
    await expect(top).toBeDisabled();
    await expect(send).toHaveText(/para o campo/);
    for (const name of ['Cemitério', 'Exílio', 'Grimório']) {
      await step.getByRole('button', { name, exact: true }).click();
      await expect(top).toBeEnabled();
    }
    await step.getByRole('button', { name: 'limpar seleção' }).click();
    await expect(step).toContainText('Nenhuma ainda');

    // A sent card leaves the search and the second step lights up.
    const order = ((await read()).consulted as { id: string; name: string }[]);
    await panel.locator(`[data-library-card-id="${order[0].id}"]`).click();
    await panel.locator(`[data-library-card-id="${order[1].id}"]`).click();
    await step.getByRole('button', { name: 'Cemitério', exact: true }).click();
    await step.getByRole('group', { name: 'Posição' }).getByRole('button', { name: 'Fundo', exact: true }).click();
    await expect(send).toHaveText(/Enviar 2 cartas\s*para o fundo do cemitério/);
    await send.click();
    await expect.poll(async () => ((await read()).graveyard ?? []).map((card: { id: string }) => card.id)).toEqual([order[0].id, order[1].id]);
    await expect(panel.locator('.search-card')).toHaveCount(2);
    await expect(closing.getByRole('status')).toBeVisible();
    await expect(panel.locator('.search-exit-hint')).toHaveClass(/attention/);
    await expect(panel).toBeVisible();

    await panel.locator(`[data-library-card-id="${order[2].id}"]`).click();
    await step.getByRole('button', { name: 'Mão', exact: true }).click();
    await send.click();
    await expect.poll(async () => (await read()).handCount).toBe(1);

    await closing.getByRole('button', { name: 'Fechar sem embaralhar', exact: true }).click();
    await expect(panel).not.toBeVisible();
    expect((await read()).consulting).toBe(false);
    expect((await read()).libraryCount).toBe(1);
  } finally { await game.context.close(); }
});

test('topo e fundo do grimório na busca valem depois de fechar sem embaralhar, e o arraste reordena', async ({ browser, baseURL }, info) => {
  test.skip(info.project.name !== 'desktop');
  test.setTimeout(60_000);
  const game = await prepare(browser, baseURL, info);
  const { page, panel, open, read } = game;
  try {
    await open();
    await panel.getByRole('button', { name: 'Buscar no grimório', exact: true }).click();
    await expect(panel.locator('.search-card')).toHaveCount(4);
    const ids = ((await read()).consulted as { id: string }[]).map(card => card.id);
    const step = panel.getByRole('region', { name: 'Ações da seleção' });
    const card = (id: string) => panel.locator(`[data-library-card-id="${id}"]`);
    await card(ids[3]).click();
    await step.getByRole('button', { name: 'Grimório', exact: true }).click();
    await expect(step.locator('.search-send')).toHaveText(/para o topo do grimório/);
    await step.locator('.search-send').click();
    await expect.poll(async () => (await read()).consulted.map((item: { id: string }) => item.id)).toEqual([ids[3], ids[0], ids[1], ids[2]]);
    await expect(panel.locator('.search-card-rank').first()).toHaveText('1');
    await expect(panel.locator('.selected')).toHaveCount(0);

    // Dragging the whole card shows the gap, the marker and the destination, without selecting it.
    const from = (await card(ids[0]).boundingBox())!, to = (await card(ids[2]).boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + 60);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + 60, { steps: 8 });
    await expect(card(ids[0])).toContainText('vaga da posição 2');
    await expect(card(ids[2])).toHaveClass(/drag-target/);
    await expect(panel.locator('.search-card-ghost')).toContainText('soltar na posição 4');
    await page.mouse.up();
    await expect.poll(async () => (await read()).consulted.map((item: { id: string }) => item.id)).toEqual([ids[3], ids[1], ids[2], ids[0]]);
    await expect(panel.locator('.selected')).toHaveCount(0);

    await panel.getByRole('button', { name: 'Fechar sem embaralhar', exact: true }).click();
    await expect(panel).not.toBeVisible();
    await open();
    await panel.getByRole('button', { name: 'Olhar cartas', exact: true }).click();
    await panel.getByLabel('Quantidade de cartas').fill('4');
    await panel.getByRole('button', { name: 'Olhar 4 cartas do topo', exact: true }).click();
    await expect.poll(async () => ((await read()).consulted ?? []).map((item: { id: string }) => item.id)).toEqual([ids[3], ids[1], ids[2], ids[0]]);
  } finally { await game.context.close(); }
});

test('ordena a faixa do topo, mostra posição do fundo e embaralha ao fechar', async ({ browser, baseURL }, info) => {
  test.setTimeout(60_000);
  const game = await prepare(browser, baseURL, info);
  const { panel, open, read } = game;
  try {
    await open();
    await panel.getByRole('button', { name: 'Olhar cartas', exact: true }).click();
    await panel.getByLabel('Quantidade de cartas').fill('2');
    await panel.getByRole('button', { name: 'Olhar 2 cartas do topo', exact: true }).click();
    const original = (await read()).consulted as { id: string; libraryPosition: number }[];
    expect(original.map(card => card.libraryPosition)).toEqual([1, 2]);
    const cards = panel.locator('.library-card');
    const boxes = await cards.evaluateAll(items => items.map(item => { const box = item.getBoundingClientRect(); return { x: box.x, y: box.y }; }));
    expect(boxes[1].x).toBeGreaterThan(boxes[0].x);
    expect(boxes[1].y).toBe(boxes[0].y);
    await cards.first().getByRole('button', { name: /^Reordenar/ }).press('ArrowRight');
    await expect.poll(async () => (await read()).consulted.map((card: { id: string }) => card.id)).toEqual([original[1].id, original[0].id]);
    await panel.getByRole('button', { name: 'Fechar sem embaralhar', exact: true }).click();
    await expect(panel).not.toBeVisible();
    await open();
    await panel.getByRole('button', { name: 'Olhar cartas', exact: true }).click();
    await panel.getByLabel('Quantidade de cartas').fill('2');
    await panel.getByRole('button', { name: 'Olhar 2 cartas do topo', exact: true }).click();
    expect((await read()).consulted.map((card: { id: string }) => card.id)).toEqual([original[1].id, original[0].id]);
    await panel.getByLabel('Destino das restantes').selectOption('bottom');
    await panel.getByRole('button', { name: 'Fechar sem embaralhar', exact: true }).click();
    await expect(panel).not.toBeVisible();
    await open();
    await panel.getByRole('button', { name: 'Olhar cartas', exact: true }).click();
    await panel.getByRole('radio', { name: 'Do fundo', exact: true }).check();
    await panel.getByLabel('Quantidade de cartas').fill('2');
    await panel.getByRole('button', { name: 'Olhar 2 cartas do fundo', exact: true }).click();
    expect((await read()).consulted.map((card: { libraryPosition: number }) => card.libraryPosition)).toEqual([3, 4]);
    await expect(cards.first()).toContainText('Posição 3');
    await panel.getByRole('button', { name: 'Embaralhar e fechar', exact: true }).click();
    await expect(panel).not.toBeVisible();
    expect((await read()).consulting).toBe(false);
    expect((await read()).libraryCount).toBe(4);
    await open();
    await expect(panel.getByRole('button', { name: 'Embaralhar', exact: true })).toBeEnabled();
  } finally { await game.context.close(); }
});
