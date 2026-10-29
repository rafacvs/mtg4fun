import { test, expect, roomBody } from './fixtures';

test('jogadores preparam decks e iniciam a mesa', async ({ page, browser, baseURL }, info) => {
  test.skip(info.project.name !== 'desktop', 'O fluxo móvel é coberto em preparacao-mobile.spec.ts.');
  test.setTimeout(60_000);
  const other = await browser.newContext({ baseURL, viewport: info.project.use.viewport });
  try {
    const guest = await other.newPage();
    for (const [client, login, name] of [[page, 'amigo', 'Deck do anfitrião'], [guest, 'segundo', 'Deck do convidado']] as const) {
      expect((await client.request.post('/api/session', { data: { login, password: 'senha-do-navegador' } })).ok()).toBe(true);
      const upload = await client.request.post('/api/decks', { multipart: { file: { name: `${name}.cod`, mimeType: 'application/xml', buffer: Buffer.from(`<cockatrice_deck><deckname>${name}</deckname><zone name="main"><card number="7" name="Island"/></zone></cockatrice_deck>`) } } });
      expect(upload.status()).toBe(201);
    }
    const { room } = await (await page.request.post('/api/rooms', { data: roomBody({ name: 'Encontro dos amigos', seats: 4 }) })).json();
    expect((await guest.request.post(`/api/rooms/${room.id}/participants`, { data: {} })).ok()).toBe(true);
    await Promise.all([page.goto(`/#/salas/${room.id}`), guest.goto(`/#/salas/${room.id}`)]);
    const preparation = page.getByRole('region', { name: 'Preparação da sala' });
    const table = page.getByRole('region', { name: 'Jogadores à mesa' });
    await expect(table).toContainText('Segundo amigo');
    await expect(preparation).toContainText('2 lugares disponíveis');
    await expect(table.getByLabel('Lugar livre')).toHaveCount(2);
    const rules = page.getByRole('region', { name: 'Regras da mesa' });
    await expect(rules.getByRole('button', { name: /Vida inicial: 40/ })).toBeVisible();
    await expect(rules.getByRole('radio', { name: 'Padrão' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('button', { name: 'Iniciar partida' })).toBeDisabled();
    const panel = page.getByRole('complementary', { name: 'Seu preparo' });
    const preview = panel.getByLabel('Deck escolhido');
    await expect(preview.locator('.preparation-selected-info')).toHaveText('Sem deck');
    const before = await preview.boundingBox();
    const buttonBefore = await page.getByRole('button', { name: 'Estou pronto' }).boundingBox();
    await page.getByLabel('Deck para a partida').selectOption({ label: 'Deck do anfitrião' });
    await expect(panel).toContainText('7 cartas');
    const after = await preview.boundingBox();
    const buttonAfter = await page.getByRole('button', { name: 'Estou pronto' }).boundingBox();
    expect(after?.height).toBe(before?.height);
    expect(buttonAfter?.y).toBe(buttonBefore?.y);
    await page.getByRole('button', { name: 'Estou pronto' }).click();
    await expect(guest.getByRole('region', { name: 'Jogadores à mesa' })).toContainText('Pronto');
    await expect(page.getByLabel('Deck para a partida')).toBeDisabled();
    await guest.getByLabel('Deck para a partida').selectOption({ label: 'Deck do convidado' });
    await guest.getByRole('button', { name: 'Estou pronto' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Todos prontos para começar.' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Iniciar partida' })).toBeEnabled();
    await expect(table).toContainText('Deck do convidado');
    const outsider = await browser.newContext({ baseURL });
    try {
      expect((await outsider.request.get(`/api/rooms/${room.id}/preparation-decks`)).status()).toBe(401);
      expect((await outsider.request.post('/api/session', { data: { login: 'amigo3', password: 'senha-do-navegador' } })).ok()).toBe(true);
      expect((await outsider.request.get(`/api/rooms/${room.id}/preparation-decks`)).status()).toBe(404);
    } finally { await outsider.close(); }
    const shared = await (await page.request.get(`/api/rooms/${room.id}/preparation-decks`)).json();
    expect(shared.decks).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'Deck do convidado', image: 'Island' })]));
    expect(shared.decks.every((deck: Record<string, unknown>) => Object.keys(deck).every(key => ['playerId', 'name', 'image'].includes(key)))).toBe(true);
    await page.screenshot({ path: info.outputPath('preparacao.png'), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await guest.getByRole('button', { name: 'Desfazer prontidão' }).click();
    await expect(page.getByRole('button', { name: 'Iniciar partida' })).toBeDisabled();
    await guest.getByRole('button', { name: 'Estou pronto' }).click();
    await expect(page.getByRole('button', { name: 'Iniciar partida' })).toBeEnabled();
    await page.getByRole('button', { name: 'Iniciar partida' }).click();
    await expect(page.getByRole('region', { name: 'Mesa da partida' })).toBeVisible();
    expect((await page.request.get(`/api/rooms/${room.id}/preparation-decks`)).status()).toBe(404);
  } finally { await other.close(); }
});

test('estado vazio do deck cabe e mantém os controles estáveis em diferentes telas', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'Este cenário ajusta o tamanho da janela para cada largura.');
  test.setTimeout(60_000);
  expect((await page.request.post('/api/session', { data: { login: 'amigo', password: 'senha-do-navegador' } })).ok()).toBe(true);
  const upload = await page.request.post('/api/decks', { multipart: { file: { name: 'teste.cod', mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck><deckname>Deck responsivo</deckname><zone name="main"><card number="7" name="Island"/></zone></cockatrice_deck>') } } });
  expect(upload.status()).toBe(201);
  for (const viewport of [{ width: 1280, height: 720 }, { width: 2560, height: 1440 }]) {
    await page.setViewportSize(viewport);
    const { room } = await (await page.request.post('/api/rooms', { data: roomBody() })).json();
    await page.goto(`/#/salas/${room.id}`);
    const panel = page.getByRole('complementary', { name: 'Seu preparo' });
    const preview = panel.getByLabel('Deck escolhido');
    await expect(preview.locator('.preparation-selected-info')).toHaveText('Sem deck');
    const before = await panel.evaluate(element => {
      const card = element.querySelector<HTMLElement>('.preparation-selected-deck')!;
      const text = element.querySelector<HTMLElement>('.preparation-selected-info')!;
      const button = element.querySelector<HTMLElement>('.preparation-ready-action')!;
      return { height: card.offsetHeight, buttonTop: button.getBoundingClientRect().top - element.getBoundingClientRect().top, fits: text.scrollHeight <= text.clientHeight && text.scrollWidth <= text.clientWidth };
    });
    expect(before.fits, `texto vazio em ${viewport.width}px`).toBe(true);
    await page.getByLabel('Deck para a partida').selectOption({ label: 'Deck responsivo' });
    await expect(preview).toContainText('Deck responsivo');
    const after = await panel.evaluate(element => ({ height: element.querySelector<HTMLElement>('.preparation-selected-deck')!.offsetHeight, buttonTop: element.querySelector<HTMLElement>('.preparation-ready-action')!.getBoundingClientRect().top - element.getBoundingClientRect().top }));
    expect(after).toEqual({ height: before.height, buttonTop: before.buttonTop });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
