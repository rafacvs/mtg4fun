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
