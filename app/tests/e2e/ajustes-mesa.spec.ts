import { test, expect } from './fixtures';
import type { APIRequestContext, BrowserContext } from '@playwright/test';
import type { Match } from '../../src/features/rooms/roomsApi';

async function prepare(api: APIRequestContext, other: APIRequestContext) {
  let roomId = 0;
  const decks: { request: APIRequestContext; id: number }[] = [];
  for (const [index, request] of [api, other].entries()) {
    expect((await request.post('/api/session', { data: { login: index ? 'segundo' : 'amigo', password: 'senha-do-navegador' } })).ok()).toBe(true);
    const upload = await request.post('/api/decks', { multipart: { file: { name: 'cenarios.cod', mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck><zone name="main"><card number="32" name="Island"/></zone></cockatrice_deck>') } } });
    expect(upload.status()).toBe(201);
    const { deck } = await upload.json();
    if (!roomId) roomId = (await (await request.post('/api/rooms', { data: {} })).json()).room.id;
    else expect((await request.post(`/api/rooms/${roomId}/participants`, { data: {} })).ok()).toBe(true);
    expect((await request.put(`/api/rooms/${roomId}/participants/me/ready`, { data: { deckId: deck.id } })).ok()).toBe(true);
    decks.push({ request, id: deck.id });
  }
  expect((await api.post(`/api/rooms/${roomId}/start`, { data: {} })).status()).toBe(201);
  for (const {request, id} of decks) expect((await request.delete(`/api/decks/${id}`)).status()).toBe(204);
  const action = async (fields: Record<string, unknown>, request = api): Promise<Match> => {
    const result = await request.post(`/api/rooms/${roomId}/match/actions`, { data: { intentId: crypto.randomUUID(), ...fields } });
    expect(result.ok(), await result.text()).toBe(true);
    return (await result.json()).match;
  };
  const read = async (): Promise<Match> => (await (await api.get(`/api/rooms/${roomId}/match`)).json()).match;
  const drawn = await action({ kind: 'draw', count: 22 });
  const cards = drawn.players.find(p => p.userId === drawn.viewerId)!.hand!;
  await action({ kind: 'move', cardIds: [cards[0].id], to: 'command' });
  return { roomId, action, read, cards: cards.slice(1) };
}

for (const scenario of ['revelações e ações rápidas', 'pilhas, linhas e painel de carta']) {
  test(scenario, async ({ page, browser, baseURL }, info) => {
    test.skip(info.project.name === 'celular', 'Mesa em orientação horizontal.');
    test.setTimeout(90_000);
    const observer: BrowserContext = await browser.newContext({ baseURL });
    try {
      const { roomId, action, read, cards } = await prepare(page.request, observer.request);
      // Only the image source is controlled. Every state change hits the real API.
      await page.route('**/api/cards/image?*', route => route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 63 88"><rect width="63" height="88" fill="#31573e"/><text x="6" y="44" fill="white" font-size="8">Island</text></svg>' }));
      const article = page.getByRole('article', { name: 'Mesa de Amigo da mesa', exact: true });
      const hand = page.getByRole('region', { name: 'Mão', exact: true });
      const preview = page.getByRole('dialog', { name: 'Imagem de Island', exact: true });
      const own = (m: Match) => m.players.find(p => p.userId === m.viewerId)!;
      if (scenario === 'revelações e ações rápidas') {
        await action({ kind: 'move', cardIds: [cards[0].id], to: 'battlefield' });
        await action({ kind: 'set_tapped', cardIds: [cards[0].id], tapped: true });
        await page.goto(`/#/salas/${roomId}`);
        await expect(article).toBeVisible();
        const commander = article.getByRole('region', { name: 'Comando', exact: true });
        const bounds = await commander.boundingBox();
        await hand.getByRole('button', { name: 'Island', exact: true }).first().click();
        await expect(preview).toBeVisible();
        await expect(article.getByRole('region', { name: /Cartas reveladas/ })).toHaveCount(0);
        await preview.getByRole('button', { name: 'Revelar para todos', exact: true }).click();
        await expect(article.getByRole('region', { name: /Cartas reveladas/ })).toBeVisible();
        expect(await commander.boundingBox()).toEqual(bounds);
        await preview.getByRole('button', { name: 'Fechar', exact: true }).click();
        await expect(preview).toHaveCount(0);
        await expect(article.getByRole('region', { name: /Cartas reveladas/ })).toHaveCount(0);
        await hand.getByRole('button', { name: 'Island', exact: true }).first().click();
        await preview.getByRole('button', { name: 'Revelar para todos', exact: true }).click();
        // Lose both automatic confirmations after the real server hides the card.
        // Retrying inside the modal must reuse the intent and restore its state.
        let lost = 0;
        await page.route('**/match/actions', async route => {
          const body = route.request().postDataJSON();
          if (body.kind === 'reveal_cards' && !body.revealed && lost < 2) {
            lost++; await route.fetch(); await route.abort('failed');
          } else await route.continue();
        });
        await preview.getByRole('button', { name: 'Fechar', exact: true }).click();
        await expect(preview.getByRole('alert')).toContainText('Não foi possível confirmar');
        await preview.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
        await expect(preview.getByRole('button', { name: 'Revelar para todos', exact: true })).toBeEnabled();
        await preview.getByRole('button', { name: 'Revelar para todos', exact: true }).click();
        await preview.getByLabel('Manter revelada ao fechar (até passar o turno)').check();
        await preview.getByRole('button', { name: 'Fechar', exact: true }).click();
        await expect(article.getByRole('region', { name: /Cartas reveladas/ })).toBeVisible();
        await page.keyboard.press('h');
        await expect(article.getByRole('region', { name: /Cartas reveladas/ })).toHaveCount(0);
        expect(await commander.boundingBox()).toEqual(bounds);
        await action({ kind: 'reveal_cards', cardIds: cards.slice(1, 4).map(c => c.id), revealed: true });
        await article.getByRole('button', { name: 'Ocultar todas reveladas', exact: true }).click();
        await expect.poll(async () => own(await read()).exposedCards?.length ?? 0).toBe(0);
        const beforeDraw = own(await read()).handCount;
        await article.getByRole('button', { name: 'Abrir ações do grimório', exact: true }).dblclick();
        await expect.poll(async () => own(await read()).handCount).toBe(beforeDraw + 1);
        await page.waitForTimeout(600);
        expect(own(await read()).handCount).toBe(beforeDraw + 1);
        await expect(page.getByRole('dialog', { name: 'Grimório', exact: true })).toHaveCount(0);
        await page.keyboard.press('d');
        await expect.poll(async () => own(await read()).handCount).toBe(beforeDraw + 2);
        await page.keyboard.press('u');
        await expect.poll(async () => own(await read()).battlefield![0].tapped ?? false).toBe(false);
        const otherDraw = await action({ kind: 'draw', count: 1 }, observer.request);
        const otherHand = otherDraw.players.find(p => p.userId === otherDraw.viewerId)!.hand!;
        await action({ kind: 'reveal_cards', cardIds: [otherHand[0].id], revealed: true }, observer.request);
        await action({ kind: 'reveal_cards', cardIds: [cards[1].id], revealed: true });
        const beforeTurn = await read();
        await page.keyboard.press('n');
        await expect.poll(async () => (await read()).log.at(-1)?.kind).toBe('turn');
        const afterTurn = await read();
        for (const p of afterTurn.players) {
          expect(p.exposedCards?.length ?? 0).toBe(0);
          const prior = beforeTurn.players.find(q => p.userId === q.userId)!;
          for (const key of ['commandCount', 'libraryCount', 'handCount', 'battlefieldCount'] as const) expect(p[key]).toBe(prior[key]);
        }
        await page.getByRole('button', { name: '↓ Comprar', exact: true }).click();
        await expect.poll(async () => own(await read()).handCount).toBe(beforeDraw + 3);
        await page.getByRole('button', { name: '↺ Desvirar todas', exact: true }).click();
        await expect.poll(async () => (await read()).log.at(-1)?.kind).toBe('untap_all');
        await page.getByRole('button', { name: '→ Passar turno', exact: true }).click();
        await expect.poll(async () => (await read()).log.at(-1)?.kind).toBe('turn');
      } else {
        const fieldCards = cards.slice(0, 18);
        await action({ kind: 'move', cardIds: fieldCards.map(c => c.id), to: 'battlefield' });
        // Seed: 2 stacked, 3 stacked, 1 upright + 2 tapped, neighbor and full row.
        for (const [index, card] of fieldCards.entries()) {
          const row = index < 5 ? 0 : index < 9 ? 1 : 2;
          const x = index < 2 ? 0 : index < 5 ? 160 : index < 8 ? 0 : index === 8 ? 120 : (index - 9) * 120;
          await action({ kind: 'position', cardId: card.id, x, row });
        }
        await action({ kind: 'set_tapped', cardIds: [fieldCards[6].id, fieldCards[7].id], tapped: true });
        await page.goto(`/#/salas/${roomId}`);
        await page.getByRole('button', { name: 'Ampliar mesa de Amigo da mesa', exact: true }).click();
        const field = article.getByRole('region', { name: 'Campo', exact: true });
        await expect(field.locator('[data-row="0"][data-stack-size="2"]')).toHaveCount(2);
        await expect(field.locator('[data-row="0"][data-stack-size="3"]')).toHaveCount(3);
        await expect(field.locator('[data-row="1"] .playing-card[data-tapped="true"]')).toHaveCount(2);
        const mixed = await field.locator('[data-row="1"][data-pos-x="0"] .playing-card').evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; }));
        const neighbor = await field.locator('[data-row="1"][data-pos-x="120"] .playing-card').boundingBox();
        expect(neighbor!.x).toBeGreaterThan(Math.max(...mixed.map(r => r.right)));
        const dimensions = await field.locator('.battlefield-scroll').evaluate(node => ({ content: node.scrollWidth, visible: node.clientWidth }));
        expect(dimensions.content).toBeGreaterThan(dimensions.visible);
        await field.locator('.battlefield-scroll').evaluate(node => { node.scrollLeft = node.scrollWidth; node.scrollTop = 200; });
        await expect(field.locator('[data-row="2"]').last()).toBeInViewport();
        await field.locator('.battlefield-scroll').evaluate(node => { node.scrollLeft = 0; node.scrollTop = 0; });
        await page.screenshot({ path: info.outputPath('campo-cenarios.png'), fullPage: true });
        const railToggle = page.getByRole('button', { name: /Recolher registro|Jogadores \/ Registro/ });
        if (await railToggle.getAttribute('aria-expanded') === 'false') await railToggle.click();
        await expect(page.getByRole('region', { name: 'Registro da partida' })).toBeVisible();
        await railToggle.click();
        await expect(page.getByRole('region', { name: 'Registro da partida' })).toBeHidden();
        await expect(page.locator('.table-toolbar')).toHaveCSS('height', '40px');
        await field.getByRole('button', { name: 'Island', exact: true }).first().click({ position: { x: 4, y: 4 } });
        await expect(preview).toBeVisible();
        const input = preview.getByLabel('Poder', { exact: true });
        await expect(input).toBeFocused();
        await input.fill('-3'); await input.press('Enter');
        await expect.poll(async () => own(await read()).battlefield!.find(c => c.id === fieldCards[0].id)?.power).toBe(-3);
        const handCount = own(await read()).handCount;
        await input.press('d');
        expect(own(await read()).handCount).toBe(handCount);
        await input.fill('1.5');
        await expect(input).toHaveAttribute('aria-invalid', 'true');
        await input.press('Enter');
        expect(own(await read()).battlefield![0].power).toBe(-3);
        await input.fill('-3');
        await preview.getByRole('button', { name: 'Marcador', exact: true }).click();
        const red = preview.getByRole('spinbutton', { name: 'marcador vermelho', exact: true });
        await expect(red).toBeFocused();
        await red.fill('-7'); await red.press('Enter');
        await expect.poll(async () => own(await read()).battlefield![0].markers?.red).toBe(-7);
        await preview.getByRole('button', { name: 'Aumentar marcador vermelho', exact: true }).click();
        await expect.poll(async () => own(await read()).battlefield![0].markers?.red).toBe(-6);
        await preview.getByRole('button', { name: 'Diminuir marcador vermelho', exact: true }).click();
        await expect.poll(async () => own(await read()).battlefield![0].markers?.red).toBe(-7);
        const imageBox = await preview.locator('img').boundingBox();
        const actionBox = await preview.locator('.card-preview-actions').boundingBox();
        expect(actionBox!.x).toBeGreaterThanOrEqual(imageBox!.x + imageBox!.width);
        await page.screenshot({ path: info.outputPath('painel-carta.png'), fullPage: true });
      }
    } finally { await observer.close(); }
  });
}
