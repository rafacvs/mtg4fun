import { test, expect, roomBody } from './fixtures';

test('criador configura regras sincronizadas e a partida usa os valores salvos', async ({ page, browser, baseURL }, info) => {
  test.skip(info.project.name !== 'desktop', 'O fluxo móvel é coberto em preparacao-mobile.spec.ts.');
  test.setTimeout(90_000);
  const context = await browser.newContext({ baseURL });
  try {
    const guest = await context.newPage();
    const login = async (client: typeof page, name: string) => expect((await client.request.post('/api/session', { data: { login: name, password: 'senha-do-navegador' } })).ok()).toBe(true);
    await login(page, 'amigo'); await login(guest, 'segundo');
    for (const client of [page, guest]) {
      const response = await client.request.post('/api/decks', { multipart: { file: { name: 'regras.cod', mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck><deckname>Deck de regras</deckname><zone name="main"><card number="8" name="Island"/></zone></cockatrice_deck>') } } });
      expect(response.status()).toBe(201);
      const { deck } = await response.json();
      expect((await client.request.put(`/api/decks/${deck.id}/commander`, { data: { name: 'Island' } })).ok()).toBe(true);
    }
    const { room } = await (await page.request.post('/api/rooms', { data: roomBody() })).json();
    expect((await guest.request.post(`/api/rooms/${room.id}/participants`, { data: {} })).ok()).toBe(true);
    await Promise.all([page.goto(`/#/salas/${room.id}`), guest.goto(`/#/salas/${room.id}`)]);
    const rules = page.getByRole('region', { name: 'Regras da mesa' });
    const guestRules = guest.getByRole('region', { name: 'Regras da mesa' });
    const life = rules.getByRole('spinbutton', { name: 'Vida inicial' });
    const commander = rules.getByRole('switch', { name: 'Comandante na zona de comando' });
    const draw = rules.getByRole('switch', { name: 'Comprar até 7 cartas' });
    await expect(commander).toHaveAttribute('aria-checked', 'true');
    await expect(draw).toHaveAttribute('aria-checked', 'true');
    await expect(guestRules.getByRole('button', { name: 'Vida inicial: 40' })).toBeDisabled();
    await expect(guestRules.getByRole('button', { name: 'Aumentar vida inicial' })).toBeDisabled();
    await expect(guestRules.getByRole('switch', { name: 'Comprar até 7 cartas' })).toBeDisabled();
    expect((await guest.request.patch(`/api/rooms/${room.id}/settings`, { data: { life: 99 } })).status()).toBe(403);
    expect((await page.request.patch(`/api/rooms/${room.id}/settings`, { data: { life: 0 } })).status()).toBe(400);
    expect((await page.request.patch(`/api/rooms/${room.id}/settings`, { data: { life: 2.5 } })).status()).toBe(400);
    expect((await page.request.patch(`/api/rooms/${room.id}/settings`, { data: { drawOpeningHand: 'false' } })).status()).toBe(400);
    await rules.getByRole('button', { name: 'Aumentar vida inicial' }).click();
    await expect(guestRules.getByRole('button', { name: 'Vida inicial: 41' })).toBeVisible();
    await rules.getByRole('button', { name: 'Diminuir vida inicial' }).click();
    await expect(guestRules.getByRole('button', { name: 'Vida inicial: 40' })).toBeVisible();
    await rules.getByRole('button', { name: /Vida inicial: 40/ }).click();
    await life.fill(''); await life.blur();
    await expect(rules.getByRole('alert')).toContainText('inteiro');
    await life.fill('25'); await life.press('Enter');
    await expect(guestRules.getByRole('button', { name: 'Vida inicial: 25' })).toBeVisible();
    await commander.click(); await expect(commander).toHaveAttribute('aria-checked', 'false');
    await draw.click(); await expect(draw).toHaveAttribute('aria-checked', 'false');
    await expect(guestRules.getByRole('switch', { name: 'Comprar até 7 cartas' })).toHaveAttribute('aria-checked', 'false');
    await page.reload();
    await expect(page.getByRole('button', { name: /Vida inicial: 25/ })).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Comandante na zona de comando' })).toHaveAttribute('aria-checked', 'false');
    for (const client of [page, guest]) { await client.getByLabel('Deck para a partida').selectOption({ label: 'Deck de regras' }); await client.getByRole('button', { name: 'Estou pronto' }).click(); }
    await expect(page.getByRole('button', { name: 'Iniciar partida' })).toBeEnabled();
    await page.getByRole('button', { name: 'Iniciar partida' }).click();
    await expect(page.getByRole('region', { name: 'Mesa da partida' })).toBeVisible();
    const { match } = await (await page.request.get(`/api/rooms/${room.id}/match`)).json();
    expect(match.initialLife).toBe(25);
    for (const player of match.players) expect({ life: player.life, hand: player.handCount, library: player.libraryCount, command: player.commandCount }).toEqual({ life: 25, hand: 0, library: 8, command: 0 });
    expect((await page.request.patch(`/api/rooms/${room.id}/settings`, { data: { life: 40 } })).status()).toBe(409);
    const { room: defaults } = await (await page.request.post('/api/rooms', { data: roomBody() })).json();
    expect(defaults.commanderToCommand).toBe(true); expect(defaults.drawOpeningHand).toBe(true);
    const deck = (await (await page.request.get('/api/decks')).json()).decks.find((item: { name: string }) => item.name === 'Deck de regras');
    expect((await page.request.put(`/api/rooms/${defaults.id}/participants/me/ready`, { data: { deckId: deck.id } })).ok()).toBe(true);
    expect((await page.request.post(`/api/rooms/${defaults.id}/start`, { data: {} })).status()).toBe(201);
    const initial = (await (await page.request.get(`/api/rooms/${defaults.id}/match`)).json()).match.players[0];
    expect({ hand: initial.handCount, library: initial.libraryCount, command: initial.commandCount }).toEqual({ hand: 7, library: 0, command: 1 });
    for (const settings of [{ commanderToCommand: false, drawOpeningHand: true }, { commanderToCommand: true, drawOpeningHand: false }]) {
      const { room: mixed } = await (await page.request.post('/api/rooms', { data: roomBody() })).json();
      expect((await page.request.patch(`/api/rooms/${mixed.id}/settings`, { data: settings })).ok()).toBe(true);
      expect((await page.request.put(`/api/rooms/${mixed.id}/participants/me/ready`, { data: { deckId: deck.id } })).ok()).toBe(true);
      expect((await page.request.post(`/api/rooms/${mixed.id}/start`, { data: {} })).status()).toBe(201);
      const player = (await (await page.request.get(`/api/rooms/${mixed.id}/match`)).json()).match.players[0];
      expect({ hand: player.handCount, library: player.libraryCount, command: player.commandCount }).toEqual(settings.commanderToCommand ? { hand: 0, library: 7, command: 1 } : { hand: 7, library: 1, command: 0 });
    }
  } finally { await context.close(); }
});
