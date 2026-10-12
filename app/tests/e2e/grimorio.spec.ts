import { test, expect } from './fixtures';
import type { BrowserContext, Locator } from '@playwright/test';

test('localiza e separa o comandante no comando sem revelar a consulta', async ({ browser, baseURL }, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'a partida bloqueia orientação vertical');
  const contexts: BrowserContext[] = [];
  const activate = async (button: Locator) => testInfo.project.use.hasTouch ? button.tap() : button.click();
  try {
    let roomId = 0;
    for (const login of ['amigo', 'segundo']) {
      const context = await browser.newContext({ baseURL, viewport: testInfo.project.use.viewport, isMobile: testInfo.project.use.isMobile, hasTouch: testInfo.project.use.hasTouch });
      contexts.push(context);
      const api = context.request;
      expect((await api.post('/api/session', { data: { login, password: 'senha-do-navegador' } })).ok()).toBe(true);
      const uploaded = await api.post('/api/decks', { multipart: { file: { name: 'comandante.cod', mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck version="1"><deckname>Comandante</deckname><zone name="main"><card number="1" name="Fire // Ice"/><card number="5" name="Island"/></zone></cockatrice_deck>') } } });
      expect(uploaded.status()).toBe(201);
      const { deck } = await uploaded.json();
      if (!roomId) { const created = await api.post('/api/rooms', { data: {} }); roomId = (await created.json()).room.id; }
      else expect((await api.post(`/api/rooms/${roomId}/participants`, { data: {} })).ok()).toBe(true);
      expect((await api.put(`/api/rooms/${roomId}/participants/me/ready`, { data: { deckId: deck.id } })).ok()).toBe(true);
    }
    expect((await contexts[0].request.post(`/api/rooms/${roomId}/start`, { data: {} })).status()).toBe(201);
    const own = await contexts[0].newPage();
    const opponent = await contexts[1].newPage();
    if (testInfo.project.name === 'celular-horizontal') { await own.setViewportSize({ width: 844, height: 390 }); await opponent.setViewportSize({ width: 844, height: 390 }); }
    await own.goto(`/#/salas/${roomId}`);
    await opponent.goto(`/#/salas/${roomId}`);
    const hand = own.getByRole('region', { name: 'Mão', exact: true });
    const grimorioToggle = own.getByRole('button', { name: 'Grimório', exact: true });
    const actionsToggle = own.getByRole('button', { name: 'Ações', exact: true });
    await expect(hand).toBeVisible();
    const handBox = (await hand.boundingBox())!;
    const grimorioBox = (await grimorioToggle.boundingBox())!;
    const actionsBox = (await actionsToggle.boundingBox())!;
    const coversHand = (button: { x: number; y: number; width: number; height: number }) =>
      handBox.x < button.x + button.width - 2 && handBox.x + handBox.width > button.x + 2 && handBox.y < button.y + button.height - 2 && handBox.y + handBox.height > button.y + 2;
    expect(coversHand(grimorioBox)).toBe(false);
    expect(coversHand(actionsBox)).toBe(false);
    expect(actionsBox.x).toBeGreaterThan(grimorioBox.x);
    expect(Math.abs(actionsBox.y - grimorioBox.y)).toBeLessThan(12);
    const library = own.getByRole('dialog', { name: 'Consultar grimório' });
    const log = own.getByRole('region', { name: 'Registro da partida', exact: true });
    await expect(own.getByRole('button', { name: 'Consultar todo o grimório' })).toHaveCount(0);
    await activate(own.getByRole('button', { name: 'Grimório', exact: true }));
    await expect(library).toBeVisible();
    await activate(own.getByRole('button', { name: 'Ações', exact: true }));
    await expect(library).toHaveCount(0);
    await expect(own.getByRole('dialog', { name: 'Ações do jogo' })).toBeVisible();
    await activate(own.getByRole('button', { name: 'Grimório', exact: true }));
    await expect(own.getByRole('dialog', { name: 'Ações do jogo' })).toHaveCount(0);
    await expect(library).toBeVisible();
    await own.getByLabel('Quantidade para consultar').fill('2');
    await activate(own.getByRole('button', { name: 'Ver as cartas', exact: true }));
    const consulted = library.locator('.consult-row');
    await expect(consulted).toHaveCount(2);
    const topNames = (await consulted.allTextContents()).map(name => name.trim()).filter(Boolean);
    const opponentLog = opponent.getByRole('region', { name: 'Registro da partida', exact: true });
    await expect(opponentLog).toContainText('consultou o grimório');
    await expect(opponent.locator('.consult-cards')).toHaveCount(0);
    for (const name of topNames) await expect(opponent.locator('body')).not.toContainText(name);
    await library.getByLabel('O que sobrou').selectOption('top');
    await activate(own.getByRole('button', { name: 'Concluir', exact: true }));
    await expect(log).toContainText('fechou a consulta do grimório');
    await expect(log).not.toContainText('embaralhou');
    await expect(opponent.locator('.consult-cards')).toHaveCount(0);
    await library.getByLabel('De onde').selectOption('all');
    await activate(own.getByRole('button', { name: 'Ver as cartas', exact: true }));
    await own.getByLabel('Buscar no grimório').fill('Fire');
    await expect(library.locator('.consult-row', { hasText: 'Island' })).toHaveCount(0);
    await expect(library.locator('.consult-row')).toHaveCount(1);
    await expect(library.locator('.consult-row')).toContainText('Fire // Ice');
    await library.locator('.consult-row', { hasText: 'Fire // Ice' }).click();
    await library.getByLabel('Enviar para').selectOption('command');
    await activate(own.getByRole('button', { name: 'Enviar', exact: true }));
    await expect(own.getByRole('region', { name: 'Comando', exact: true }).getByRole('button', { name: 'Fire // Ice', exact: true })).toBeVisible();
    await library.getByLabel('O que sobrou').selectOption('shuffle');
    await activate(own.getByRole('button', { name: 'Concluir', exact: true }));
    await expect(own.getByRole('button', { name: 'Ver as cartas', exact: true })).toBeVisible();
    await activate(opponent.getByRole('navigation', { name: 'Foco da mesa' }).getByRole('button', { name: /Amigo da mesa/ }));
    const observed = opponent.getByRole('article', { name: 'Mesa de Amigo da mesa', exact: true });
    await expect(observed.getByRole('region', { name: 'Comando', exact: true }).getByRole('button', { name: 'Fire // Ice', exact: true })).toBeVisible();
    await expect(opponent.locator('.consult-cards')).toHaveCount(0);
  } finally { await Promise.all(contexts.map(context => context.close())); }
});
