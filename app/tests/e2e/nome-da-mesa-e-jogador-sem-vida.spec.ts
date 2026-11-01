import { test, expect, roomBody, confirmHands } from './fixtures';

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
