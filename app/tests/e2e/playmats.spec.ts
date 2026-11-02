import { test, expect, roomBody, confirmHands } from './fixtures';

test('salva um upload WEBP, ajusta a prévia e compartilha o fundo persistido da partida', async ({ page, browser, baseURL }, info) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const api = page.request;
  expect((await api.post('/api/session', { data: { login: 'amigo', password: 'senha-do-navegador' } })).ok()).toBe(true);
  const deck = (await (await api.post('/api/decks', { multipart: { file: { name: 'playmat.cod', mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck><zone name="main"><card number="20" name="Island"/></zone></cockatrice_deck>') } } })).json()).deck;
  await page.goto('/#/playmats');
  await expect(page.getByRole('heading', { name: 'Como ficará na mesa' })).toBeVisible();
  const webp = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 120; canvas.height = 80;
    const context = canvas.getContext('2d')!; context.fillStyle = '#20a080'; context.fillRect(0, 0, 120, 80);
    return canvas.toDataURL('image/webp').split(',')[1];
  });
  await page.getByLabel('Enviar imagem do playmat').setInputFiles({ name: 'meu-playmat.webp', mimeType: 'image/webp', buffer: Buffer.from(webp, 'base64') });
  await expect(page.getByRole('status', { name: 'Status do playmat' })).toContainText('Imagem enviada');
  await page.getByRole('button', { name: 'Celular', exact: true }).click();
  const preview = page.getByRole('img', { name: 'Prévia do playmat em Celular' });
  const box = (await preview.boundingBox())!;
  expect(Math.abs(box.width / box.height - 9 / 16)).toBeLessThan(.02);
  await page.getByRole('button', { name: '16:9', exact: true }).click();
  await page.getByRole('button', { name: 'Conter', exact: true }).click();
  await page.getByRole('slider', { name: 'Zoom', exact: true }).focus();
  await page.keyboard.press('End');
  await page.getByRole('slider', { name: 'Escurecer', exact: true }).focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await page.getByRole('button', { name: 'Salvar playmat', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Status do playmat' })).toContainText('Playmat salvo');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Conter', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('slider', { name: 'Zoom', exact: true })).toHaveValue('200');
  await expect(page.getByRole('slider', { name: 'Escurecer', exact: true })).toHaveValue('1');
  const { settings } = await (await api.get('/api/playmats')).json();
  expect(settings.imageId).toBeGreaterThan(0);
  const imageResponse = await api.get(`/api/playmats/${settings.imageId}/image`);
  expect(imageResponse.headers()['content-type']).toBe('image/webp');
  expect(await imageResponse.body()).toEqual(Buffer.from(webp, 'base64'));

  const other = await browser.newContext({ baseURL });
  try {
    expect((await other.request.post('/api/session', { data: { login: 'segundo', password: 'senha-do-navegador' } })).ok()).toBe(true);
    const otherDeck = (await (await other.request.post('/api/decks', { multipart: { file: { name: 'outro.cod', mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck><zone name="main"><card number="20" name="Island"/></zone></cockatrice_deck>') } } })).json()).deck;
    const { room } = await (await api.post('/api/rooms', { data: roomBody() })).json();
    expect((await other.request.post(`/api/rooms/${room.id}/participants`, { data: {} })).ok()).toBe(true);
    expect((await api.put(`/api/rooms/${room.id}/participants/me/ready`, { data: { deckId: deck.id } })).ok()).toBe(true);
    expect((await other.request.put(`/api/rooms/${room.id}/participants/me/ready`, { data: { deckId: otherDeck.id } })).ok()).toBe(true);
    expect((await api.post(`/api/rooms/${room.id}/start`, { data: {} })).status()).toBe(201);
    await confirmHands(room.id, api, other.request);
    await page.goto(`/#/salas/${room.id}`);
    const field = page.getByRole('article', { name: 'Mesa de Amigo da mesa', exact: true });
    await expect(field).toBeVisible();
    const art = field.locator('.playmat-surface');
    await expect.poll(() => art.evaluate(node => getComputedStyle(node, '::before').backgroundImage)).toContain(`/api/playmats/${settings.imageId}/image`);
    expect(await art.evaluate(node => getComputedStyle(node, '::before').backgroundSize)).toBe('contain');
    expect(await art.evaluate(node => getComputedStyle(node, '::before').transform)).toBe('matrix(2, 0, 0, 2, 0, 0)');
    const shared = (await (await other.request.get(`/api/rooms/${room.id}/match`)).json()).match.players.find((player: { playmat: { imageId: number } }) => player.playmat.imageId === settings.imageId);
    expect(shared.playmat).toEqual({ ...settings, random: false });
    expect((await other.request.get(`/api/playmats/${settings.imageId}/image`)).ok()).toBe(true);
    await page.reload();
    await expect(page.getByRole('article', { name: 'Mesa de Amigo da mesa', exact: true }).locator('.playmat-surface')).toBeAttached();
    await page.screenshot({ path: info.outputPath('playmat-na-mesa.png') });
  } finally { await other.close(); }
  expect(errors).toEqual([]);
});

test('Salas, Meus decks e Meus playmats compartilham marca, fundo e largura', async ({ page }, info) => {
  expect((await page.request.post('/api/session', { data: { login: 'amigo', password: 'senha-do-navegador' } })).ok()).toBe(true);
  const headers: { x: number; width: number; font: string; background: string }[] = [];
  for (const screen of ['salas', 'decks', 'playmats']) {
    await page.goto(`/#/${screen}`);
    await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible();
    if (screen === 'decks') {
      const close = page.getByRole('button', { name: /Fechar importação/ });
      if (await close.isVisible()) await close.click();
    }
    if (screen === 'playmats') await expect(page.getByRole('heading', { name: 'Como ficará na mesa' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (info.project.name === 'desktop') {
      headers.push(await page.locator('.app-header').evaluate(node => ({ x: node.getBoundingClientRect().x, width: node.getBoundingClientRect().width, font: getComputedStyle(node.querySelector('.app-brand')!).font, background: getComputedStyle(document.body).backgroundImage })));
    }
    await page.screenshot({ path: info.outputPath(`${screen}.png`), fullPage: true });
  }
  if (headers.length) expect(headers).toEqual([headers[0], headers[0], headers[0]]);
});
