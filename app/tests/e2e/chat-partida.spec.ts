import { test, expect, roomBody, confirmHands } from './fixtures';

const deck = { name: 'ilha.cod', mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck><zone name="main"><card number="20" name="Island"/></zone></cockatrice_deck>') };

test('chat flutuante separa conversa da crônica e diferencia toque, pressão e edição', async ({ page, browser, baseURL }, info) => {
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
    let chatReads = 0;
    page.on('request', request => { if (request.method() === 'GET' && request.url().includes('/match/chat')) chatReads += 1; });

    // The accessible control works without a keyboard, including on mobile.
    await page.getByRole('button', { name: 'Abrir chat' }).click();
    const input = page.getByRole('textbox', { name: 'Mensagem' });
    await input.fill('Rascunho preservado');
    await input.press('Escape');
    await page.getByRole('button', { name: 'Abrir chat' }).click();
    await expect(input).toHaveValue('Rascunho preservado');
    await input.press('Control+A');
    await input.press('Backspace');
    await input.press('Enter');
    await expect(page.getByRole('button', { name: 'Abrir chat' })).toBeVisible();
    await page.waitForTimeout(100);
    const closedReadCount = chatReads;
    await page.waitForTimeout(1100);
    expect(chatReads).toBe(closedReadCount);

    await page.getByRole('button', { name: 'Abrir chat' }).click();
    await input.fill('Primeira linha');
    await input.press('Shift+Enter');
    await input.pressSequentially('Segunda linha');
    await expect(input).toHaveValue('Primeira linha\nSegunda linha');
    await input.press('Enter');
    await expect(input).toHaveValue('');
    await expect(page.locator('.chat-message span')).toContainText('Primeira linha');
    await expect(page.locator('.chat-message time').first()).toHaveText(/^\d{2}:\d{2}$/);
    await expect(page.locator('.chat-message strong').first()).toHaveCSS('color', 'rgb(108, 180, 245)');
    await page.screenshot({ path: `test-results/chat-${info.project.name}.png` });
    if ((page.viewportSize()?.width ?? 1280) > 1000) {
      await expect(page.getByRole('button', { name: 'Abrir crônica' })).toBeVisible();
      await page.getByRole('button', { name: 'Abrir crônica' }).click();
      await expect(page.getByRole('button', { name: 'Chat', exact: true })).toHaveCount(0);
    } else {
      await expect(page.locator('.log-filters button', { hasText: 'Chat' })).toHaveCount(0);
    }

    const spectator = await spectatorContext.newPage();
    await spectator.goto(`/#/salas/${room.id}`);
    await expect(spectator.getByRole('button', { name: 'Abrir chat' })).toBeVisible();
    await spectator.evaluate(() => {
      const field = document.createElement('input');
      field.id = 'chat-shortcut-input-check';
      document.body.append(field);
      field.focus();
    });
    await spectator.keyboard.press('z');
    await expect(spectator.locator('#chat-shortcut-input-check')).toHaveValue('z');
    await expect(spectator.getByRole('button', { name: 'Abrir chat' })).toBeVisible();
    await spectator.locator('#chat-shortcut-input-check').evaluate(node => node.remove());
    await spectator.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', bubbles: true, isComposing: true })));
    await expect(spectator.getByRole('button', { name: 'Abrir chat' })).toBeVisible();
    await spectator.keyboard.press('z');
    const spectatorInput = spectator.getByRole('textbox', { name: 'Mensagem' });
    await expect(spectatorInput).toBeVisible();
    await spectatorInput.pressSequentially('z');
    await expect(spectatorInput).toHaveValue('z');
    await expect(spectator.getByRole('textbox', { name: 'Mensagem' })).toBeVisible();
    await spectatorInput.press('Escape');

    await spectator.keyboard.down('z');
    await expect(spectator.locator('.match-chat-overlay')).toHaveClass(/is-history-only/);
    await expect(spectator.getByRole('textbox', { name: 'Mensagem' })).toHaveCount(0);
    await spectator.keyboard.up('z');
    await expect(spectator.locator('.match-chat-overlay')).toHaveCount(0);
    await spectator.keyboard.down('z');
    await expect(spectator.locator('.match-chat-overlay')).toHaveClass(/is-history-only/);
    await spectator.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect(spectator.locator('.match-chat-overlay')).toHaveCount(0);
    await spectator.keyboard.up('z');
    await expect(spectator.getByRole('button', { name: 'Abrir chat' })).toBeVisible();

    await spectator.keyboard.press('z');
    await spectator.getByRole('textbox', { name: 'Mensagem' }).fill('Olá da torcida');
    await spectator.getByRole('textbox', { name: 'Mensagem' }).press('Enter');
    await expect(page.getByText('Olá da torcida')).toBeVisible();
    await spectator.getByRole('button', { name: 'Chamar atenção' }).click();
    await expect(spectator.getByRole('alert')).toHaveCount(0);

    const endpoint = `/api/rooms/${room.id}/match/chat`;
    for (let i = 0; i < 9; i += 1) await page.request.post(endpoint, { data: { body: `Mensagem ${i}` } });
    await spectator.getByRole('textbox', { name: 'Mensagem' }).press('Escape');
    await spectator.keyboard.down('z');
    await expect(spectator.locator('.match-chat-overlay')).toHaveClass(/is-history-only/);
    const list = spectator.getByLabel('Mensagens');
    await expect(list.locator('.chat-message')).toHaveCount(11);
    await list.evaluate(node => { node.scrollTop = node.scrollHeight; });
    await expect.poll(() => list.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
    await list.evaluate(node => { node.scrollTop = 0; });
    await expect(list).toHaveJSProperty('scrollTop', 0);
    await spectator.waitForTimeout(1200);
    await expect(list).toHaveJSProperty('scrollTop', 0);
    await spectator.keyboard.up('z');
    await expect(spectator.locator('.match-chat-overlay')).toHaveCount(0);
    await spectator.getByRole('button', { name: 'Abrir chat' }).click();
    await expect(list).toHaveJSProperty('scrollTop', 0);
    await page.reload();
    await page.getByRole('button', { name: 'Abrir chat' }).click();
    await expect(page.getByText('Olá da torcida')).toBeVisible();
  } finally { await spectatorContext.close(); }
});
