import { test, expect, roomBody, confirmHands, openQuickActions, closeQuickActions } from './fixtures';

const deck = { name: 'deck.cod', mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck><zone name="main"><card number="20" name="Island"/></zone></cockatrice_deck>') };

test('a preparação mostra o nome da mesa', async ({ page }, info) => {
  const api = page.request;
  expect((await api.post('/api/session', { data: { login: 'amigo', password: 'senha-do-navegador' } })).ok()).toBe(true);
  const name = `Mesa dos amigos ${info.project.name} ${Date.now()}`;
  const { room } = await (await api.post('/api/rooms', { data: roomBody({ name }) })).json();
  await page.goto(`/#/salas/${room.id}`);
  await expect(page.getByRole('heading', { name, exact: true, level: 2 })).toBeVisible();
  await page.screenshot({ path: info.outputPath('preparacao.png') });
});

test('o campo apaga e mostra a caveira só enquanto a vida está em zero ou menos', async ({ page, browser, baseURL }, info) => {
  test.setTimeout(60_000);
  const otherContext = await browser.newContext({ baseURL });
  try {
    const other = otherContext.request;
    expect((await page.request.post('/api/session', { data: { login: 'amigo', password: 'senha-do-navegador' } })).ok()).toBe(true);
    expect((await other.post('/api/session', { data: { login: 'segundo', password: 'senha-do-navegador' } })).ok()).toBe(true);
    const { room } = await (await page.request.post('/api/rooms', { data: roomBody() })).json();
    expect((await other.post(`/api/rooms/${room.id}/participants`, { data: {} })).ok()).toBe(true);
    for (const api of [page.request, other]) {
      const { deck: created } = await (await api.post('/api/decks', { multipart: { file: deck } })).json();
      expect((await api.put(`/api/rooms/${room.id}/participants/me/ready`, { data: { deckId: created.id } })).ok()).toBe(true);
    }
    expect((await page.request.post(`/api/rooms/${room.id}/start`, { data: {} })).status()).toBe(201);
    await confirmHands(room.id, page.request, other);
    // No celular só o campo em foco aparece, que começa sendo o próprio.
    const victim = info.project.use.hasTouch ? page.request : other;
    const victimName = info.project.use.hasTouch ? 'Amigo da mesa' : 'Segundo amigo';
    const { match } = await (await victim.get(`/api/rooms/${room.id}/match`)).json();
    const setLife = async (value: number) => {
      const result = await victim.post(`/api/rooms/${room.id}/match/actions`, { data: { intentId: crypto.randomUUID(), kind: 'counter', target: 'player', playerId: match.viewerId, subject: 'life', operation: 'set', value } });
      expect(result.ok(), await result.text()).toBe(true);
    };
    await page.goto(`/#/salas/${room.id}`);
    const mark = page.getByRole('img', { name: `${victimName} está sem vida`, exact: true });
    await expect(page.getByRole('button', { name: 'Comandos', exact: true }).or(page.getByRole('button', { name: 'Passar turno', exact: true })).first()).toBeVisible();
    await expect(mark).toHaveCount(0);
    await setLife(0);
    await expect(mark).toHaveCount(1);
    await page.screenshot({ path: info.outputPath('sem-vida.png') });
    await setLife(-3);
    await expect(mark).toHaveCount(1);
    await setLife(1);
    await expect(mark).toHaveCount(0);
  } finally { await otherContext.close(); }
});

test('passar a vez pula quem morreu, e dá para tirar os mortos da grade e devolvê-los', async ({ page, browser, baseURL }, info) => {
  test.setTimeout(90_000);
  const contexts = await Promise.all([1, 2, 3].map(() => browser.newContext({ baseURL })));
  try {
    const players = [page.request, ...contexts.map(context => context.request)];
    const logins = ['amigo', 'segundo', 'amigo3', 'amigo4'];
    for (const [index, api] of players.entries()) expect((await api.post('/api/session', { data: { login: logins[index], password: 'senha-do-navegador' } })).ok()).toBe(true);
    const { room } = await (await page.request.post('/api/rooms', { data: roomBody({ seats: 4 }) })).json();
    for (const api of players.slice(1)) expect((await api.post(`/api/rooms/${room.id}/participants`, { data: {} })).ok()).toBe(true);
    for (const api of players) {
      const { deck: created } = await (await api.post('/api/decks', { multipart: { file: deck } })).json();
      expect((await api.put(`/api/rooms/${room.id}/participants/me/ready`, { data: { deckId: created.id } })).ok()).toBe(true);
    }
    expect((await page.request.post(`/api/rooms/${room.id}/start`, { data: {} })).status()).toBe(201);
    await confirmHands(room.id, ...players);
    const read = async (api = page.request) => (await (await api.get(`/api/rooms/${room.id}/match`)).json()).match;
    const ids = await Promise.all(players.map(async api => (await read(api)).viewerId as number));
    const apiOf = (id: number) => players[ids.indexOf(id)];
    const kill = async (id: number, life = 0) => {
      const result = await apiOf(id).post(`/api/rooms/${room.id}/match/actions`, { data: { intentId: crypto.randomUUID(), kind: 'counter', target: 'player', playerId: id, subject: 'life', operation: 'set', value: life } });
      expect(result.ok(), await result.text()).toBe(true);
    };
    const { turnOrder, currentTurn } = await read();
    const order = turnOrder.map((turn: { userId: number }) => turn.userId) as number[];
    expect(currentTurn.userId).toBe(order[0]);
    // Morrem o próximo da vez e um oponente qualquer que não seja quem olha a mesa.
    const victims = order.slice(1, 3).includes(ids[0]) ? order.slice(1).filter(id => id !== ids[0]) : order.slice(1, 3);
    await kill(victims[0]);

    await page.goto(`/#/salas/${room.id}`);
    const grid = page.locator('.desktop-fields');
    await expect(grid).toHaveClass(/player-count-4/);
    const pass = { click: async () => {
      await openQuickActions(page);
      await page.getByRole('button', { name: 'Passar turno', exact: true }).click();
      await closeQuickActions(page);
    } };
    // Passa até a vez de quem vem antes do morto; o próximo clique pula direto para depois dele.
    const dead = order.indexOf(victims[0]);
    for (let index = 1; index <= dead; index++) {
      await pass.click();
      await expect.poll(async () => (await read()).currentTurn.userId).toBe(order[index === dead ? dead + 1 : index]);
    }

    const toggle = async (name: RegExp) => {
      await openQuickActions(page);
      await page.getByRole('button', { name }).click();
      await closeQuickActions(page);
    };
    await toggle(/^Ocultar campos de quem morreu \(1\)$/);
    await expect(grid).toHaveClass(/player-count-3/);
    await expect(page.locator('.opponent-table-surface')).toHaveCount(2);
    if (!info.project.use.hasTouch) await page.screenshot({ path: info.outputPath('sem-um-morto.png') });
    // Com os mortos ocultos, quem morre depois também sai da grade.
    await kill(victims[1], -2);
    await expect(grid).toHaveClass(/player-count-2/);
    await expect(page.locator('.opponent-table-surface')).toHaveCount(1);
    if (!info.project.use.hasTouch) await page.screenshot({ path: info.outputPath('sem-dois-mortos.png') });
    await toggle(/^Mostrar campos de quem morreu \(2\)$/);
    await expect(grid).toHaveClass(/player-count-4/);
    if (!info.project.use.hasTouch) await expect(page.getByRole('img', { name: /está sem vida$/ })).toHaveCount(2);
    // Quem volta a ter vida volta para a grade mesmo com os mortos ocultos.
    await toggle(/^Ocultar campos de quem morreu \(2\)$/);
    await kill(victims[0], 5);
    await expect(grid).toHaveClass(/player-count-3/);
  } finally { await Promise.all(contexts.map(context => context.close())); }
});
