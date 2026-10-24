import { test, expect, closeMatchRail, closeQuickActions, openHand, openMatchRail, openQuickActions } from './fixtures';
import type { BrowserContext, Locator } from '@playwright/test';

const cardImage = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9k=', 'base64');

async function intersectsVisibleFocusNav(target: Locator) {
  if (await target.count() === 0) return false;
  return target.evaluate(element => {
    const nav = element.closest('nav');
    if (!(nav instanceof HTMLElement)) return false;
    const elementRect = element.getBoundingClientRect();
    const navRect = nav.getBoundingClientRect();
    const top = Math.max(navRect.top + nav.clientTop, 0);
    const left = Math.max(navRect.left + nav.clientLeft, 0);
    const right = Math.min(navRect.left + nav.clientLeft + nav.clientWidth, window.innerWidth);
    const bottom = Math.min(navRect.top + nav.clientTop + nav.clientHeight, window.innerHeight);
    if (right <= left || bottom <= top || elementRect.width <= 0 || elementRect.height <= 0) return false;
    return elementRect.left < right && elementRect.right > left && elementRect.top < bottom && elementRect.bottom > top;
  });
}

async function scrollThumbnailOutOfFocusNav(thumbnail: Locator) {
  await thumbnail.evaluate(button => {
    const nav = button.closest('nav');
    if (!(nav instanceof HTMLElement)) return;
    // Compact thumbnails can fit all six. Constrain the rail for this scenario
    // so the activity event must actually reveal a scrolled-out participant.
    nav.style.maxHeight = '76px';
    nav.style.overflowY = 'auto';
    nav.style.overflowY = 'auto';
    const navRect = nav.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    const visibleTop = navRect.top + nav.clientTop;
    const buttonTop = nav.scrollTop + (buttonRect.top - visibleTop);
    const buttonBottom = buttonTop + buttonRect.height;
    const maxScroll = Math.max(0, nav.scrollHeight - nav.clientHeight);
    const belowButton = buttonBottom + 1;
    const next = belowButton <= maxScroll ? belowButton : Math.max(0, buttonTop - nav.clientHeight - 1);
    nav.scrollTop = Math.min(maxScroll, next);
  });
}

