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

test('busca em grade por tipo e conserva seleção ao minimizar a folha', async ({ browser, baseURL }, info) => {
  test.setTimeout(60_000);
  const game = await prepare(browser, baseURL, info);
  const { page, panel, open, read } = game;
  try {
    await open();
    await panel.getByRole('button', { name: 'Buscar no grimório', exact: true }).click();
    await expect(panel.locator('.library-card')).toHaveCount(4);
    await panel.getByLabel('Filtrar por tipo').selectOption('Land');
    await expect(panel.locator('.library-card')).toHaveCount(3);
    await expect(panel.locator('.library-card').filter({ hasText: 'Fire // Ice' })).toHaveCount(0);
    const boxes = await panel.locator('.library-card').evaluateAll(cards => cards.map(card => { const box = card.getBoundingClientRect(); return { x: box.x, y: box.y }; }));
    expect(boxes[0].y).toBe(boxes[1].y);
    expect(boxes[1].x).toBeGreaterThan(boxes[0].x);
    await panel.locator('.library-card').first().locator('strong').click();
    const selectedId = await panel.locator('.library-card.selected').getAttribute('data-library-card-id');
    await expect(panel.getByRole('region', { name: 'Ações da seleção' })).toContainText('1 selecionada');
    for (const name of ['Mão', 'Campo', 'Cemitério', 'Exílio', 'Topo', 'Fundo', 'Revelar']) await expect(panel.getByRole('region', { name: 'Ações da seleção' }).getByRole('button', { name, exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath('folha-busca.png') });
    await panel.getByRole('button', { name: 'Minimizar consulta', exact: true }).click();
    await expect(panel).not.toBeVisible();
    expect((await read()).libraryCount).toBe(4);
    expect((await read()).consulting).toBe(true);
    await openQuickActions(page);
    await expect(page.getByRole('button', { name: 'Comprar', exact: true }).first()).toBeDisabled();
    await closeQuickActions(page);
    await open();
    await expect(panel.locator(`[data-library-card-id="${selectedId}"]`)).toHaveClass(/selected/);
    await panel.getByRole('region', { name: 'Ações da seleção' }).getByRole('button', { name: 'Mão', exact: true }).click();
    await expect.poll(async () => (await read()).handCount).toBe(1);
    expect((await read()).libraryCount).toBe(3);
    await panel.getByRole('button', { name: 'Fechar sem embaralhar', exact: true }).click();
    await expect(panel).not.toBeVisible();
    expect((await read()).consulting).toBe(false);
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
    await panel.getByRole('button', { name: 'Olhar 2 carta(s)', exact: true }).click();
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
    await panel.getByRole('button', { name: 'Olhar 2 carta(s)', exact: true }).click();
    expect((await read()).consulted.map((card: { id: string }) => card.id)).toEqual([original[1].id, original[0].id]);
    await panel.getByLabel('Destino das restantes').selectOption('bottom');
    await panel.getByRole('button', { name: 'Fechar sem embaralhar', exact: true }).click();
    await expect(panel).not.toBeVisible();
    await open();
    await panel.getByRole('button', { name: 'Olhar cartas', exact: true }).click();
    await panel.getByLabel('De onde').selectOption('bottom');
    await panel.getByLabel('Quantidade de cartas').fill('2');
    await panel.getByRole('button', { name: 'Olhar 2 carta(s)', exact: true }).click();
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
