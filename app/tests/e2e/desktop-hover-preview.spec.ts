import { randomUUID } from 'node:crypto';
import type { BrowserContext } from '@playwright/test';
import { test, expect, returnOpeningHandToLibrary, roomBody } from './fixtures';

test('hover no campo mostra prévia passiva sem abrir diálogo', async ({ browser, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Prévia V3 é uma interação de computador.');
  test.setTimeout(90_000);

  const contexts: BrowserContext[] = [];
  try {
    let roomId = 0;
    for (const login of ['amigo', 'segundo']) {
      const context = await browser.newContext({ baseURL });
      contexts.push(context);
      const api = context.request;
      expect((await api.post('/api/session', { data: { login, password: 'senha-do-navegador' } })).ok()).toBe(true);
      const { deck } = await (await api.post('/api/decks', { multipart: { file: { name: `${login}.cod`, mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck><zone name="main"><card number="20" name="Island"/></zone></cockatrice_deck>') } } })).json();
      if (!roomId) roomId = (await (await api.post('/api/rooms', { data: roomBody({ seats: 2 }) })).json()).room.id;
      else expect((await api.post(`/api/rooms/${roomId}/participants`, { data: {} })).ok()).toBe(true);
      expect((await api.put(`/api/rooms/${roomId}/participants/me/ready`, { data: { deckId: deck.id } })).ok()).toBe(true);
    }

    const roomPath = `/api/rooms/${roomId}`;
    expect((await contexts[0].request.post(`${roomPath}/start`, { data: {} })).status()).toBe(201);
    await Promise.all(contexts.map(context => returnOpeningHandToLibrary(context.request, roomId)));
    expect((await contexts[0].request.post(`${roomPath}/match/actions`, { data: { kind: 'create-token', intentId: randomUUID(), tokenName: 'Soldier Token' } })).ok()).toBe(true);

    const page = await contexts[0].newPage();
    await page.goto(`/#/salas/${roomId}`);
    const card = page.getByRole('article', { name: 'Mesa de Amigo da mesa', exact: true }).getByRole('button', { name: 'Soldier Token', exact: true });
    await card.hover();

    const preview = page.getByRole('region', { name: 'Prévia da carta', exact: true });
    await expect(preview.getByRole('heading', { name: 'Soldier Token', exact: true })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  } finally {
    await Promise.all(contexts.map(context => context.close()));
  }
});