test('indica a atividade do participante certo quando nomes se repetem', async ({ browser, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Coberto uma vez contra a API real.');
  const contexts: BrowserContext[] = [];
  try {
    let roomId = 0;
    for (const login of ['amigo', 'homonimo']) {
      const context = await browser.newContext({ baseURL });
      contexts.push(context);
      const api = context.request;
      expect((await api.post('/api/session', { data: { login, password: 'senha-do-navegador' } })).ok()).toBe(true);
      const uploaded = await api.post('/api/decks', { multipart: { file: { name: 'duplicado.cod', mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck version="1"><deckname>Duplicado</deckname><zone name="main"><card number="2" name="Island"/></zone></cockatrice_deck>') } } });
      const { deck } = await uploaded.json();
      if (!roomId) roomId = (await (await api.post('/api/rooms', { data: {} })).json()).room.id;
      else expect((await api.post(`/api/rooms/${roomId}/participants`, { data: {} })).ok()).toBe(true);
      expect((await api.put(`/api/rooms/${roomId}/participants/me/ready`, { data: { deckId: deck.id } })).ok()).toBe(true);
    }
    expect((await contexts[0].request.post(`/api/rooms/${roomId}/start`, { data: {} })).status()).toBe(201);
    const page = await contexts[0].newPage();
    const other = await contexts[1].newPage();
    await page.goto(`/#/salas/${roomId}`);
    await other.goto(`/#/salas/${roomId}`);
    await openMatchRail(page);
    const thumbnails = page.getByRole('navigation', { name: 'Foco da mesa' }).locator('.player-card');
    await expect(thumbnails).toHaveCount(2);
    await openQuickActions(other);
    await other.getByRole('button', { name: 'Ações', exact: true }).click();
    await other.getByRole('button', { name: 'Rolar dado', exact: true }).click();
    await other.getByRole('button', { name: 'Rolar dado', exact: true }).click();
    await expect(thumbnails.nth(1).getByText('Atividade recente', { exact: true })).toBeVisible();
    await expect(thumbnails.nth(0).getByText('Atividade recente', { exact: true })).toHaveCount(0);
    await expect(thumbnails.nth(0).getByRole('button', { name: 'Ver campo de Amigo da mesa' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('article', { name: 'Mesa de Amigo da mesa', exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Oponentes', exact: true }).getByRole('article')).toHaveCount(1);
  } finally {
    await Promise.all(contexts.map(context => context.close()));
  }
});

test('observa seis mesas mantendo mão, ações e privacidade com sincronização real', async ({ browser, baseURL }, testInfo) => {
  test.setTimeout(60_000);
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
    await page.route('**/api/cards/image?*', route => route.fulfill({ status: 200, contentType: 'image/jpeg', body: cardImage }));
    await other.route('**/api/cards/image?*', route => route.fulfill({ status: 200, contentType: 'image/jpeg', body: cardImage }));
    if (testInfo.project.name === 'celular') {
      await page.setViewportSize({ width: 844, height: 390 });
      await other.setViewportSize({ width: 844, height: 390 });
    }
    await page.goto(`/#/salas/${roomId}`);
    await other.goto(`/#/salas/${roomId}`);
    await openHand(page);
    const hand = page.getByRole('region', { name: 'Mão', exact: true });
    const openActions = async () => {
      if (!(await page.getByRole('dialog', { name: 'Ações do jogo' }).isVisible())) {
        await openQuickActions(page);
        await activate(page.getByRole('button', { name: 'Ações', exact: true }));
      }
    };
    const closeActions = () => activate(page.getByRole('button', { name: 'Fechar ações', exact: true }));
    await openQuickActions(page);
    await activate(page.getByRole('button', { name: 'Comprar', exact: true }));
    await closeQuickActions(page);
    const drawn = hand.getByRole('button', { name: 'Island', exact: true });
    await expect(drawn).toHaveCount(1);
    if (testInfo.project.name === 'celular') {
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(hand).toBeVisible();
      await openQuickActions(other);
      await activate(other.getByRole('button', { name: 'Ações', exact: true }));
      await activate(other.getByRole('button', { name: 'Rolar dado', exact: true }));
      await activate(other.getByRole('button', { name: 'Rolar dado', exact: true }));
      await activate(other.getByRole('button', { name: 'Fechar ações', exact: true }));
      await page.setViewportSize({ width: 844, height: 390 });
      await openMatchRail(page, 'Registro');
      await expect(page.getByRole('region', { name: 'Registro da partida', exact: true })).toContainText(/Segundo amigo rolou D20: \d+\./);
      await closeMatchRail(page);
      await expect(drawn).toBeVisible();
    }
    await expect(drawn.locator('img')).toBeVisible();
    await activate(drawn);
    const preview = page.getByRole('dialog', { name: 'Imagem de Island' });
    await expect(preview.getByRole('img', { name: 'Imagem ampliada de Island' })).toBeVisible();
    await activate(preview.getByRole('button', { name: 'Fechar', exact: true }));
    await expect(preview).toHaveCount(0);
    if (testInfo.project.name === 'desktop') {
      const strip = page.getByRole('region', { name: 'Oponentes', exact: true });
      await expect(strip.getByRole('article')).toHaveCount(5);
      for (const seat of await strip.getByRole('article').all()) {
        await seat.scrollIntoViewIfNeeded();
        await expect(seat).toBeInViewport();
        await expect(drawn).toBeVisible();
      }
      await page.getByRole('button', { name: 'Comprar', exact: true }).click();
      await expect(drawn).toHaveCount(2);
      await expect(other.getByRole('button', { name: 'Island', exact: true })).toHaveCount(0);
      const own = page.getByRole('article', { name: 'Mesa de Amigo da mesa', exact: true });
      const field = own.getByRole('region', { name: 'Campo', exact: true });
      await drawn.first().dragTo(field, { steps: 8 });
      const fieldCard = field.getByRole('button', { name: 'Island', exact: true });
      await expect(fieldCard).toBeVisible();
      await expect(drawn).toHaveCount(1);
      const publicField = other.getByRole('region', { name: 'Oponentes', exact: true }).getByRole('article', { name: 'Mesa de Amigo da mesa', exact: true });
      const publicCard = publicField.getByRole('region', { name: 'Campo', exact: true }).getByRole('button', { name: 'Island', exact: true });
      await expect(publicCard).toBeVisible();
      await publicCard.click();
      await expect(other.getByRole('dialog', { name: 'Imagem de Island' })).toBeVisible();
      await other.keyboard.press('Escape');
      await publicCard.dragTo(publicField.getByRole('region', { name: 'Cemitério', exact: true }), { steps: 8 });
      await expect(publicCard).toBeVisible();
      await expect(publicField.getByRole('region', { name: 'Cemitério', exact: true }).getByRole('button')).toHaveCount(0);
      await drawn.dragTo(own.getByRole('region', { name: 'Cemitério', exact: true }), { steps: 8 });
      await expect(own.getByRole('region', { name: 'Cemitério', exact: true }).getByRole('button', { name: 'Island', exact: true })).toBeVisible();
      await expect(drawn).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath('seis-mesas.png'), fullPage: true });
      return;
    }
    await openMatchRail(page);
    for (const name of ['Segundo amigo', 'Amigo 3', 'Amigo 4', 'Amigo 5', 'Amigo 6']) {
      await openMatchRail(page);
      await activate(page.getByRole('navigation', { name: 'Foco da mesa' }).getByRole('button', { name: `Ver campo de ${name}`, exact: true }));
      await expect(page.getByRole('article', { name: `Mesa de ${name}`, exact: true })).toBeVisible();
      await expect(drawn).toBeVisible();
    }
    await openActions();
    await closeActions();
    await openMatchRail(page);
    const secondThumbnail = page.getByRole('navigation', { name: 'Foco da mesa' }).getByRole('button', { name: /^Ver campo de Segundo amigo$/ });
    if (testInfo.project.name === 'celular') {
      await expect(page.locator('.activity-indicator')).toHaveCount(0);
      await scrollThumbnailOutOfFocusNav(secondThumbnail);
      await expect.poll(() => intersectsVisibleFocusNav(secondThumbnail)).toBe(false);
    }
    await openQuickActions(other);
    await activate(other.getByRole('button', { name: 'Ações', exact: true }));
    await activate(other.getByRole('button', { name: 'Rolar dado', exact: true }));
    await activate(other.getByRole('button', { name: 'Rolar dado', exact: true }));
    const recentActivity = secondThumbnail.locator('..').getByText('Atividade recente', { exact: true });
    if (testInfo.project.name === 'celular') await expect.poll(() => intersectsVisibleFocusNav(recentActivity)).toBe(true);
    else await expect(recentActivity).toBeVisible();
    await activate(other.getByRole('button', { name: 'Fechar ações', exact: true }));
    await expect(page.getByText('Observando:', { exact: false })).toContainText('Amigo 6');
    await closeMatchRail(page);
    await openQuickActions(page);
    await activate(page.getByRole('button', { name: 'Comprar', exact: true }));
    await expect(drawn).toHaveCount(2);
    await expect(page.getByRole('article', { name: 'Mesa de Amigo 6', exact: true })).toBeVisible();
    await expect(other.getByRole('button', { name: 'Island', exact: true })).toHaveCount(0);
    await openMatchRail(page);
    await activate(page.getByRole('navigation', { name: 'Foco da mesa' }).getByRole('button', { name: /^Ver campo de Amigo da mesa$/ }));
    const ownTable = page.getByRole('article', { name: 'Mesa de Amigo da mesa', exact: true });
    const field = ownTable.getByRole('region', { name: 'Campo', exact: true });
    const library = ownTable.getByRole('region', { name: 'Grimório', exact: true });
    const graveyard = ownTable.getByRole('region', { name: 'Cemitério', exact: true });
    const exile = ownTable.getByRole('region', { name: 'Exílio', exact: true });
    const command = ownTable.getByRole('region', { name: 'Comando', exact: true });
    const fieldBox = await field.boundingBox();
    const libraryBox = await library.boundingBox();
    const graveyardBox = await graveyard.boundingBox();
    const exileBox = await exile.boundingBox();
    const commandBox = await command.boundingBox();
    expect(fieldBox!.x).toBeGreaterThan(libraryBox!.x + libraryBox!.width - 4);
    const players = page.getByRole('navigation', { name: 'Foco da mesa' });
    await openMatchRail(page);
    await expect(players.locator('.player-focus')).toHaveCount(6);
    if (testInfo.project.name === 'desktop') {
      await openMatchRail(page, 'Registro');
      const logBox = await page.getByRole('region', { name: 'Registro da partida', exact: true }).boundingBox();
      const handBox = await hand.boundingBox();
      expect(logBox!.x).toBeGreaterThan(fieldBox!.x + fieldBox!.width * 0.45);
      expect(handBox!.x + handBox!.width).toBeLessThanOrEqual(logBox!.x + 12);
      const playersBox = await players.boundingBox();
      expect(logBox!.y).toBeGreaterThan(playersBox!.y + playersBox!.height);
      expect(logBox!.height).toBeGreaterThan(60);
      const stageBox = await page.locator('.table-stage').boundingBox();
      expect(Math.abs(logBox!.y + logBox!.height - (stageBox!.y + stageBox!.height))).toBeLessThan(48);
    }
    expect(libraryBox!.y).toBeGreaterThan(commandBox!.y + commandBox!.height * 0.5);
    expect(graveyardBox!.y).toBeGreaterThan(libraryBox!.y + libraryBox!.height * 0.5);
    expect(exileBox!.y).toBeGreaterThan(graveyardBox!.y + graveyardBox!.height * 0.5);
    for (const slot of [graveyardBox, exileBox, commandBox]) expect(slot!.height / slot!.width).toBeGreaterThan(1.2);
    for (const slot of [graveyardBox, exileBox, commandBox]) expect(slot!.height / slot!.width).toBeLessThan(1.6);
    await expect(library.locator('.library-stack span')).toHaveCount(3);
    await expect(library).not.toContainText('Island');
    await expect(command).toContainText('Comandante');
    await closeMatchRail(page);
    await closeQuickActions(page);
    if (testInfo.project.use.hasTouch) await drawn.first().dragTo(field, { targetPosition: { x: 36, y: 28 }, steps: 8 });
    else await drawn.first().dragTo(field, { steps: 8 });
    await expect(field.getByRole('button', { name: 'Island', exact: true })).toBeVisible();
    await expect(drawn).toHaveCount(1);
    await openMatchRail(other);
    await activate(other.getByRole('navigation', { name: 'Foco da mesa' }).getByRole('button', { name: /^Ver campo de Amigo da mesa$/ }));
    const observed = other.getByRole('article', { name: 'Mesa de Amigo da mesa', exact: true });
    const publicCard = observed.getByRole('region', { name: 'Campo', exact: true }).getByRole('button', { name: 'Island', exact: true });
    await expect(publicCard).toBeVisible();
    await activate(publicCard);
    await expect(other.getByRole('dialog', { name: 'Imagem de Island' })).toBeVisible();
    await other.keyboard.press('Escape');
    await publicCard.dragTo(observed.getByRole('region', { name: 'Cemitério', exact: true }), { steps: 8 });
    await expect(publicCard).toBeVisible();
    await expect(observed.getByRole('region', { name: 'Cemitério', exact: true }).getByRole('button')).toHaveCount(0);
    await expect(other.getByRole('region', { name: 'Mão', exact: true }).getByRole('button', { name: 'Island', exact: true })).toHaveCount(0);
    await openMatchRail(page);
    await activate(page.getByRole('navigation', { name: 'Foco da mesa' }).getByRole('button', { name: /^Ver campo de Amigo 6$/ }));
    const hiddenCard = drawn;
    const start = await hiddenCard.boundingBox();
    const column = page.getByRole('complementary', { name: 'Suas zonas' });
    if (testInfo.project.use.hasTouch) {
      const session = await page.context().newCDPSession(page);
      const origin = { x: start!.x + start!.width / 2, y: start!.y + start!.height / 2, id: 1 };
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [origin] });
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...origin, y: origin.y - 40 }] });
      await expect(column).toBeVisible();
      const drop = await column.getByRole('region', { name: 'Cemitério', exact: true }).evaluate(zone => {
        zone.scrollIntoView({ block: 'center', inline: 'nearest' });
        const box = zone.getBoundingClientRect();
        const x = Math.min(window.innerWidth - 8, Math.max(8, box.left + box.width / 2));
        const candidates = [box.top + 12, box.top + box.height / 2, box.bottom - 8].map(y => Math.min(window.innerHeight - 8, Math.max(8, y)));
        for (const y of candidates) {
          const hit = document.elementFromPoint(x, y);
          if (hit && zone.contains(hit)) return { x, y };
        }
        return { x, y: candidates[0] };
      });
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...drop, id: 1 }] });
      await page.waitForTimeout(40);
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await session.detach();
      // A short landscape screen can leave the drop column under the hand. The card menu is the reachable path.
      if (await drawn.count()) {
        await drawn.first().tap();
        const preview = page.getByRole('dialog', { name: 'Imagem de Island' });
        await preview.getByRole('button', { name: 'Mover para…', exact: true }).tap();
        await preview.getByRole('button', { name: 'Cemitério', exact: true }).tap();
        await preview.getByRole('button', { name: 'Fechar', exact: true }).tap();
      }
    } else {
      await page.mouse.move(start!.x + start!.width / 2, start!.y + start!.height / 2);
      await page.mouse.down();
      await page.mouse.move(start!.x + start!.width / 2, start!.y - 40, { steps: 6 });
      await expect(column).toBeVisible();
      const drop = await column.getByRole('region', { name: 'Cemitério', exact: true }).boundingBox();
      await page.mouse.move(drop!.x + drop!.width / 2, drop!.y + drop!.height / 2, { steps: 8 });
      await page.mouse.up();
    }
    await openMatchRail(page);
    await activate(page.getByRole('navigation', { name: 'Foco da mesa' }).getByRole('button', { name: /^Ver campo de Amigo da mesa$/ }));
    await expect(ownTable.getByRole('region', { name: 'Cemitério', exact: true }).getByRole('button', { name: 'Island', exact: true })).toBeVisible();
    await expect(drawn).toHaveCount(0);
    if (testInfo.project.name === 'desktop') {
      await activate(page.getByRole('button', { name: 'Voltar à visão geral' }));
      await expect(page.locator('.overview-player')).toHaveCount(6);
      await activate(page.getByRole('button', { name: 'Ampliar mesa de Amigo da mesa', exact: true }));
      await expect(page.getByRole('article', { name: 'Mesa de Segundo amigo', exact: true })).toBeHidden();
    }
    await page.screenshot({ path: testInfo.outputPath('seis-mesas.png'), fullPage: true });
  } finally {
    await Promise.all(contexts.map(context => context.close()));
  }
});
