import { test, expect, roomBody } from './fixtures';

test('marcadores não zerados aparecem no cabeçalho e a vida abre a edição', async ({ page, browser, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop'); test.setTimeout(90_000);
  const other = await browser.newContext({ baseURL });
  try {
    let room = 0;
    for (const [api, login] of [[page.request, 'amigo'], [other.request, 'segundo']] as const) {
      expect((await api.post('/api/session', { data: { login, password: 'senha-do-navegador' } })).ok()).toBeTruthy();
      const { deck } = await (await api.post('/api/decks', { multipart: { file: { name: 'deck.cod', mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck><zone name="main"><card number="8" name="Island"/></zone></cockatrice_deck>') } } })).json();
      if (!room) room = (await (await api.post('/api/rooms', { data: roomBody() })).json()).room.id;
      else expect((await api.post(`/api/rooms/${room}/participants`, { data: {} })).ok()).toBeTruthy();
      expect((await api.put(`/api/rooms/${room}/participants/me/ready`, { data: { deckId: deck.id } })).ok()).toBeTruthy();
    }
    expect((await page.request.post(`/api/rooms/${room}/start`, { data: {} })).ok()).toBeTruthy();
    for (const [api, color, value] of [[page.request, 'red', 3], [other.request, 'blue', 2]] as const) {
      const match = (await (await api.get(`/api/rooms/${room}/match`)).json()).match;
      expect((await api.post(`/api/rooms/${room}/match/actions`, { data: { intentId: crypto.randomUUID(), kind: 'counter', target: 'player', playerId: match.viewerId, subject: 'marker', color, operation: 'set', value } })).ok()).toBeTruthy();
    }
    await page.setViewportSize({ width: 1312, height: 825 }); await page.goto(`/#/salas/${room}`);
    const own = page.getByRole('article', { name: 'Mesa de Amigo da mesa' });
    const opponent = page.getByRole('article', { name: 'Mesa de Segundo amigo' });
    await expect(own.locator('.seat-name-line').getByLabel('marcador vermelho')).toHaveText('3');
    await expect(opponent.locator('.seat-name-line').getByLabel('marcador azul')).toHaveText('2');
    await expect(own.locator('.seat-marker-count')).toHaveCount(1);
    await expect(own.locator('.seat-markers .marker-dot')).toHaveCount(0);
    const life = own.getByRole('button', { name: 'Abrir jogador Amigo da mesa' });
    const lifeBox = (await own.getByLabel('Vida: 40').boundingBox())!;
    const buttonBox = (await life.boundingBox())!;
    expect(buttonBox.y).toBeLessThan(lifeBox.y + lifeBox.height);
    expect(buttonBox.y + buttonBox.height).toBeGreaterThan(lifeBox.y);
    await page.screenshot({ path: testInfo.outputPath('marcadores-header.png'), animations: 'disabled' });
    await life.click();
    const menu = page.getByRole('dialog', { name: 'Jogador Amigo da mesa' });
    await expect(menu).toBeVisible();
    await expect(menu.getByLabel('marcador vermelho', { exact: true })).toHaveValue('3');
    await menu.getByRole('button', { name: 'Diminuir marcador vermelho' }).click();
    await expect(own.locator('.seat-name-line').getByLabel('marcador vermelho')).toHaveText('2');
    await menu.getByLabel('marcador vermelho', { exact: true }).fill('0');
    await menu.getByLabel('marcador vermelho', { exact: true }).press('Enter');
    await expect(own.locator('.seat-name-line').getByLabel('marcador vermelho')).toHaveCount(0);
  } finally { await other.close(); }
});
