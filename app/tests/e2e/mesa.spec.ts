import { test, expect } from './fixtures';
import type { BrowserContext, Locator } from '@playwright/test';

test('observa seis mesas mantendo mão, ações e privacidade com sincronização real', async ({ browser, baseURL }, testInfo) => {
  const contexts: BrowserContext[] = [];
  const activate = async (button: Locator) => testInfo.project.use.hasTouch ? button.tap() : button.click();
  try {
    let roomId = 0;
    for (const login of ['amigo', 'segundo', 'amigo3', 'amigo4', 'amigo5', 'amigo6']) {
      const context = await browser.newContext({ baseURL, viewport: testInfo.project.use.viewport, isMobile: testInfo.project.use.isMobile, hasTouch: testInfo.project.use.hasTouch });
      contexts.push(context);
      const api = context.request;
      expect((await api.post('/api/session', { data: { login, password: 'senha-do-navegador' } })).ok()).toBe(true);
      const uploaded = await api.post('/api/decks', { multipart: { file: { name: 'mesa.cod', mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck version="1"><deckname>Mesa</deckname><zone name="main"><card number="5" name="Island"/></zone></cockatrice_deck>') } } });
      expect(uploaded.status()).toBe(201);
      const { deck } = await uploaded.json();
      if (!roomId) {
        const created = await api.post('/api/rooms', { data: {} });
        expect(created.status()).toBe(201);
        roomId = (await created.json()).room.id;
      } else {
        expect((await api.post(`/api/rooms/${roomId}/participants`, { data: {} })).ok()).toBe(true);
      }
      expect((await api.put(`/api/rooms/${roomId}/participants/me/ready`, { data: { deckId: deck.id } })).ok()).toBe(true);
    }
    expect((await contexts[0].request.post(`/api/rooms/${roomId}/start`, { data: {} })).status()).toBe(201);
    const page = await contexts[0].newPage();
    const other = await contexts[1].newPage();
    if (testInfo.project.name === 'celular') {
      await page.setViewportSize({ width: 844, height: 390 });
      await other.setViewportSize({ width: 844, height: 390 });
    }
    await page.goto(`/#/salas/${roomId}`);
    await other.goto(`/#/salas/${roomId}`);
    const hand = page.getByRole('region', { name: 'Mão', exact: true });
    await activate(page.getByRole('button', { name: 'Comprar cartas', exact: true }));
    await expect(hand.getByRole('button', { name: 'Island', exact: true })).toHaveCount(1);
    for (const name of ['Segundo amigo', 'Amigo 3', 'Amigo 4', 'Amigo 5', 'Amigo 6']) {
      await activate(page.getByRole('navigation', { name: 'Foco da mesa' }).getByRole('button', { name: new RegExp(name) }));
      await expect(page.getByRole('article', { name: `Mesa de ${name}`, exact: true })).toBeVisible();
      await expect(hand.getByRole('button', { name: 'Island', exact: true })).toBeVisible();
    }
    await activate(page.getByRole('button', { name: 'Comprar cartas', exact: true }));
    await expect(hand.getByRole('button', { name: 'Island', exact: true })).toHaveCount(2);
    await expect(page.getByRole('article', { name: 'Mesa de Amigo 6', exact: true })).toBeVisible();
    await expect(other.getByRole('button', { name: 'Island', exact: true })).toHaveCount(0);
    await activate(hand.getByRole('button', { name: 'Island', exact: true }).first());
    await activate(page.getByRole('button', { name: 'Mover para Campo', exact: true }));
    await expect(hand.getByRole('button', { name: 'Island', exact: true })).toHaveCount(1);
    await activate(other.getByRole('navigation', { name: 'Foco da mesa' }).getByRole('button', { name: /Amigo da mesa/ }));
    const observed = other.getByRole('article', { name: 'Mesa de Amigo da mesa', exact: true });
    await expect(observed.getByRole('button', { name: 'Island', exact: true })).toBeVisible();
    await activate(observed.getByRole('button', { name: 'Island', exact: true }));
    await expect(other.getByText('· Carta do oponente', { exact: false })).toBeVisible();
    await expect(other.getByRole('button', { name: 'Mover para Cemitério', exact: true })).toHaveCount(0);
    await expect(other.getByRole('region', { name: 'Mão', exact: true }).getByRole('button')).toHaveCount(0);
    if (testInfo.project.name === 'desktop') {
      await activate(page.getByRole('button', { name: 'Ver todas as mesas' }));
      await expect(page.getByRole('article', { name: /^Mesa de/ })).toHaveCount(6);
      await activate(page.getByRole('button', { name: 'Ampliar mesa de Amigo da mesa', exact: true }));
      await expect(page.getByRole('article', { name: 'Mesa de Segundo amigo', exact: true })).toBeHidden();
    }
    await page.screenshot({ path: testInfo.outputPath('seis-mesas.png'), fullPage: true });
  } finally {
    await Promise.all(contexts.map(context => context.close()));
  }
});
