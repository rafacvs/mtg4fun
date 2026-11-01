import { test, expect, roomBody, confirmHands } from './fixtures';

const deckFile = {
  name: 'ilha.cod',
  mimeType: 'application/xml',
  buffer: Buffer.from('<cockatrice_deck><zone name="main"><card number="20" name="Island"/></zone></cockatrice_deck>'),
};

test('quem não joga assiste à mesa, consulta as mãos e não tem nenhuma ação', async ({ page, browser, baseURL }, info) => {
  test.setTimeout(60_000);
  const context = () => browser.newContext({ baseURL, viewport: info.project.use.viewport, isMobile: info.project.use.isMobile, hasTouch: info.project.use.hasTouch });
  const firstContext = await context();
  const secondContext = await context();
  try {
    const [first, second] = [firstContext.request, secondContext.request];
    const decks: number[] = [];
    for (const [api, login] of [[first, 'amigo'], [second, 'segundo']] as const) {
      expect((await api.post('/api/session', { data: { login, password: 'senha-do-navegador' } })).ok()).toBe(true);
      decks.push((await (await api.post('/api/decks', { multipart: { file: deckFile } })).json()).deck.id);
    }
    const title = `Mesa assistida ${Date.now()}-${info.project.name}`;
    const room = (await (await first.post('/api/rooms', { data: roomBody({ name: title }) })).json()).room;
    expect((await second.post(`/api/rooms/${room.id}/participants`, { data: {} })).ok()).toBe(true);
    for (const [index, api] of [first, second].entries()) expect((await api.put(`/api/rooms/${room.id}/participants/me/ready`, { data: { deckId: decks[index] } })).ok()).toBe(true);
    expect((await first.post(`/api/rooms/${room.id}/start`, { data: {} })).status()).toBe(201);
    await confirmHands(room.id, first, second);

    expect((await page.request.post('/api/session', { data: { login: 'amigo3', password: 'senha-do-navegador' } })).ok()).toBe(true);
    await page.goto('/#/salas');
    await page.getByRole('article', { name: title, exact: true }).getByRole('link', { name: 'Assistir', exact: true }).click();

    const seats = page.getByRole('tablist', { name: 'Escolher jogador', exact: true });
    await expect(seats.getByRole('tab')).toHaveCount(2);
    await expect(page.getByText('Assistindo', { exact: true })).toBeVisible();
    for (const name of ['Amigo da mesa', 'Segundo amigo']) {
      await seats.getByRole('tab', { name: new RegExp(name) }).click();
      const hand = page.getByRole('tabpanel', { name: `Mão de ${name}`, exact: true });
      await expect(hand.getByRole('button', { name: 'Island', exact: true })).toHaveCount(7);
      await expect(page.getByRole('article', { name: `Mesa de ${name}`, exact: true })).toBeVisible();
    }

    // Nada do que um jogador usa existe aqui, nem o atalho de teclado.
    for (const name of ['Comprar', 'Passar a vez', 'Passar turno', 'Desvirar', 'Ações', 'Mulligan', 'Abrir ações do grimório']) await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
    if (info.project.name === 'desktop') {
      const actions: string[] = [];
      page.on('request', request => { if (request.method() !== 'GET') actions.push(request.url()); });
      await page.locator('body').press('d');
      await page.locator('body').press(' ');
      await page.waitForTimeout(300);
      expect(actions).toEqual([]);
    }

    const card = page.getByRole('tabpanel', { name: 'Mão de Segundo amigo', exact: true }).getByRole('button', { name: 'Island', exact: true }).first();
    if (info.project.use.hasTouch) await card.tap(); else await card.click({ force: true });
    const reading = page.getByRole('dialog', { name: 'Imagem de Island', exact: true });
    await expect(reading).toBeVisible();
    await expect(reading.getByRole('img', { name: 'Imagem ampliada de Island', exact: true })).toBeVisible();
    await expect(reading.getByRole('button', { name: /Campo|Cemitério|Criar cópia|Virar/ })).toHaveCount(0);
    await reading.getByRole('button', { name: 'Fechar', exact: true }).click();

    // A mesa acompanha o jogo enquanto a pessoa assiste, e fecha com a partida.
    expect((await second.post(`/api/rooms/${room.id}/match/actions`, { data: { intentId: crypto.randomUUID(), kind: 'draw', count: 1 } })).ok()).toBe(true);
    await expect(page.getByRole('tabpanel', { name: 'Mão de Segundo amigo', exact: true }).getByRole('button', { name: 'Island', exact: true })).toHaveCount(8);
    expect((await first.post(`/api/rooms/${room.id}/match/actions`, { data: { intentId: crypto.randomUUID(), kind: 'finish' } })).ok()).toBe(true);
    await expect(page).toHaveURL(/#\/salas$/);
    await expect(page.getByRole('heading', { name: 'Salas', exact: true })).toBeVisible();
  } finally {
    await firstContext.close();
    await secondContext.close();
  }
});
