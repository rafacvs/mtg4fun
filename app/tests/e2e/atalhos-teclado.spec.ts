import { test, expect, confirmHands, roomBody } from './fixtures';
import type { Match } from '../../src/features/rooms/roomsApi';

test('atalhos personalizados, consulta, seleção e comandos usam a mesa/API reais', async ({ page, browser, baseURL }, info) => {
  test.skip(info.project.name !== 'desktop', 'A ordem de foco por teclado é validada no desktop.');
  test.setTimeout(120_000);
  const opponent = await browser.newContext({ baseURL });
  try {
    const apis = [page.request, opponent.request];
    const deckIds: number[] = [];
    let roomId = 0;
    for (const [index, request] of apis.entries()) {
      const login = await request.post('/api/session', { data: { login: index ? 'segundo' : 'amigo', password: 'senha-do-navegador' } });
      expect(login.ok()).toBe(true);
      const upload = await request.post('/api/decks', { multipart: { file: { name: 'atalhos.cod', mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck><zone name="main"><card number="32" name="Island"/></zone></cockatrice_deck>') } } });
      expect(upload.status()).toBe(201);
      const { deck } = await upload.json();
      deckIds.push(deck.id);
      if (!roomId) roomId = (await (await request.post('/api/rooms', { data: roomBody({ name: `Atalhos ${Date.now()}`, seats: 2 }) })).json()).room.id;
      else expect((await request.post(`/api/rooms/${roomId}/participants`, { data: {} })).ok()).toBe(true);
      expect((await request.put(`/api/rooms/${roomId}/participants/me/ready`, { data: { deckId: deck.id } })).ok()).toBe(true);
    }
    expect((await page.request.post(`/api/rooms/${roomId}/start`, { data: {} })).status()).toBe(201);
    await confirmHands(roomId, ...apis);
    for (const [index, request] of apis.entries()) expect((await request.delete(`/api/decks/${deckIds[index]}`)).status()).toBe(204);

    const read = async (): Promise<Match> => (await (await page.request.get(`/api/rooms/${roomId}/match`)).json()).match;
    const own = (match: Match) => match.players.find(player => player.userId === match.viewerId)!;
    const sentActions: { kind: string }[] = [];
    page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/match/actions')) sentActions.push(request.postDataJSON()); });
    const act = async (fields: Record<string, unknown>) => {
      const response = await page.request.post(`/api/rooms/${roomId}/match/actions`, { data: { intentId: crypto.randomUUID(), ...fields } });
      expect(response.ok(), await response.text()).toBe(true);
      return (await response.json()).match as Match;
    };

    await page.goto(`/#/salas/${roomId}`);
    await expect(page.locator('.own-dock')).toBeVisible();
    let state = await read();
    let beforeHand = own(state).handCount;

    // K edits a binding, which survives reload and drives the same public draw action.
    await page.keyboard.press('k');
    const shortcuts = page.getByRole('dialog', { name: 'Ajuda e atalhos' });
    await expect(shortcuts).toBeVisible();
    const drawBinding = shortcuts.getByRole('textbox', { name: 'Atalho: Comprar uma carta' });
    await drawBinding.fill('U'); await drawBinding.press('Tab');
    await expect(shortcuts.getByRole('alert')).toContainText('já está atribuído');
    await drawBinding.fill('Q'); await drawBinding.press('Tab');
    await expect(shortcuts.getByRole('alert')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Comprar', exact: true })).toHaveAttribute('title', 'Comprar uma carta (Q)');
    await page.keyboard.press('q');
    await expect.poll(async () => own(await read()).handCount).toBe(beforeHand + 1);
    await page.reload();
    await expect(page.locator('.own-dock')).toBeVisible();
    await page.keyboard.press('k');
    await expect(page.getByRole('textbox', { name: 'Atalho: Comprar uma carta' })).toHaveValue('Q');
    await page.evaluate(() => localStorage.setItem('mtg4fun.match.shortcuts.v1', '{'));
    await page.reload(); await expect(page.locator('.own-dock')).toBeVisible();
    await page.keyboard.press('k');
    await expect(page.getByRole('textbox', { name: 'Atalho: Comprar uma carta' })).toHaveValue('D');
    await page.getByRole('button', { name: 'Restaurar padrões' }).click();
    await page.keyboard.press('Escape');

    // G opens the menu; numeric 1 begins Comprar and focuses a valid quantity.
    await page.keyboard.press('g');
    const library = page.getByRole('dialog', { name: 'Grimório', exact: true });
    await expect(library).toBeVisible();
    await page.keyboard.press('4');
    await expect(library.getByRole('button', { name: 'Olhar 1 carta do topo' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(library.getByRole('button', { name: 'Comprar cartas', exact: true })).toBeVisible();
    await page.keyboard.press('1');
    const quantity = library.getByRole('spinbutton', { name: 'Quantidade de cartas' });
    await expect(quantity).toBeFocused();
    await quantity.fill('7'); await quantity.press('Enter');
    await expect.poll(async () => own(await read()).handCount).toBe(beforeHand + 8);
    await page.keyboard.press('g');
    await expect(library).toHaveCount(0);

    // Real cards navigate, select, tap, and move with the approved bindings.
    state = await read();
    const handCards = own(state).hand ?? [];
    await act({ kind: 'move', cardIds: [handCards[0].id, handCards[1].id], to: 'battlefield' });
    await expect(page.locator(`[data-field-owner="${state.viewerId}"].zone-battlefield .playing-card`)).toHaveCount(2);
    await page.keyboard.press('c');
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus.playing-card');
    await expect(focused).toBeVisible();
    const focusedCardId = await focused.getAttribute('data-card-id');
    await page.keyboard.press('Enter');
    await expect(page.locator(`.playing-card[data-card-id="${focusedCardId}"]`)).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('t');
    await expect.poll(() => sentActions.filter(action => action.kind === 'set_tapped').length).toBe(1);
    await expect.poll(async () => (await read()).players.flatMap(player => player.battlefield ?? []).find(card => card.id === focusedCardId)?.tapped).toBe(true);
    await expect(page.locator(`.playing-card[data-card-id="${focusedCardId}"]`)).toHaveAttribute('data-tapped', 'true');
    await page.keyboard.press('u');
    await expect.poll(async () => (await read()).players.flatMap(player => player.battlefield ?? []).find(card => card.id === focusedCardId)?.tapped).not.toBe(true);
    await page.keyboard.press('h');
    await expect.poll(async () => (await read()).players.flatMap(player => player.hand ?? []).some(card => card.id === focusedCardId)).toBe(true);
    await expect(page.locator(`.playing-card[data-card-id="${focusedCardId}"]`)).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('m');
    const destinations = page.getByRole('dialog', { name: 'Destinos da seleção' });
    await expect(destinations).toBeVisible();
    await page.keyboard.press('1');
    await expect.poll(async () => (await read()).players.flatMap(player => player.battlefield ?? []).some(card => card.id === focusedCardId)).toBe(true);
    await expect(destinations).toHaveCount(0);
    await expect(page.locator(`.playing-card[data-card-id="${focusedCardId}"]`)).toHaveAttribute('aria-pressed', 'true');

    await page.keyboard.press('b');
    await expect(page.getByRole('article', { name: 'Mesa de Amigo da mesa', exact: true })).toHaveClass(/focused-table/);
    await page.keyboard.press('n');
    await expect(page.getByRole('article', { name: 'Mesa de Segundo amigo', exact: true })).toHaveClass(/focused-table/);
    await page.keyboard.press('Shift+n');
    await expect(page.getByRole('article', { name: 'Mesa de Amigo da mesa', exact: true })).toHaveClass(/focused-table/);
    await page.keyboard.press('o');
    await page.keyboard.press('b');
    await expect(page.getByRole('article', { name: 'Mesa de Amigo da mesa', exact: true })).toHaveClass(/focused-table/);

    // Zone keys toggle and Escape closes the other viewers.
    await page.keyboard.press('j');
    await expect(page.getByRole('dialog', { name: /Cemitério de/ })).toBeVisible();
    await page.keyboard.press('j');
    await expect(page.getByRole('dialog', { name: /Cemitério de/ })).toHaveCount(0);
    await page.keyboard.press('x');
    await expect(page.getByRole('dialog', { name: /Exílio de/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: /Exílio de/ })).toHaveCount(0);

    // Search stays active until one of its explicit finalization choices is used.
    await page.keyboard.press('g'); await page.keyboard.press('5');
    const search = page.getByRole('dialog', { name: 'Grimório' });
    await expect(search.getByRole('heading', { name: 'Buscar no grimório' })).toBeVisible();
    state = await read(); beforeHand = own(state).handCount;
    const searchInput = search.getByRole('textbox', { name: 'Buscar no grimório' });
    await searchInput.click(); await searchInput.press('d');
    await expect.poll(async () => own(await read()).handCount).toBe(beforeHand);
    await page.keyboard.press('g');
    await expect(search).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(search).toBeVisible();
    await expect(search.getByText('A busca só fecha por um destes botões.')).toBeVisible();
    await search.getByRole('button', { name: 'Fechar sem embaralhar' }).click();
    await expect(search).toHaveCount(0);
    beforeHand = own(await read()).handCount;
    await page.keyboard.press('d');
    await expect.poll(async () => own(await read()).handCount).toBe(beforeHand + 1);

    // Turn correction and command panels remain connected to their existing actions.
    const current = (await read()).currentTurn.userId;
    await page.keyboard.press('Space');
    await expect.poll(async () => (await read()).currentTurn.userId).not.toBe(current);
    await page.keyboard.press('Shift+Space');
    await expect.poll(async () => (await read()).currentTurn.userId).toBe(current);
    await page.keyboard.press('r');
    await expect(page.getByRole('dialog', { name: 'Ações do jogo' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.keyboard.press('f');
    await expect(page.getByRole('dialog', { name: 'Ações do jogo' })).toContainText('Criar ficha');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Ações do jogo' })).toContainText('Rolar dado');
    await page.keyboard.press('Escape');
    await page.keyboard.press('v');
    await expect(page.getByRole('dialog', { name: /Jogador/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.keyboard.press('e');
    await expect(page.getByRole('toolbar', { name: 'Reações' })).toContainText('😂');

    await page.evaluate(() => document.addEventListener('mtg4fun:chat-shortcut', event => (window as Window & { shortcutEvents?: string[] }).shortcutEvents?.push((event as CustomEvent<{ action: string }>).detail.action)));
    await page.evaluate(() => { (window as Window & { shortcutEvents?: string[] }).shortcutEvents = []; });
    await page.keyboard.press('z');
    await expect.poll(() => page.evaluate(() => (window as Window & { shortcutEvents?: string[] }).shortcutEvents)).toEqual(['open']);
    await expect(page.getByRole('textbox', { name: 'Mensagem' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Abrir chat' })).toBeVisible();
    await page.keyboard.down('z'); await page.waitForTimeout(300); await page.keyboard.up('z');
    await expect.poll(() => page.evaluate(() => (window as Window & { shortcutEvents?: string[] }).shortcutEvents)).toEqual(['open', 'hold', 'release']);
  } finally { await opponent.close(); }
});
