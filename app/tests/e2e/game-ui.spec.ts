import { readFileSync } from 'node:fs';
import type { APIRequestContext, Locator } from '@playwright/test';
import type { Match } from '../../src/features/rooms/roomsApi';
import { test, expect, openMatchRail, closeMatchRail, openHand, openQuickActions, closeQuickActions, returnOpeningHandToLibrary } from './fixtures';

const fallbackArt = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 63 88"><rect width="63" height="88" rx="3" fill="#adb9a1"/><rect x="3" y="3" width="57" height="7" rx="2" fill="#dedbc1"/><text x="5" y="8" font-size="4" font-family="serif">Island</text><rect x="4" y="13" width="55" height="40" fill="#406571"/><path d="M4 45 20 23 35 44 46 28 59 45v8H4Z" fill="#9ca98f"/><rect x="4" y="56" width="55" height="28" fill="#d7d9be"/><text x="6" y="65" font-size="4">Basic Land — Island</text></svg>';

async function seed(requests: APIRequestContext[]) {
  let roomId = 0;
  const logins = ['amigo', 'segundo', 'amigo3', 'amigo4', 'amigo5', 'amigo6'];
  for (const [index, api] of requests.entries()) {
    expect((await api.post('/api/session', { data: { login: logins[index], password: 'senha-do-navegador' } })).ok()).toBe(true);
    const uploaded = await api.post('/api/decks', { multipart: { file: { name: 'mesa-visual.cod', mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck><zone name="main"><card number="25" name="Island"/></zone></cockatrice_deck>') } } });
    const { deck } = await uploaded.json();
    if (!roomId) roomId = (await (await api.post('/api/rooms', { data: {} })).json()).room.id;
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
    await openQuickActions(page);
    const quick = page.getByRole('navigation', { name: 'Ações rápidas' });
    const hand = page.getByRole('region', { name: 'Mão', exact: true });
    await expect(hand.getByRole('button', { name: 'Island', exact: true })).toHaveCount(4);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await quick.getByRole('button', { name: 'Comprar', exact: true }).evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(info.project.use.hasTouch ? 44 : 36);
    const handBox = (await hand.boundingBox())!;
    const quickBox = (await quick.boundingBox())!;
    if (info.project.name === 'desktop') expect(quickBox.x).toBeGreaterThanOrEqual(handBox.x + handBox.width);
    else expect(quickBox.y + quickBox.height).toBeLessThanOrEqual(handBox.y);
    await closeQuickActions(page);
    await page.screenshot({ animations: 'disabled', path: info.outputPath('01-mesa.png'), fullPage: true });

    const trigger = own.getByRole('button', { name: 'Abrir ações do grimório' });
    await trigger.click();
    const library = page.getByRole('dialog', { name: 'Grimório', exact: true });
    await withinViewport(library);
    const menuBox = (await library.boundingBox())!;
    expect(menuBox.width).toBeLessThanOrEqual(info.project.name === 'celular' ? 400 : 320);
    if (info.project.name !== 'celular-horizontal') expect(menuBox.height).toBeGreaterThan(menuBox.width);
    const rows = await library.locator('.table-menu-item').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().x));
    expect(new Set(rows).size).toBe(1);
    if (info.project.name === 'desktop') {
      const origin = (await trigger.boundingBox())!;
      expect(Math.abs(menuBox.x - origin.x - origin.width)).toBeLessThan(24);
    }
    await page.screenshot({ animations: 'disabled', path: info.outputPath('02-grimorio.png'), fullPage: true });
    await library.getByRole('button', { name: 'Olhar cartas', exact: true }).click();
    await library.getByLabel('Quantidade de cartas').fill('2');
    await library.getByRole('button', { name: 'Olhar 2 carta(s)', exact: true }).click();
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
    await actions.getByRole('button', { name: 'Rolar dado', exact: true }).click();
    await actions.getByRole('button', { name: 'Fechar ações' }).click();
    await expect(info.project.name === 'desktop' ? quick.getByRole('button', { name: 'Ações', exact: true }) : page.getByRole('button', { name: 'Comandos', exact: true })).toBeFocused();

    await own.getByRole('button', { name: 'Abrir jogador Amigo da mesa' }).click();
    const playerMenu = page.getByRole('dialog', { name: 'Jogador Amigo da mesa' });
    if (info.project.name === 'desktop') {
      const life = own.getByRole('button', { name: 'Abrir jogador Amigo da mesa', exact: true });
      const menuBox = (await playerMenu.boundingBox())!;
      const lifeBox = (await life.boundingBox())!;
      expect(Math.abs(menuBox.x - lifeBox.x)).toBeLessThan(48);
      expect(menuBox.y).toBeGreaterThanOrEqual(lifeBox.y);
    }
    await expect(playerMenu.getByRole('button', { name: 'Vida', exact: true })).toHaveCount(0);
    await playerMenu.getByRole('button', { name: 'Diminuir vida', exact: true }).click();
    await expect(own.getByLabel('Vida: 39')).toBeVisible();
    await playerMenu.getByRole('button', { name: 'Marcadores', exact: true }).click();
    await playerMenu.getByRole('button', { name: 'Aumentar marcador vermelho' }).click();
    await expect(own.getByLabel('marcador vermelho', { exact: true })).toHaveText('1');
    await page.screenshot({ animations: 'disabled', path: info.outputPath('04-jogador.png'), fullPage: true });
    await playerMenu.getByRole('button', { name: 'Fechar jogador' }).click();

    await hand.getByRole('button', { name: 'Island', exact: true }).first().click();
    const inspector = page.getByRole('dialog', { name: 'Imagem de Island' });
    await withinViewport(inspector);
    await page.screenshot({ animations: 'disabled', path: info.outputPath('05-carta.png'), fullPage: true });
    await inspector.getByLabel('Poder', { exact: true }).fill('2');
    await inspector.getByLabel('Poder', { exact: true }).press('Enter');
    await expect(hand.getByLabel('Poder e resistência')).toHaveCount(0);
    await inspector.getByRole('button', { name: 'Mover para…', exact: true }).click();
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
      expect(dimensions.logContent).toBeGreaterThan(dimensions.logHeight);
      expect(dimensions.railContent).toBeGreaterThan(dimensions.railHeight);
      await page.locator('.side-rail').evaluate(rail => { rail.scrollTop = rail.scrollHeight; });
      await page.screenshot({ animations: 'disabled', path: info.outputPath('paineis-scroll-externo.png'), fullPage: true });
    }
    if (info.project.name !== 'desktop') await page.getByRole('button', { name: 'Voltar à visão geral', exact: true }).click();
    if (info.project.name === 'desktop') await expect(page.getByRole('region', { name: 'Oponentes', exact: true }).getByRole('article')).toHaveCount(5);
    else await expect(page.locator('.overview-player')).toHaveCount(6);
    await page.screenshot({ animations: 'disabled', path: info.outputPath('06-visao-geral.png'), fullPage: true });
    if (info.project.name !== 'desktop') await page.getByRole('button', { name: 'Fechar mão', exact: true }).click();
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
    await page.route('**/api/cards/image?*', route => route.fulfill({ contentType: 'image/svg+xml', body: fallbackArt }));
    await page.goto(`/#/salas/${roomId}`);
    await expect(page.locator('.own-dock')).toBeAttached();
    await openHand(page);
    const hand = page.getByRole('region', { name: 'Mão', exact: true });
    const cardRow = hand.locator('.zone-cards');
    await expect(hand.getByRole('button', { name: 'Island', exact: true })).toHaveCount(14);
    await cardRow.hover();
    await page.mouse.wheel(600, 0);
    await expect.poll(() => cardRow.evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
    await page.mouse.wheel(-600, 0);
    await expect.poll(() => cardRow.evaluate(node => node.scrollLeft)).toBeLessThan(2);

    await openMatchRail(page, 'Registro');
    const log = page.getByRole('region', { name: 'Registro da partida', exact: true });
    const list = log.locator('ol');
    await expect.poll(() => list.evaluate(node => node.scrollHeight - node.clientHeight)).toBeGreaterThan(40);
    await list.evaluate(node => { node.scrollTop = 0; });
    await expect.poll(() => list.evaluate(node => node.scrollTop)).toBe(0);
    await action({ kind: 'coin' }, other.request);
    await expect(log.getByRole('button', { name: 'Novas ações', exact: true })).toBeVisible();
    expect(await list.evaluate(node => node.scrollTop)).toBe(0);
    await log.getByRole('button', { name: 'Novas ações', exact: true }).click();
    await expect.poll(() => list.evaluate(node => node.scrollHeight - node.scrollTop - node.clientHeight)).toBeLessThan(32);

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
  test.setTimeout(60_000);
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
      await page.getByRole('region', { name: 'Mão', exact: true }).getByRole('button', { name: 'Island', exact: true }).first().click();
      const inspector = page.getByRole('dialog', { name: 'Imagem de Island' });
      await withinViewport(inspector);
      await inspector.getByRole('button', { name: 'Fechar', exact: true }).click();
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
