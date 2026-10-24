import { test, expect, openMatchRail, openQuickActions, returnOpeningHandToLibrary } from './fixtures';
import type { BrowserContext } from '@playwright/test';

// Images are unrelated to state permissions; all state requests use the real server.
test('faces, ocultação, revelação e virar funcionam com mouse e toque', async ({ browser, baseURL }, testInfo) => {

  const contexts: BrowserContext[] = [];
  const savedDecks: { context: BrowserContext; id: number }[] = [];
  try {
    let roomId = 0;
    for (const login of ['amigo', 'segundo']) {
      const context = await browser.newContext({ baseURL, viewport: testInfo.project.use.viewport, isMobile: testInfo.project.use.isMobile, hasTouch: testInfo.project.use.hasTouch });
      contexts.push(context);
      const api = context.request;
      expect((await api.post('/api/session', { data: { login, password: 'senha-do-navegador' } })).ok()).toBe(true);
      const uploaded = await api.post('/api/decks', { multipart: { file: { name: 'faces.cod', mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck><zone name="main"><card number="1" name="Day Test"/></zone></cockatrice_deck>') } } });
      expect(uploaded.status()).toBe(201);
      const { deck } = await uploaded.json();
      savedDecks.push({context,id:deck.id});
      if (!roomId) roomId = (await (await api.post('/api/rooms', { data: {} })).json()).room.id;
      else expect((await api.post(`/api/rooms/${roomId}/participants`, { data: {} })).ok()).toBe(true);
      expect((await api.put(`/api/rooms/${roomId}/participants/me/ready`, { data: { deckId: deck.id } })).ok()).toBe(true);
    }
    expect((await contexts[0].request.post(`/api/rooms/${roomId}/start`, { data: {} })).status()).toBe(201);
    await returnOpeningHandToLibrary(contexts[0].request, roomId);
    const action = async (fields: Record<string, unknown>) => {
      const result = await contexts[0].request.post(`/api/rooms/${roomId}/match/actions`, { data: { intentId: crypto.randomUUID(), ...fields } });
      expect(result.ok()).toBe(true); return (await result.json()).match;
    };
    const drawn = await action({ kind: 'draw', count: 1 });
    const card = drawn.players[0].hand[0];
    await action({ kind: 'move', cardIds: [card.id], to: 'battlefield' });
    const page = await contexts[0].newPage(); const other = await contexts[1].newPage();
    // A failed image is deterministic and still leaves names and actions available.
    const imageNames: string[] = [];
    await page.route('**/api/cards/image?*', route => { imageNames.push(new URL(route.request().url()).searchParams.get('name') ?? ''); return route.fulfill({ status: 502, body: 'unavailable' }); });
    await other.route('**/api/cards/image?*', route => route.fulfill({ status: 502, body: 'unavailable' }));
    await page.goto(`/#/salas/${roomId}`); await other.goto(`/#/salas/${roomId}`);
    const field = page.getByRole('article', { name: 'Mesa de Amigo da mesa', exact: true }).getByRole('region', { name: 'Campo', exact: true });
    const button = field.getByRole('button', { name: 'Day Test', exact: true });
    await expect(button).toBeVisible();
    if (testInfo.project.name === 'desktop') {
      await button.dblclick(); await expect(button).toHaveAttribute('data-tapped', 'true');
      await expect(page.getByRole('dialog', { name: 'Imagem de Day Test' })).toHaveCount(0);
    } else {
      await button.evaluate(element => {
        const at = { bubbles: true, cancelable: true, pointerType: 'touch', pointerId: 1, button: 0, clientX: 20, clientY: 20 };
        element.dispatchEvent(new PointerEvent('pointerdown', at));
        element.dispatchEvent(new PointerEvent('pointerup', at));
        element.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
        element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, detail: 2 }));
      });
      await expect(button).toHaveAttribute('data-tapped', 'false');
      const touchPreview = page.getByRole('dialog', { name: 'Imagem de Day Test' });
      await expect(touchPreview).toBeVisible();
      await touchPreview.getByRole('button', { name: 'Fechar', exact: true }).click();
    }
    await button.click();
    const preview = page.getByRole('dialog', { name: 'Imagem de Day Test' });
    await expect(preview).toBeVisible();
    if (testInfo.project.name !== 'desktop') {
      await preview.getByRole('button', { name: 'Virar', exact: true }).tap();
      await expect(button).toHaveAttribute('data-tapped', 'true');
    }
    await preview.getByRole('button', { name: 'Outras ações', exact: true }).click();
    await preview.getByLabel('Face da carta').selectOption('1');
    await expect.poll(() => imageNames.includes('Night Test')).toBe(true);
    await preview.getByRole('button', { name: 'Colocar face para baixo', exact: true }).click();
    await expect(button).toHaveAttribute('data-face-down', 'true');
    await preview.getByRole('button', { name: 'Fechar', exact: true }).click();
    const otherField = other.getByRole('article', { name: 'Mesa de Amigo da mesa', exact: true }).getByRole('region', { name: 'Campo', exact: true });
    await openMatchRail(other);
    if (testInfo.project.name !== 'desktop') await other.getByRole('navigation', { name: 'Foco da mesa' }).getByRole('button', { name: /^Ver campo de Amigo da mesa$/ }).tap();
    await expect(otherField.getByRole('button', { name: 'Carta face para baixo', exact: true })).toBeVisible();
    await expect(otherField.getByRole('button', { name: 'Day Test', exact: true })).toHaveCount(0);
    await button.click();
    await preview.getByRole('button', { name: 'Outras ações', exact: true }).click();
    await preview.getByRole('button', { name: 'Revelar para todos', exact: true }).click();
    await expect(otherField.getByRole('button', { name: 'Day Test', exact: true })).toBeVisible();
    await preview.getByRole('button', { name: 'Colocar face para cima', exact: true }).click();
    await preview.getByLabel('Manter revelada ao fechar (até passar o turno)').check();
    await expect(preview.getByLabel('Face da carta')).toHaveValue('1');
    await preview.getByRole('button', { name: 'Fechar', exact: true }).click();
    await openQuickActions(page);
    await page.getByRole('button', { name: 'Desvirar todas', exact: true }).click();
    await expect(button).toHaveAttribute('data-tapped', 'false');
    await action({ kind: 'move', cardIds: [card.id], to: 'library', libraryPlacement: 'bottom' });
    const exposed = page.getByRole('region', { name: 'Cartas reveladas de Amigo da mesa', exact: true });
    await expect(exposed.getByRole('button', { name: 'Day Test', exact: true })).toBeVisible();
    await page.reload();
    await exposed.getByRole('button', { name: 'Day Test', exact: true }).click();
    await preview.getByRole('button', { name: 'Outras ações', exact: true }).click();
    await preview.getByRole('button', { name: 'Ocultar revelação', exact: true }).click();
    await expect(other.getByRole('region', { name: 'Cartas reveladas de Amigo da mesa', exact: true })).toHaveCount(0);
  } finally {
    for (const {context,id} of savedDecks) await context.request.delete(`/api/decks/${id}`);
    await Promise.all(contexts.map(context => context.close()));
  }
});
