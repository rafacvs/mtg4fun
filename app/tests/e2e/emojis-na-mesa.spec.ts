import { test, expect, roomBody, confirmHands } from './fixtures';

const password = 'senha-do-navegador';
const deck = { name: 'emojis.cod', mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck><zone name="main"><card number="20" name="Island"/></zone></cockatrice_deck>') };

test('emoji cai para todos na mesa, antes e depois de confirmar as mãos', async ({ page, browser, baseURL }, info) => {
  const guestContext = await browser.newContext({ baseURL, viewport: page.viewportSize() ?? undefined, hasTouch: info.project.use.hasTouch, isMobile: info.project.use.isMobile });
  const guest = await guestContext.newPage();
  try {
    for (const [client, login] of [[page, 'amigo'], [guest, 'segundo']] as const) expect((await client.request.post('/api/session', { data: { login, password } })).ok()).toBe(true);
    const { room } = await (await page.request.post('/api/rooms', { data: roomBody({ seats: 2 }) })).json();
    expect((await guest.request.post(`/api/rooms/${room.id}/participants`, { data: {} })).ok()).toBe(true);
    for (const client of [page, guest]) {
      const created = await (await client.request.post('/api/decks', { multipart: { file: deck } })).json();
      expect((await client.request.put(`/api/rooms/${room.id}/participants/me/ready`, { data: { deckId: created.deck.id } })).ok()).toBe(true);
    }
    expect((await page.request.post(`/api/rooms/${room.id}/start`, { data: {} })).status()).toBe(201);
    for (const client of [page, guest]) { await client.goto(`/#/salas/${room.id}`); await expect(client.getByRole('region', { name: 'Mesa da partida' })).toBeVisible(); }

    const toggle = page.getByRole('button', { name: 'Reagir com emoji' });
    const react = async (emoji: string) => {
      await toggle.click();
      await page.getByRole('button', { name: `Enviar ${emoji}` }).click();
      for (const viewer of [page, guest]) await expect(viewer.locator('.emoji-drop', { hasText: emoji }).locator('small')).toHaveText('Amigo da mesa');
      const tray = (await page.getByRole('group', { name: 'Escolha um emoji' }).boundingBox())!;
      expect(tray.x).toBeGreaterThanOrEqual(0);
      expect(tray.x + tray.width).toBeLessThanOrEqual(page.viewportSize()!.width);
      await toggle.click();
      await expect(page.getByRole('group', { name: 'Escolha um emoji' })).toHaveCount(0);
    };
    await react('🔥');

    await confirmHands(room.id, page.request, guest.request);
    await expect(page.getByRole('navigation', { name: 'Confirmação da mão' })).toHaveCount(0);
    await react('💀');

    // Os comandos da mesa continuam ao alcance com o botão de emoji na tela.
    const commands = page.getByRole('button', { name: info.project.name === 'desktop' ? 'Comprar' : 'Comandos', exact: true });
    const [own, other] = [(await toggle.boundingBox())!, (await commands.boundingBox())!];
    expect(own.x + own.width <= other.x || other.x + other.width <= own.x || own.y + own.height <= other.y || other.y + other.height <= own.y).toBe(true);
    await commands.click();
    await page.screenshot({ path: info.outputPath('mesa.png') });
  } finally { await guestContext.close(); }
});

test('quem assiste recebe e manda emojis para os jogadores', async ({ page, browser, baseURL }, info) => {
  const options = { baseURL, viewport: page.viewportSize() ?? undefined, hasTouch: info.project.use.hasTouch, isMobile: info.project.use.isMobile };
  const contexts = await Promise.all([browser.newContext(options), browser.newContext(options)]);
  const [player, other] = await Promise.all(contexts.map(context => context.newPage()));
  try {
    for (const [client, login] of [[player, 'amigo'], [other, 'segundo'], [page, 'amigo3']] as const) expect((await client.request.post('/api/session', { data: { login, password } })).ok()).toBe(true);
    const { room } = await (await player.request.post('/api/rooms', { data: roomBody({ seats: 2 }) })).json();
    expect((await other.request.post(`/api/rooms/${room.id}/participants`, { data: {} })).ok()).toBe(true);
    for (const client of [player, other]) {
      const created = await (await client.request.post('/api/decks', { multipart: { file: deck } })).json();
      expect((await client.request.put(`/api/rooms/${room.id}/participants/me/ready`, { data: { deckId: created.deck.id } })).ok()).toBe(true);
    }
    expect((await player.request.post(`/api/rooms/${room.id}/start`, { data: {} })).status()).toBe(201);
    await confirmHands(room.id, player.request, other.request);
    await player.goto(`/#/salas/${room.id}`);
    await page.goto(`/#/salas/${room.id}`);
    await expect(page.getByRole('tablist', { name: 'Escolher jogador' })).toBeVisible();

    const send = async (from: typeof page, emoji: string, name: string, to: typeof page) => {
      await from.getByRole('button', { name: 'Reagir com emoji' }).click();
      const tray = (await from.getByRole('group', { name: 'Escolha um emoji' }).boundingBox())!;
      expect(tray.x).toBeGreaterThanOrEqual(0);
      expect(tray.x + tray.width).toBeLessThanOrEqual(from.viewportSize()!.width);
      await from.getByRole('button', { name: `Enviar ${emoji}` }).click();
      await expect(to.locator('.emoji-drop', { hasText: emoji }).locator('small')).toHaveText(name);
    };
    await send(page, '🐐', 'Amigo 3', player);
    await page.screenshot({ path: info.outputPath('espectador.png') });
    await send(player, '🔥', 'Amigo da mesa', page);
  } finally { await Promise.all(contexts.map(context => context.close())); }
});

test('todos os emojis com pesquisa, e o tomate do botão direito suja a carta para todos', async ({ page, browser, baseURL }, info) => {
  test.setTimeout(60_000);
  const guestContext = await browser.newContext({ baseURL, viewport: page.viewportSize() ?? undefined, hasTouch: info.project.use.hasTouch, isMobile: info.project.use.isMobile });
  const guest = await guestContext.newPage();
  try {
    for (const [client, login] of [[page, 'amigo'], [guest, 'segundo']] as const) expect((await client.request.post('/api/session', { data: { login, password } })).ok()).toBe(true);
    const { room } = await (await page.request.post('/api/rooms', { data: roomBody({ seats: 2 }) })).json();
    expect((await guest.request.post(`/api/rooms/${room.id}/participants`, { data: {} })).ok()).toBe(true);
    for (const client of [page, guest]) {
      const created = await (await client.request.post('/api/decks', { multipart: { file: deck } })).json();
      expect((await client.request.put(`/api/rooms/${room.id}/participants/me/ready`, { data: { deckId: created.deck.id } })).ok()).toBe(true);
    }
    expect((await page.request.post(`/api/rooms/${room.id}/start`, { data: {} })).status()).toBe(201);
    await confirmHands(room.id, page.request, guest.request);
    // No celular só o próprio campo aparece: lá o alvo é a própria carta; no desktop, a do outro.
    const thrower = info.project.use.hasTouch ? page.request : guest.request;
    const { match } = await (await thrower.get(`/api/rooms/${room.id}/match`)).json();
    const target = match.players.find((player: { userId: number }) => player.userId === match.viewerId).hand[0].id;
    expect((await thrower.post(`/api/rooms/${room.id}/match/actions`, { data: { intentId: crypto.randomUUID(), kind: 'move', cardIds: [target], to: 'battlefield' } })).ok()).toBe(true);
    for (const client of [page, guest]) await client.goto(`/#/salas/${room.id}`);

    await page.getByRole('button', { name: 'Reagir com emoji' }).click();
    await page.getByRole('button', { name: 'Todos os emojis' }).click();
    const picker = page.getByRole('dialog', { name: 'Todos os emojis' });
    await expect(picker.getByRole('region', { name: 'Bandeiras' })).toBeVisible();
    const box = (await picker.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    expect(box.y).toBeGreaterThanOrEqual(0);
    await page.screenshot({ path: info.outputPath('todos-os-emojis.png') });
    // A pesquisa ignora acentos e encontra pelos nomes em português.
    await picker.getByRole('searchbox', { name: 'Pesquisar emoji' }).fill('suico');
    await picker.getByRole('button', { name: /^Enviar 🧀/ }).click();
    for (const viewer of [page, guest]) await expect(viewer.locator('.emoji-drop', { hasText: '🧀' }).locator('small')).toHaveText('Amigo da mesa');
    await picker.getByRole('searchbox', { name: 'Pesquisar emoji' }).fill('nada disso existe');
    await expect(picker.getByText('Nenhum emoji para “nada disso existe”.')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(picker).toHaveCount(0);

    await page.getByRole('button', { name: 'Enviar 🍅' }).click({ button: 'right' });
    await expect(page.getByRole('status').filter({ hasText: 'Clique nas cartas do campo para tacar tomates' })).toBeVisible();
    await expect(page.locator('body')).toHaveClass(/tomato-aiming/);
    const card = page.locator(`.zone-battlefield [data-card-id="${target}"]`);
    await card.click();
    for (const viewer of [page, guest]) {
      const splat = viewer.locator(`[data-card-id="${target}"] .tomato-splat`);
      if (viewer === page || !info.project.use.hasTouch) await expect(splat).toHaveCount(1);
    }
    await page.waitForTimeout(500);
    await page.screenshot({ path: info.outputPath('tomate.png') });
    // A mira continua: dá para tacar de novo sem voltar à barra, e clicar fora não desliga.
    await expect(page.locator('body')).toHaveClass(/tomato-aiming/);
    const spot = (await card.boundingBox())!;
    await page.mouse.click(spot.x + spot.width + 40, spot.y + spot.height / 2);
    await expect(page.locator('body')).toHaveClass(/tomato-aiming/);
    await card.click();
    await expect(page.locator(`[data-card-id="${target}"] .tomato-splat`)).toHaveCount(2);
    await page.waitForTimeout(700);
    await card.screenshot({ path: info.outputPath('dois-tomates.png') });
    // Mirar não abre a carta, e a sujeira some sozinha.
    await expect(page.locator('.card-preview[role="dialog"]')).toHaveCount(0);
    await expect(page.locator('.tomato-splat')).toHaveCount(0, { timeout: 4000 });

    // Só o botão direito guarda a mira.
    await page.mouse.click(20, 200, { button: 'right' });
    await expect(page.locator('body')).not.toHaveClass(/tomato-aiming/);
    await expect(page.getByRole('status').filter({ hasText: 'Botão direito para parar' })).toHaveCount(0);
    await page.waitForTimeout(1300);
    await card.click();
    await expect(page.locator('.card-preview[role="dialog"]')).toBeVisible();
    await expect(guest.locator('.tomato-splat')).toHaveCount(0);
  } finally { await guestContext.close(); }
});
