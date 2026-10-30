import { readFileSync } from 'node:fs';
import type { APIRequestContext, Locator } from '@playwright/test';
import type { Match } from '../../src/features/rooms/roomsApi';
import { test, expect, inspectCard, openMatchRail, closeMatchRail, openHand, openQuickActions, closeQuickActions, returnOpeningHandToLibrary, roomBody } from './fixtures';

const fallbackArt = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 63 88"><rect width="63" height="88" rx="3" fill="#adb9a1"/><rect x="3" y="3" width="57" height="7" rx="2" fill="#dedbc1"/><text x="5" y="8" font-size="4" font-family="serif">Island</text><rect x="4" y="13" width="55" height="40" fill="#406571"/><path d="M4 45 20 23 35 44 46 28 59 45v8H4Z" fill="#9ca98f"/><rect x="4" y="56" width="55" height="28" fill="#d7d9be"/><text x="6" y="65" font-size="4">Basic Land — Island</text></svg>';

async function seed(requests: APIRequestContext[]) {
  let roomId = 0;
  const logins = ['amigo', 'segundo', 'amigo3', 'amigo4', 'amigo5', 'amigo6'];
  for (const [index, api] of requests.entries()) {
    expect((await api.post('/api/session', { data: { login: logins[index], password: 'senha-do-navegador' } })).ok()).toBe(true);
    const uploaded = await api.post('/api/decks', { multipart: { file: { name: 'mesa-visual.cod', mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck><zone name="main"><card number="25" name="Island"/></zone></cockatrice_deck>') } } });
    const { deck } = await uploaded.json();
    if (!roomId) roomId = (await (await api.post('/api/rooms', { data: roomBody() })).json()).room.id;
    else expect((await api.post(`/api/rooms/${roomId}/participants`, { data: {} })).ok()).toBe(true);
    expect((await api.put(`/api/rooms/${roomId}/participants/me/ready`, { data: { deckId: deck.id } })).ok()).toBe(true);
  }
  expect((await requests[0].post(`/api/rooms/${roomId}/start`, { data: {} })).status()).toBe(201);
  for (const api of requests) await returnOpeningHandToLibrary(api, roomId);
  const action = async (data: Record<string, unknown>, api = requests[0]): Promise<Match> => {
    const response = await api.post(`/api/rooms/${roomId}/match/actions`, { data: { intentId: crypto.randomUUID(), ...data } });
    expect(response.ok(), await response.text()).toBe(true);
    return (await response.json()).match;
  };
  for (const api of requests) {
    const match = await action({ kind: 'draw', count: 9 }, api);
    const hand = match.players.find(player => player.userId === match.viewerId)!.hand!;
    await action({ kind: 'move', cardIds: [hand[0].id], to: 'command' }, api);
    await action({ kind: 'move', cardIds: hand.slice(1, 5).map(card => card.id), to: 'battlefield' }, api);
    for (const [index, card] of hand.slice(1, 5).entries()) await action({ kind: 'position', cardIds: [card.id], x: index, row: 0 }, api);
    await action({ kind: 'set_tapped', cardIds: [hand[2].id], tapped: true }, api);
  }
  return { roomId, action };
}

async function withinViewport(panel: Locator) {
  await expect(panel).toBeVisible();
  expect(await panel.evaluate(element => {
    const box = element.getBoundingClientRect();
    return box.left >= 0 && box.top >= 0 && box.right <= innerWidth + 1 && box.bottom <= innerHeight + 1;
  })).toBe(true);
}

test('mão, zonas e controles do campo aparecem corretamente em Chromium', async ({ page }, info) => {
  test.setTimeout(90_000);
  const { roomId } = await seed([page.request]);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/cards/image?*', route => route.fulfill({ contentType: 'image/svg+xml', body: fallbackArt }));
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`/#/salas/${roomId}`);
  const own = page.getByRole('article', { name: 'Mesa de Amigo da mesa', exact: true });
  const hand = page.getByRole('region', { name: 'Mão', exact: true });
  await expect(hand).toBeVisible();
  await expect(hand.getByRole('button', { name: 'Organizar', exact: true })).toHaveCount(0);
  await expect(own.locator('.seat-status-line small')).toHaveCount(0);
  const turnBadge = own.locator('.field-turn-label');
  await expect(turnBadge).toBeVisible();
  const focusButton = own.getByRole('button', { name: 'Focar campo de Amigo da mesa' });
  const fitButton = own.getByRole('button', { name: 'Centralizar campo de Amigo da mesa' });
  await expect(focusButton).toBeVisible();
  await expect(fitButton).toBeVisible();
  const badgeBox = (await turnBadge.boundingBox())!;
  const focusBox = (await focusButton.boundingBox())!;
  const fitBox = (await fitButton.boundingBox())!;
  expect(badgeBox.x).toBeGreaterThanOrEqual(fitBox.x + fitBox.width);
  expect(fitBox.x).toBeGreaterThanOrEqual(focusBox.x + focusBox.width);
  expect(Math.abs(badgeBox.y + badgeBox.height / 2 - fitBox.y - fitBox.height / 2)).toBeLessThan(2);
  expect(await turnBadge.evaluate(element => getComputedStyle(element).clipPath)).toContain('polygon');
  const cards = hand.locator('[data-card-id]');
  await expect(cards).toHaveCount(4);
  const ids = await cards.evaluateAll(nodes => nodes.map(node => node.getAttribute('data-card-id')));
  const source = (await cards.nth(0).boundingBox())!;
  const target = (await cards.nth(1).boundingBox())!;
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + 3, target.y + 3, { steps: 8 });
  await page.mouse.up();
  await expect(cards.nth(0)).toHaveAttribute('data-card-id', ids[1]!);
  await expect(cards.nth(1)).toHaveAttribute('data-card-id', ids[0]!);
  const visibleHeight = await cards.nth(0).evaluate(element => element.getBoundingClientRect().height);
  const cardWidth = await cards.nth(0).evaluate(element => element.getBoundingClientRect().width);
  expect(visibleHeight).toBeGreaterThan(cardWidth * 88 / 63 * .42);
  await page.mouse.move(640, 400);
  await page.waitForTimeout(400);
  const preview = page.locator('.card-hover-zoom');
  await page.mouse.move((await cards.nth(0).boundingBox())!.x + 20, (await cards.nth(0).boundingBox())!.y + 20);
  await page.waitForTimeout(250);
  await expect(preview).toHaveCount(0);
  await expect(preview).toBeVisible({ timeout: 1_000 });
  await page.mouse.move(640, 400);
  await page.waitForTimeout(400);
  await page.screenshot({ animations: 'disabled', path: info.outputPath('mesa-mao-e-zonas.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('o pin foca qualquer campo e retorna à visão geral', async ({ page, browser, baseURL }, testInfo) => {
  test.setTimeout(90_000);
  const opponent = await browser.newContext({ baseURL });
  try {
    const { roomId } = await seed([page.request, opponent.request]);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`/#/salas/${roomId}`);
    const fields = page.locator('.desktop-fields');
    const ownSurface = fields.locator('.own-table-surface');
    const opponentSurface = fields.locator('.opponent-table-surface');
    await expect(ownSurface).toBeVisible();
    await expect(opponentSurface).toBeVisible();
    const toolbarBox = (await page.locator('.table-toolbar').boundingBox())!;
    const stageBox = (await page.locator('.table-stage').boundingBox())!;
    const fieldsBox = (await fields.boundingBox())!;
    const dockBox = (await page.locator('.own-dock').boundingBox())!;
    const handLabel = page.locator('.own-dock .dock-toggle > span');
    const opponentBox = (await opponentSurface.boundingBox())!;
    const ownBox = (await ownSurface.boundingBox())!;
    await expect(handLabel).toBeVisible();
    const handLabelBox = (await handLabel.boundingBox())!;
    expect(handLabelBox.x).toBeGreaterThanOrEqual(dockBox.x + 20);
    expect(handLabelBox.x + handLabelBox.width).toBeLessThanOrEqual(dockBox.x + dockBox.width);
    expect(Math.abs(stageBox.y - toolbarBox.y - toolbarBox.height)).toBeLessThanOrEqual(1);
    expect(Math.abs(fieldsBox.y - stageBox.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(fieldsBox.x - stageBox.x - 3)).toBeLessThanOrEqual(1);
    expect(Math.abs(dockBox.y - fieldsBox.y - fieldsBox.height)).toBeLessThanOrEqual(1);
    expect(Math.abs(ownBox.y - opponentBox.y - opponentBox.height)).toBeLessThanOrEqual(1);
    expect(Math.abs(stageBox.y + stageBox.height - dockBox.y - dockBox.height - 3)).toBeLessThanOrEqual(1);
    await page.screenshot({ animations: 'disabled', path: testInfo.outputPath('campos-sem-gaps.png') });

    await page.getByRole('button', { name: 'Focar campo de Segundo amigo' }).click();
    await expect(opponentSurface).toHaveClass(/focused-table-surface/);
    await expect(ownSurface).toBeHidden();
    await page.getByRole('button', { name: 'Voltar à visão geral' }).click();
    await expect(fields).not.toHaveClass(/has-field-focus/);
    await expect(ownSurface).toBeVisible();
    await expect(opponentSurface).toBeVisible();

    await page.getByRole('button', { name: 'Focar campo de Amigo da mesa' }).click();
    await expect(ownSurface).toHaveClass(/focused-table-surface/);
    await expect(opponentSurface).toBeHidden();
    await page.getByRole('button', { name: 'Voltar à visão geral' }).click();
    await expect(fields).not.toHaveClass(/has-field-focus/);
    await expect(opponentSurface).toBeVisible();
  } finally {
    await opponent.close();
  }
});

test('mesa responsiva, menus, jogador, carta e visão geral usam o servidor real', async ({ page, browser, baseURL }, info) => {
  test.setTimeout(90_000);
  const contexts = await Promise.all(Array.from({ length: 5 }, () => browser.newContext({ baseURL })));
  try {
    const { roomId, action } = await seed([page.request, ...contexts.map(context => context.request)]);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    // Only artwork is controlled. Every game operation reaches the real Go API and MySQL.
    await page.route('**/api/cards/image?*', route => route.fulfill(process.env.UI_CARD_IMAGE ? { contentType: 'image/jpeg', body: readFileSync(process.env.UI_CARD_IMAGE) } : { contentType: 'image/svg+xml', body: fallbackArt }));
    await page.goto(`/#/salas/${roomId}`);
    await expect(page.locator('.own-dock')).toBeAttached();
    await openHand(page);
    const own = page.getByRole('article', { name: 'Mesa de Amigo da mesa', exact: true });
    const playerName = own.locator('.seat-name-line h2');
    const handCount = own.locator('.seat-name-line .seat-hand-count');
    await expect(handCount).toBeVisible();
    await expect(handCount.locator('.table-icon')).toBeVisible();
    const playerNameBox = (await playerName.boundingBox())!;
    const handCountBox = (await handCount.boundingBox())!;
    expect(handCountBox.x).toBeGreaterThanOrEqual(playerNameBox.x + playerNameBox.width);
    expect(Math.abs(handCountBox.y + handCountBox.height / 2 - playerNameBox.y - playerNameBox.height / 2)).toBeLessThan(5);
    const isDesktop = (page.viewportSize()?.width ?? 1280) > 1000;
    const turnBadge = isDesktop ? page.locator('.field-turn-label') : page.locator('.seat-heading .seat-turn');
    await expect(turnBadge).toBeVisible();
    if (isDesktop) {
      const tools = turnBadge.locator('..');
      const fit = tools.locator('.field-center');
      const turnBadgeBox = (await turnBadge.boundingBox())!;
      const fitBox = (await fit.boundingBox())!;
      expect(turnBadgeBox.x).toBeGreaterThan(fitBox.x + fitBox.width);
    }
    for (const selector of ['.zone-library .library-pile', '.card-slot.zone-graveyard', '.card-slot.zone-exile']) {
      const pile = own.locator(selector);
      const emblem = pile.locator('.zone-emblem .table-icon');
      const count = pile.locator('> .zone-count');
      await expect(emblem).toBeVisible();
      await expect(count).toBeVisible();
      await expect(count).toHaveText(/^\d+$/);
      const pileBox = (await pile.boundingBox())!;
      const emblemBox = (await emblem.boundingBox())!;
      const countBox = (await count.boundingBox())!;
      expect(Math.abs(emblemBox.x + emblemBox.width / 2 - pileBox.x - pileBox.width / 2)).toBeLessThan(2);
      expect(Math.abs(emblemBox.y + emblemBox.height / 2 - pileBox.y - pileBox.height / 2)).toBeLessThan(2);
      expect(countBox.x).toBeGreaterThan(pileBox.x + pileBox.width / 2);
      expect(countBox.y).toBeLessThan(pileBox.y + pileBox.height / 2);
      expect(Math.abs(countBox.width - countBox.height)).toBeLessThan(2);
    }
    const battlefield = own.getByRole('region', { name: 'Campo', exact: true });
    const centerField = battlefield.getByRole('button', { name: /^Centralizar campo/ });
    const playerTableBox = (await own.boundingBox())!;
    const centerFieldBox = (await centerField.boundingBox())!;
    expect(Math.abs(centerFieldBox.y - playerTableBox.y)).toBeLessThanOrEqual(2);
    expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('.field-center') !== null, { x: centerFieldBox.x + centerFieldBox.width / 2, y: centerFieldBox.y + centerFieldBox.height / 2 })).toBe(true);
    await openQuickActions(page);
    const quick = page.getByRole('navigation', { name: 'Ações rápidas' });
    const hand = page.getByRole('region', { name: 'Mão', exact: true });
    await expect(hand.getByRole('button', { name: 'Island', exact: true })).toHaveCount(4);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await quick.getByRole('button', { name: 'Comprar', exact: true }).evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(info.project.use.hasTouch ? 44 : 36);
    const handBox = (await hand.boundingBox())!;
    const quickBox = (await quick.boundingBox())!;
    if (info.project.name === 'desktop') {
      const dockBox = await page.locator('.own-dock').boundingBox();
      expect(dockBox).not.toBeNull();
      // The desktop bar is a thin 80px strip for the controls; the hand
      // fans above it over the bottom of the field.
      expect(dockBox!.height).toBeGreaterThanOrEqual(76);
      expect(dockBox!.height).toBeLessThanOrEqual(84);
      expect(quickBox.x).toBeGreaterThanOrEqual(handBox.x + handBox.width);
    }
    else expect(quickBox.y + quickBox.height).toBeLessThanOrEqual(handBox.y);
    await closeQuickActions(page);
    await page.screenshot({ animations: 'disabled', path: info.outputPath('01-mesa.png'), fullPage: true });

    const trigger = own.getByRole('button', { name: 'Abrir ações do grimório' });
    await trigger.click();
    const library = page.getByRole('dialog', { name: 'Grimório', exact: true });
    await withinViewport(library);
    const menuBox = (await library.boundingBox())!;
    expect(menuBox.width).toBeLessThanOrEqual(info.project.name === 'celular' ? 400 : 430);
    if (info.project.name !== 'celular-horizontal') expect(menuBox.height).toBeGreaterThan(menuBox.width);
    await expect(library.locator('.library-tile')).toHaveCount(5);
    if (info.project.name === 'desktop') {
      const origin = (await trigger.boundingBox())!;
      expect(Math.abs(menuBox.x - origin.x - origin.width)).toBeLessThan(24);
    }
    await page.screenshot({ animations: 'disabled', path: info.outputPath('02-grimorio.png'), fullPage: true });
    await library.getByRole('button', { name: 'Olhar cartas', exact: true }).click();
    await library.getByLabel('Quantidade de cartas').fill('2');
    await library.getByRole('button', { name: 'Olhar 2 cartas do topo', exact: true }).click();
    await expect(library.locator('.library-card')).toHaveCount(2);
    await withinViewport(library);
    await library.getByRole('button', { name: /^(Fechar painel do grimório|Minimizar consulta)$/ }).click();
    await trigger.click();
    await expect(library.locator('.library-card')).toHaveCount(2);
    await library.getByRole('button', { name: /^(Fechar painel do grimório|Minimizar consulta)$/ }).click();

    await openQuickActions(page);
    await quick.getByRole('button', { name: 'Ações', exact: true }).click();
    const actions = page.getByRole('dialog', { name: 'Ações do jogo', exact: true });
    await withinViewport(actions);
    const toolbarBox = (await page.locator('.table-toolbar').boundingBox())!;
    expect((await actions.boundingBox())!.y).toBeGreaterThanOrEqual(toolbarBox.y + toolbarBox.height);
    await expect(actions.locator('.table-menu-item')).toHaveCount(4);
    for (const name of ['Comprar cartas', 'Grimório', 'Embaralhar grimório', 'Vida', 'Marcadores']) await expect(actions.getByRole('button', { name, exact: true })).toHaveCount(0);
    await page.screenshot({ animations: 'disabled', path: info.outputPath('03-acoes.png'), fullPage: true });
    await actions.getByRole('button', { name: 'Rolar dado', exact: true }).click();
    await actions.getByRole('button', { name: /^Rolar d\d+$/ }).click();
    await actions.getByRole('button', { name: 'Fechar ações' }).click();
    await expect(info.project.name === 'desktop' ? quick.getByRole('button', { name: 'Ações', exact: true }) : page.getByRole('button', { name: 'Comandos', exact: true })).toBeFocused();

    await own.getByRole('button', { name: 'Abrir jogador Amigo da mesa' }).click();
    const playerMenu = page.getByRole('dialog', { name: 'Jogador Amigo da mesa' });
    if (info.project.name === 'desktop') {
      const life = own.getByRole('button', { name: 'Abrir jogador Amigo da mesa', exact: true });
      const menuBox = (await playerMenu.boundingBox())!;
      const lifeBox = (await life.boundingBox())!;
      expect(Math.abs(menuBox.x - lifeBox.x)).toBeLessThan(48);
      // Anchored to the trigger: below it, or above it when there is no room, never covering it.
      expect(menuBox.y >= lifeBox.y || menuBox.y + menuBox.height <= lifeBox.y + 1, JSON.stringify({ menuBox, lifeBox })).toBe(true);
    }
    await expect(playerMenu.getByRole('button', { name: 'Vida', exact: true })).toHaveCount(0);
    await playerMenu.getByRole('button', { name: 'Diminuir vida', exact: true }).click();
    await expect(own.getByLabel('Vida: 39')).toBeVisible();
    await playerMenu.getByRole('button', { name: 'Aumentar marcador vermelho' }).click();
    await expect(own.getByLabel('marcador vermelho', { exact: true })).toHaveText('1');
    await page.screenshot({ animations: 'disabled', path: info.outputPath('04-jogador.png'), fullPage: true });
    await playerMenu.getByRole('button', { name: 'Fechar jogador' }).click();

    await inspectCard(page, hand.getByRole('button', { name: 'Island', exact: true }).first());
    const inspector = page.getByRole('dialog', { name: 'Imagem de Island' });
    await withinViewport(inspector);
    await page.screenshot({ animations: 'disabled', path: info.outputPath('05-carta.png'), fullPage: true });
    await inspector.getByLabel('Poder', { exact: true }).fill('2');
    await inspector.getByLabel('Poder', { exact: true }).press('Enter');
    await expect(hand.getByLabel('Poder e resistência')).toHaveCount(0);
    await inspector.getByRole('button', { name: 'Campo', exact: true }).click();
    await expect(hand.getByRole('button', { name: 'Island', exact: true })).toHaveCount(3);
    await inspector.getByRole('button', { name: 'Fechar', exact: true }).click();

    await openMatchRail(page);
    const nav = page.getByRole('navigation', { name: 'Foco da mesa' });
    await nav.getByRole('button', { name: 'Abrir jogador Segundo amigo' }).click();
    const opponentMenu = page.getByRole('dialog', { name: 'Jogador Segundo amigo' });
    await expect(opponentMenu.getByText('Somente leitura', { exact: false })).toBeVisible();
    await expect(opponentMenu.getByRole('button', { name: 'Vida', exact: true })).toHaveCount(0);
    await opponentMenu.getByRole('button', { name: 'Fechar jogador' }).click();
    await nav.getByRole('button', { name: 'Ver campo de Segundo amigo' }).click();
    await expect(page.getByRole('article', { name: 'Mesa de Segundo amigo', exact: true })).toBeVisible();
    await expect(hand.getByRole('button', { name: 'Island', exact: true })).toHaveCount(3);
    if (info.project.name !== 'desktop') await page.getByRole('button', { name: 'Voltar para minha mesa', exact: true }).click();
    await expect(own).toBeVisible();
    await expect(page.getByRole('button', { name: 'Voltar para minha mesa', exact: true })).toHaveCount(0);
    await openMatchRail(page);
    await nav.getByRole('button', { name: 'Ver campo de Amigo da mesa', exact: true }).click();
    if (info.project.name === 'desktop') await expect(page.getByRole('region', { name: 'Oponentes', exact: true }).getByRole('article')).toHaveCount(5);
    else await expect(page.locator('.overview-player')).toHaveCount(6);
    await openMatchRail(page);
    await nav.getByRole('button', { name: 'Ver campo de Segundo amigo', exact: true }).click();
    if (info.project.name === 'desktop') {
      await hand.getByRole('button', { name: 'Island', exact: true }).first().hover();
      await expect(page.locator('.hover-card-preview img')).toBeVisible();
      for (const label of ['Prévia', 'Jogadores', 'Registro']) {
        const tab = page.getByRole('button', { name: label, exact: true });
        if (await tab.getAttribute('aria-expanded') === 'false') await tab.click();
      }
      const dimensions = await page.locator('.side-rail').evaluate(rail => {
        const players = rail.querySelector<HTMLElement>('.player-thumbnails')!;
        const preview = rail.querySelector<HTMLElement>('.hover-card-preview')!;
        const log = rail.querySelector<HTMLElement>('.match-log ol')!;
        return { railHeight: rail.clientHeight, railContent: rail.scrollHeight, playersHeight: players.clientHeight, playersContent: players.scrollHeight, previewHeight: preview.clientHeight, previewContent: preview.scrollHeight, logHeight: log.clientHeight, logContent: log.scrollHeight };
      });
      expect(dimensions.playersContent).toBeLessThanOrEqual(dimensions.playersHeight + 1);
      expect(dimensions.previewContent).toBeLessThanOrEqual(dimensions.previewHeight + 1);
      expect(dimensions.logHeight).toBeGreaterThanOrEqual(220);
      expect(dimensions.logContent).toBeGreaterThanOrEqual(dimensions.logHeight);
      expect(dimensions.railContent).toBeGreaterThanOrEqual(dimensions.railHeight);
      await page.screenshot({ animations: 'disabled', path: info.outputPath('paineis-scroll-externo.png'), fullPage: true });
    }
    if (info.project.name !== 'desktop') await page.getByRole('button', { name: 'Voltar à visão geral', exact: true }).click();
    if (info.project.name === 'desktop') await expect(page.getByRole('region', { name: 'Oponentes', exact: true }).getByRole('article')).toHaveCount(5);
    else await expect(page.locator('.overview-player')).toHaveCount(6);
    await page.screenshot({ animations: 'disabled', path: info.outputPath('06-visao-geral.png'), fullPage: true });
    if (info.project.name === 'desktop') await page.getByRole('article', { name: 'Mesa de Amigo 6', exact: true }).scrollIntoViewIfNeeded();
    else await page.getByRole('button', { name: 'Ampliar mesa de Amigo 6', exact: true }).click();
    await openHand(page);
    await expect(page.getByRole('article', { name: 'Mesa de Amigo 6', exact: true })).toBeVisible();
    await action({ kind: 'coin' });
    await expect(hand.getByRole('button', { name: 'Island', exact: true })).toHaveCount(3);
    await page.reload();
    await expect(page.locator('.own-dock')).toBeAttached();
    await openHand(page);
    await expect(page.getByLabel('Vida: 39')).toBeVisible();
    await expect(hand.getByRole('button', { name: 'Island', exact: true })).toHaveCount(3);
    expect(errors).toEqual([]);
  } finally { await Promise.all(contexts.map(context => context.close())); }
});

test('preserva leitura do registro, navega na mão e mantém menus acessíveis ao girar', async ({ page, browser, baseURL }, info) => {
  test.setTimeout(60_000);
  const other = await browser.newContext({ baseURL });
  try {
    const { roomId, action } = await seed([page.request, other.request]);
    await action({ kind: 'draw', count: 10 });
    for (let index = 0; index < 16; index += 1) await action({ kind: 'coin' });
    await page.route('**/api/cards/image?*', route => route.fulfill({ contentType: 'image/svg+xml', body: fallbackArt }));
    await page.goto(`/#/salas/${roomId}`);
    await expect(page.locator('.own-dock')).toBeAttached();
    await openHand(page);
    const hand = page.getByRole('region', { name: 'Mão', exact: true });
    const cardRow = hand.locator('.zone-cards');
    await expect(hand.getByRole('button', { name: 'Island', exact: true })).toHaveCount(14);
    if (info.project.name === 'desktop') {
      // The desktop fan tightens its overlap so every card stays within the row.
      const row = (await cardRow.boundingBox())!;
      for (const card of await hand.locator('[data-card-id]').all()) {
        const box = (await card.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(row.x - 24);
        expect(box.x + box.width).toBeLessThanOrEqual(row.x + row.width + 24);
      }
    } else {
      await cardRow.hover();
      await page.mouse.wheel(600, 0);
      await expect.poll(() => cardRow.evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
      await page.mouse.wheel(-600, 0);
      await expect.poll(() => cardRow.evaluate(node => node.scrollLeft)).toBeLessThan(2);
    }

    await openMatchRail(page, 'Registro');
    const log = page.getByRole('region', { name: 'Registro da partida', exact: true });
    const list = log.locator('.log-turns');
    await expect.poll(() => list.evaluate(node => node.scrollHeight - node.clientHeight)).toBeGreaterThan(40);
    await list.evaluate(node => { node.scrollTop = node.scrollHeight; });
    await expect.poll(() => list.evaluate(node => node.scrollTop)).toBeGreaterThan(40);
    await action({ kind: 'coin' }, other.request);
    await expect(log.getByRole('button', { name: 'Novas ações', exact: true })).toBeVisible();
    expect(await list.evaluate(node => node.scrollTop)).toBeGreaterThan(40);
    await log.getByRole('button', { name: 'Novas ações', exact: true }).click();
    await expect.poll(() => list.evaluate(node => node.scrollTop)).toBeLessThan(32);

    await openMatchRail(page);
    // Right-edge origin exercises clamping; repeated polls must preserve keyboard focus.
    const trigger = page.getByRole('navigation', { name: 'Foco da mesa' }).getByRole('button', { name: 'Abrir jogador Amigo da mesa' });
    await trigger.click();
    const player = page.getByRole('dialog', { name: 'Jogador Amigo da mesa' });
    await withinViewport(player);
    await page.keyboard.press('Shift+Tab');
    expect(await player.evaluate(node => node.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(player).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await closeMatchRail(page);

    if (info.project.name !== 'desktop') {
      await page.setViewportSize(info.project.name === 'celular' ? { width: 844, height: 390 } : { width: 390, height: 844 });
      await expect(hand).toBeVisible();
      await expect(hand.getByRole('button', { name: 'Island', exact: true })).toHaveCount(14);
    }
    await openQuickActions(page);
    const actionsTrigger = page.getByRole('button', { name: 'Ações', exact: true });
    await actionsTrigger.click();
    const actions = page.getByRole('dialog', { name: 'Ações do jogo', exact: true });
    await withinViewport(actions);
    const toolbar = (await page.locator('.table-toolbar').boundingBox())!;
    await page.mouse.click(toolbar.x + 3, toolbar.y + 3);
    await expect(actions).toHaveCount(0);
    await openQuickActions(page);
    await expect(actionsTrigger).toHaveAttribute('aria-expanded', 'false');
    await closeQuickActions(page);
  } finally { await other.close(); }
});

test('mesa e painéis cabem de 320 px ao tablet e desktop sem rolagem da página', async ({ page, browser, baseURL }, info) => {
  test.skip(info.project.name !== 'desktop', 'Matriz adicional de larguras; os outros fluxos usam dispositivos com toque.');
  test.setTimeout(120_000);
  const other = await browser.newContext({ baseURL });
  try {
    const { roomId } = await seed([page.request, other.request]);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/api/cards/image?*', route => route.fulfill({ contentType: 'image/svg+xml', body: fallbackArt }));
    await page.goto(`/#/salas/${roomId}`);
    await expect(page.locator('.own-dock')).toBeAttached();
    await openHand(page);
    for (const viewport of [
      { width: 320, height: 568 },
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1024, height: 768 },
      { width: 1280, height: 800 },
      { width: 1920, height: 1080 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(viewport);
      await openHand(page);
      await openQuickActions(page);
      const quick = page.getByRole('navigation', { name: 'Ações rápidas' });
      await expect(quick.getByRole('button', { name: 'Comprar', exact: true })).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
      await quick.getByRole('button', { name: 'Ações', exact: true }).click();
      const panel = page.getByRole('dialog', { name: 'Ações do jogo', exact: true });
      await withinViewport(panel);
      await expect(panel).toHaveCSS('animation-name', 'none');
      await panel.getByRole('button', { name: 'Fechar ações', exact: true }).click();
      await openHand(page);
      // The fan overlaps cards; the last one is the card shown whole.
      await inspectCard(page, page.getByRole('region', { name: 'Mão', exact: true }).getByRole('button', { name: 'Island', exact: true }).last());
      const inspector = page.getByRole('dialog', { name: 'Imagem de Island' });
      await withinViewport(inspector);
      await inspector.getByRole('button', { name: 'Fechar', exact: true }).click();
      await page.getByRole('toolbar', { name: 'Ações da seleção', exact: true }).getByRole('button', { name: 'Limpar seleção', exact: true }).click();
    }
  } finally { await other.close(); }
});

test('visão geral mantém cartas visíveis com posições esparsas, pilhas e cartas viradas', async ({ page, browser, baseURL }, info) => {
  test.setTimeout(90_000);
  const contexts = await Promise.all(Array.from({ length: 2 }, () => browser.newContext({ baseURL })));
  try {
    const { roomId, action } = await seed([page.request, ...contexts.map(context => context.request)]);
    const read = async (): Promise<Match> => (await (await page.request.get(`/api/rooms/${roomId}/match`)).json()).match;
    const initial = await read();
    const cards = initial.players.find(player => player.userId === initial.viewerId)!.battlefield!;
    for (const [index, card] of cards.entries()) {
      await action({ kind: 'position', cardId: card.id, x: [120, 120, 720, 240][index], row: index === 3 ? 2 : 0 });
    }
    const before = await read();
    await page.route('**/api/cards/image?*', route => route.fulfill({ contentType: 'image/svg+xml', body: fallbackArt }));
    await page.goto(`/#/salas/${roomId}`);
    await expect(page.locator('.own-dock')).toBeAttached();
    await openHand(page);
    if (info.project.name !== 'desktop') await page.getByRole('button', { name: 'Voltar à visão geral', exact: true }).click();
    if (info.project.name === 'desktop') {
      const observer = await contexts[0].newPage();
      await observer.route('**/api/cards/image?*', route => route.fulfill({ contentType: 'image/svg+xml', body: fallbackArt }));
      await observer.goto(`/#/salas/${roomId}`);
      const projection = observer.getByRole('region', { name: 'Oponentes', exact: true }).getByRole('article', { name: 'Mesa de Amigo da mesa', exact: true });
      await expect(projection.locator('.positioned-card')).toHaveCount(4);
      await expect(projection.locator('.playing-card[data-tapped="true"]')).toHaveCount(1);
      for (const card of await projection.locator('.playing-card').all()) {
        await card.scrollIntoViewIfNeeded();
        await expect(card).toBeInViewport();
      }
      const field = page.getByRole('article', { name: 'Mesa de Amigo da mesa', exact: true });
      await expect(field.locator('[data-pos-x="120"][data-row="0"]')).toHaveCount(2);
      await expect(field.locator('[data-pos-x="720"][data-row="0"]')).toHaveCount(1);
      const after = await read();
      expect(after.players.find(player => player.userId === after.viewerId)!.battlefield).toEqual(before.players.find(player => player.userId === before.viewerId)!.battlefield);
      expect(after.log).toEqual(before.log);
      return;
    }
    const miniature = page.getByRole('button', { name: 'Ampliar mesa de Amigo da mesa', exact: true });
    await expect(miniature.locator('.overview-card')).toHaveCount(4);
    await expect(miniature.locator('.overview-card.is-tapped')).toHaveCount(1);
    await expect.poll(() => miniature.locator('.overview-card').evaluateAll(nodes => nodes.every(node => {
      const box = node.getBoundingClientRect();
      const field = node.closest('.overview-field')!.getBoundingClientRect();
      return box.width > 8 && box.height > 8 && box.left >= field.left && box.top >= field.top && box.right <= field.right + 1 && box.bottom <= field.bottom + 1;
    }))).toBe(true);
    await page.screenshot({ path: info.outputPath('visao-geral-posicoes-esparsas.png'), fullPage: true });
    await miniature.click();
    const field = page.getByRole('article', { name: 'Mesa de Amigo da mesa', exact: true });
    await expect(field.locator('[data-pos-x="120"][data-row="0"]')).toHaveCount(2);
    await expect(field.locator('[data-pos-x="720"][data-row="0"]')).toHaveCount(1);
    await page.getByRole('button', { name: 'Voltar à visão geral', exact: true }).click();
    await expect(miniature.locator('.overview-card')).toHaveCount(4);
    const after = await read();
    expect(after.players.find(player => player.userId === after.viewerId)!.battlefield).toEqual(before.players.find(player => player.userId === before.viewerId)!.battlefield);
    expect(after.log).toEqual(before.log);
  } finally { await Promise.all(contexts.map(context => context.close())); }
});

test('zoom real preserva a partida, seleção e painéis em resoluções desktop', async ({ page, browser, baseURL }, info) => {
  test.skip(info.project.name !== 'desktop', 'Matriz de zoom do computador.');
  test.setTimeout(120_000);
  const other = await browser.newContext({ baseURL });
  const session = await page.context().newCDPSession(page);
  try {
    const { roomId, action } = await seed([page.request, other.request]);
    const path = `/api/rooms/${roomId}/match`;
    await page.route('**/api/cards/image?*', route => route.fulfill({ contentType: 'image/svg+xml', body: fallbackArt }));
    await page.goto(`/#/salas/${roomId}`);
    const own = page.getByRole('article', { name: 'Mesa de Amigo da mesa', exact: true });
    const card = own.getByRole('region', { name: 'Campo', exact: true }).getByRole('button', { name: 'Island', exact: true }).first();
    await card.click();
    await expect(card).toHaveAttribute('aria-pressed', 'true');
    const selectedCardId = await card.getAttribute('data-card-id');
    expect(selectedCardId).not.toBeNull();
    const before = (await (await page.request.get(path)).json()).match;
    const usefulSpace: Array<{ viewport: string; zoom: number; cssWidth: number; cssHeight: number; visibleWidth: number; visibleHeight: number }> = [];

    for (const viewport of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }]) {
      await page.setViewportSize(viewport);
      for (const zoom of [1, 1.25, 1.5, 2]) {
        await session.send('Emulation.setPageScaleFactor', { pageScaleFactor: zoom });
        const space = await own.locator('.battlefield-fit').evaluate(field => ({
          cssWidth: field.clientWidth,
          cssHeight: field.clientHeight,
          visibleWidth: window.visualViewport?.width ?? window.innerWidth,
          visibleHeight: window.visualViewport?.height ?? window.innerHeight,
          zoom: window.visualViewport?.scale ?? 1,
        }));
        expect(space.zoom).toBeCloseTo(zoom, 2);
        expect(space.cssWidth).toBeGreaterThan(0);
        expect(space.cssHeight).toBeGreaterThan(0);
        usefulSpace.push({ viewport: `${viewport.width}×${viewport.height}`, ...space });
        await expect(card).toHaveAttribute('aria-pressed', 'true');

        await action({ kind: 'set_tapped', cardIds: [selectedCardId], tapped: zoom !== 1 });
        await expect(card).toHaveAttribute('data-tapped', String(zoom !== 1));
      }
    }

    await session.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });
    await openMatchRail(page);
    const trigger = page.getByRole('navigation', { name: 'Foco da mesa' }).getByRole('button', { name: 'Abrir jogador Amigo da mesa', exact: true });
    await trigger.click();
    await expect(page.getByRole('dialog', { name: 'Jogador Amigo da mesa', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Fechar jogador', exact: true }).click();
    await expect(card).toHaveAttribute('aria-pressed', 'true');
    const after = (await (await other.request.get(path)).json()).match;
    expect(after.players.find((player: { userId: number }) => player.userId === before.viewerId)!.battlefield)
      .toEqual(before.players.find((player: { userId: number }) => player.userId === before.viewerId)!.battlefield.map((entry: { id: string; tapped?: boolean }) => entry.id === selectedCardId ? { ...entry, tapped: true } : entry));
    await info.attach('espaco-util-zoom.json', { body: JSON.stringify(usefulSpace, null, 2), contentType: 'application/json' });
  } finally {
    await session.detach();
    await other.close();
  }
});
