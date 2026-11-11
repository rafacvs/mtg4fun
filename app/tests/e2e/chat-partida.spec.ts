import { test, expect, roomBody, confirmHands, openMatchRail } from './fixtures';

const deck = { name: 'ilha.cod', mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck><zone name="main"><card number="20" name="Island"/></zone></cockatrice_deck>') };

test('jogador e espectador conversam, enviam com Enter e chamam atenção', async ({ page, browser, baseURL }, info) => {
  test.setTimeout(90_000);
  const spectatorContext = await browser.newContext({ baseURL, viewport: info.project.use.viewport, isMobile: info.project.use.isMobile, hasTouch: info.project.use.hasTouch });
  try {
    expect((await page.request.post('/api/session', { data: { login: 'amigo', password: 'senha-do-navegador' } })).ok()).toBeTruthy();
    expect((await spectatorContext.request.post('/api/session', { data: { login: 'amigo3', password: 'senha-do-navegador' } })).ok()).toBeTruthy();
    const deckId = (await (await page.request.post('/api/decks', { multipart: { file: deck } })).json()).deck.id;
    const room = (await (await page.request.post('/api/rooms', { data: roomBody({ name: 'Mesa do chat' }) })).json()).room;
    expect((await page.request.put(`/api/rooms/${room.id}/participants/me/ready`, { data: { deckId } })).ok()).toBeTruthy();
    expect((await page.request.post(`/api/rooms/${room.id}/start`, { data: {} })).ok()).toBeTruthy();
    await confirmHands(room.id, page.request);
    await page.goto(`/#/salas/${room.id}`);
    await openMatchRail(page, 'Registro');
    await expect(page.locator('.log-filters button').first()).toHaveText('Chat');
    await page.getByRole('button', { name: 'Chat', exact: true }).click();
    const input = page.getByRole('textbox', { name: 'Mensagem' });
    await input.fill('Primeira linha');
    await input.press('Shift+Enter');
    await input.pressSequentially('Segunda linha');
    await input.press('Enter');
    await expect(input).toHaveValue('');
    await expect(page.getByText('Primeira linha Segunda linha', { exact: false })).toBeVisible();
    await expect(page.locator('.chat-message strong').first()).toHaveCSS('color', 'rgb(108, 180, 245)');
    const spectator = await spectatorContext.newPage();
    await spectator.goto(`/#/salas/${room.id}`);
    await spectator.getByRole('button', { name: 'Abrir crônica' }).click();
    await spectator.getByRole('button', { name: 'Chat', exact: true }).click();
    await expect(spectator.getByText('Primeira linha Segunda linha', { exact: false })).toBeVisible();
    await spectator.getByRole('textbox', { name: 'Mensagem' }).fill('Olá da torcida');
    await spectator.getByRole('textbox', { name: 'Mensagem' }).press('Enter');
    await expect(page.getByText('Olá da torcida')).toBeVisible();
    await spectator.getByRole('button', { name: 'Chamar atenção' }).click();
    await expect(spectator.getByRole('alert')).toHaveCount(0);
    await page.reload();
    await openMatchRail(page, 'Registro');
    await page.getByRole('button', { name: 'Chat', exact: true }).click();
    await expect(page.getByText('Olá da torcida')).toBeVisible();
  } finally { await spectatorContext.close(); }
});
