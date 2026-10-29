import { test, expect, roomBody } from './fixtures';

test('preparação móvel mantém mesa, deck e regras acessíveis', async ({ page, browser, baseURL }, info) => {
  test.skip(info.project.name === 'desktop', 'Fluxo de painel móvel.');
  test.setTimeout(90_000);
  const guestContext = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, hasTouch: true });
  try {
    const guest = await guestContext.newPage();
    for (const [client, login, name] of [[page, 'amigo', 'Deck do anfitrião'], [guest, 'segundo', 'Deck do convidado']] as const) {
      expect((await client.request.post('/api/session', { data: { login, password: 'senha-do-navegador' } })).ok()).toBe(true);
      const response = await client.request.post('/api/decks', { multipart: { file: { name: 'teste.cod', mimeType: 'application/xml', buffer: Buffer.from(`<cockatrice_deck><deckname>${name}</deckname><zone name="main"><card number="7" name="Island"/></zone></cockatrice_deck>`) } } });
      expect(response.status()).toBe(201);
    }
    const { room } = await (await page.request.post('/api/rooms', { data: roomBody({ name: 'Mesa dos amigos', seats: 6 }) })).json();
    expect((await guest.request.post(`/api/rooms/${room.id}/participants`, { data: {} })).ok()).toBe(true);
    await Promise.all([page.goto(`/#/salas/${room.id}`), guest.goto(`/#/salas/${room.id}`)]);
    await expect(page.getByRole('region', { name: 'Jogadores', exact: true })).toContainText('Segundo amigo');
    await expect(page.getByRole('button', { name: 'Estou pronto' })).toBeDisabled();
    await page.screenshot({ path: info.outputPath('mobile-mesa.png') });
    await page.getByRole('button', { name: /Trocar/ }).tap();
    const deck = page.getByRole('dialog', { name: 'Seu deck' });
    await expect(deck).toBeVisible();
    await expect(deck.getByLabel('Deck escolhido')).toContainText('Sem deck');
    await deck.getByLabel('Deck para a partida').selectOption({ label: 'Deck do anfitrião' });
    await expect(deck.getByLabel('Deck escolhido')).toContainText('7 cartas');
    await page.screenshot({ path: info.outputPath('mobile-deck.png') });
    await deck.getByRole('button', { name: 'Usar este deck' }).tap();
    await expect(deck).not.toBeVisible();
    await page.getByRole('button', { name: /Regras/ }).tap();
    const rules = page.getByRole('dialog', { name: 'Regras da mesa' });
    await expect(rules.getByRole('button', { name: /Vida inicial: 40/ })).toBeVisible();
    await rules.getByRole('button', { name: 'Aumentar vida inicial' }).tap();
    await expect(rules.getByRole('button', { name: /Vida inicial: 41/ })).toBeVisible();
    await rules.getByRole('radio', { name: 'Aconchegaz' }).tap();
    await expect(rules.getByRole('radio', { name: 'Aconchegaz' })).toHaveAttribute('aria-checked', 'true');
    await page.screenshot({ path: info.outputPath('mobile-regras.png') });
    await rules.getByRole('button', { name: 'Concluído' }).tap();
    await guest.getByRole('button', { name: /Regras/ }).tap();
    const guestRules = guest.getByRole('dialog', { name: 'Regras da mesa' });
    await expect(guestRules.getByRole('button', { name: 'Vida inicial: 41' })).toBeDisabled();
    await expect(guestRules.getByRole('switch', { name: 'Comprar até 7 cartas' })).toBeDisabled();
    await expect(guestRules.getByRole('radio', { name: 'Aconchegaz' })).toHaveAttribute('aria-checked', 'true');
    await expect(guestRules.getByRole('radio', { name: 'Padrão' })).toBeDisabled();
    await guestRules.getByRole('button', { name: 'Fechar', exact: true }).tap();
    await guest.getByRole('button', { name: /Trocar/ }).tap();
    await guest.getByLabel('Deck para a partida').selectOption({ label: 'Deck do convidado' });
    await guest.getByRole('button', { name: 'Usar este deck' }).tap();
    await guest.getByRole('button', { name: 'Estou pronto' }).tap();
    await page.getByRole('button', { name: 'Estou pronto' }).tap();
    await expect(page.getByRole('button', { name: 'Iniciar partida' })).toBeEnabled();
    await page.screenshot({ path: info.outputPath('mobile-prontos.png') });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Iniciar partida' }).tap();
    await expect(page.getByRole('region', { name: 'Mesa da partida' })).toBeVisible();
    const { match } = await (await page.request.get(`/api/rooms/${room.id}/match`)).json();
    expect(match.initialLife).toBe(41);
  } finally { await guestContext.close(); }
});

test('lista móvel comporta quatro e seis participantes em telas pequenas', async ({ page, browser, baseURL }, info) => {
  test.skip(info.project.name !== 'celular', 'Verifica tamanhos verticais específicos.');
  test.setTimeout(90_000);
  const contexts = [];
  try {
    expect((await page.request.post('/api/session', { data: { login: 'amigo', password: 'senha-do-navegador' } })).ok()).toBe(true);
    const { room } = await (await page.request.post('/api/rooms', { data: roomBody({ seats: 6 }) })).json();
    for (const login of ['segundo', 'amigo3', 'amigo4']) {
      const context = await browser.newContext({ baseURL }); contexts.push(context);
      expect((await context.request.post('/api/session', { data: { login, password: 'senha-do-navegador' } })).ok()).toBe(true);
      expect((await context.request.post(`/api/rooms/${room.id}/participants`, { data: {} })).ok()).toBe(true);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/#/salas/${room.id}`);
    await expect(page.getByRole('region', { name: 'Jogadores', exact: true }).getByRole('listitem')).toHaveCount(4);
    await expect(page.getByRole('button', { name: 'Estou pronto' })).toBeVisible();
    expect(await page.locator('.mobile-players ul').evaluate(el => el.scrollHeight <= el.clientHeight)).toBe(true);
    await page.screenshot({ path: info.outputPath('mobile-quatro.png') });
    for (const login of ['amigo5', 'amigo6']) {
      const context = await browser.newContext({ baseURL }); contexts.push(context);
      expect((await context.request.post('/api/session', { data: { login, password: 'senha-do-navegador' } })).ok()).toBe(true);
      expect((await context.request.post(`/api/rooms/${room.id}/participants`, { data: {} })).ok()).toBe(true);
    }
    await page.setViewportSize({ width: 320, height: 568 });
    const list = page.getByRole('region', { name: 'Jogadores', exact: true });
    await expect(list.getByRole('listitem')).toHaveCount(6);
    await expect(page.getByRole('button', { name: 'Estou pronto' })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await list.locator('ul').evaluate(el => { el.scrollTop = el.scrollHeight; });
    await expect(list.getByText('Amigo 6')).toBeInViewport();
  } finally { await Promise.all(contexts.map(context => context.close())); }
});
