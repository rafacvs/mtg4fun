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
    await activate(own.getByRole('button', { name: 'Consultar todo o grimório' }));
    await own.getByLabel('Buscar no grimório').fill('Fire');
    await own.locator('.consult-cards label', { hasText: 'Fire // Ice' }).getByRole('checkbox').check();
    await activate(own.getByRole('button', { name: 'Mover comandante para comando' }));
    await expect(own.getByRole('region', { name: 'Comando', exact: true }).getByRole('button', { name: 'Fire // Ice', exact: true })).toBeVisible();
    await activate(opponent.getByRole('navigation', { name: 'Foco da mesa' }).getByRole('button', { name: /Amigo da mesa/ }));
    const observed = opponent.getByRole('article', { name: 'Mesa de Amigo da mesa', exact: true });
    await expect(observed.getByRole('region', { name: 'Comando', exact: true }).getByRole('button', { name: 'Fire // Ice', exact: true })).toBeVisible();
    await expect(opponent.locator('.consult-cards')).toHaveCount(0);
  } finally { await Promise.all(contexts.map(context => context.close())); }
});
