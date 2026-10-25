import { randomUUID } from 'node:crypto';
import type { BrowserContext } from '@playwright/test';
import { test, expect, returnOpeningHandToLibrary, roomBody } from './fixtures';

test('mesa de quatro mostra oponentes acima do campo próprio e da mão', async ({ browser, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Composição de computador');
  test.setTimeout(90_000);
  const contexts: BrowserContext[] = [];
  try {
    let roomId = 0;
    for (const login of ['amigo', 'segundo', 'amigo3', 'amigo4']) {
      const context = await browser.newContext({ baseURL });
      contexts.push(context);
      const api = context.request;
      expect((await api.post('/api/session', { data: { login, password: 'senha-do-navegador' } })).ok()).toBe(true);
      const { deck } = await (await api.post('/api/decks', { multipart: { file: { name: 'mesa.cod', mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck><zone name="main"><card number="8" name="Island"/></zone></cockatrice_deck>') } } })).json();
      if (!roomId) roomId = (await (await api.post('/api/rooms', { data: roomBody() })).json()).room.id;
      else expect((await api.post(`/api/rooms/${roomId}/participants`, { data: {} })).ok()).toBe(true);
      expect((await api.put(`/api/rooms/${roomId}/participants/me/ready`, { data: { deckId: deck.id } })).ok()).toBe(true);
    }
    const path = `/api/rooms/${roomId}`;
    expect((await contexts[0].request.post(`${path}/start`, { data: {} })).status()).toBe(201);
    for (const context of contexts) await returnOpeningHandToLibrary(context.request, roomId);
    for (const [index, context] of contexts.entries()) {
      const created = await context.request.post(`${path}/match/actions`, { data: { kind: 'create-token', intentId: randomUUID(), tokenName: 'Soldier Token' } });
      expect(created.ok()).toBe(true);
      if (index) {
        const { match } = await created.json();
        const own = match.players.find((player: { userId: number }) => player.userId === match.viewerId);
        expect((await context.request.post(`${path}/match/actions`, { data: { kind: 'position', intentId: randomUUID(), cardId: own.battlefield[0].id, x: 400, row: 4 } })).ok()).toBe(true);
      }
    }
    expect((await contexts[0].request.post(`${path}/match/actions`, { data: { kind: 'draw', intentId: randomUUID(), count: 1 } })).ok()).toBe(true);
    const page = await contexts[0].newPage();
    await page.goto(`/#/salas/${roomId}`);
    const opponents = page.getByRole('region', { name: 'Oponentes', exact: true });
    await expect(opponents).toBeVisible();
    await expect(opponents.getByRole('article')).toHaveCount(3);
    for (const name of ['Segundo amigo', 'Amigo 3', 'Amigo 4']) {
      const seat = opponents.getByRole('article', { name: `Mesa de ${name}`, exact: true });
      await expect(seat.getByRole('button', { name: 'Soldier Token', exact: true })).toBeInViewport();
      await expect(seat.getByLabel('Vida: 40')).toBeVisible();
      await expect(seat.getByRole('textbox', { name: 'Vida', exact: true })).toHaveCount(0);
    }
    const own = page.getByRole('article', { name: 'Mesa de Amigo da mesa', exact: true });
    const hand = page.getByRole('region', { name: 'Mão', exact: true });
    await expect(own.getByRole('button', { name: 'Soldier Token', exact: true }).getByLabel('Poder e resistência')).toHaveText('1/1');
    await own.getByRole('button', { name: 'Soldier Token', exact: true }).hover();
    await expect(page.getByRole('region', { name: 'Prévia da carta', exact: true }).getByRole('heading', { name: 'Soldier Token', exact: true })).toBeVisible();
    const seatColors = await page.locator('.seat-number').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).backgroundColor));
    expect(new Set(seatColors).size).toBe(4);
    const activeSeat = page.getByRole('article').filter({ has: page.getByText('Na vez', { exact: true }) });
    expect(await activeSeat.evaluate(node => getComputedStyle(node).borderTopColor)).toBe(await activeSeat.locator('.seat-number').evaluate(node => getComputedStyle(node).backgroundColor));
    const observed = (await (await contexts[0].request.get(`${path}/match`)).json()).match;
    for (const player of observed.players.filter((player: { userId: number }) => player.userId !== observed.viewerId)) {
      expect(player.battlefield[0].positionX).toBe(400);
      expect(player.battlefield[0].row).toBe(4);
    }
    await expect(hand.getByRole('button', { name: 'Island', exact: true })).toBeVisible();
    const top = await opponents.boundingBox(), field = await own.boundingBox(), bottom = await hand.boundingBox();
    expect(top!.y + top!.height).toBeLessThanOrEqual(field!.y + 2);
    expect(field!.y + field!.height).toBeLessThanOrEqual(bottom!.y + 2);
    await expect(page.getByRole('button', { name: /Ampliar mesa|Voltar à visão geral/ })).toHaveCount(0);
    const ownLife = own.getByRole('textbox', { name: 'Vida', exact: true });
    await ownLife.fill('37');
    await ownLife.press('Enter');
    await expect(own.getByLabel('Vida: 37', { exact: true })).toBeVisible();
    await page.reload();
    await expect(ownLife).toHaveValue('37');
    const card = own.getByRole('button', { name: 'Soldier Token', exact: true });
    const comfortable = (await card.boundingBox())!.width;
    await page.getByRole('combobox', { name: 'Densidade', exact: true }).selectOption('compact');
    await expect.poll(async () => (await card.boundingBox())!.width).toBeLessThan(comfortable);
    await expect(page.getByRole('group', { name: 'Zoom do campo' })).toHaveCount(0);
    await expect(own.getByLabel('marcador vermelho', { exact: true })).toHaveText('0');
    await page.screenshot({ path: testInfo.outputPath('mesa-quatro.png') });
  } finally { await Promise.all(contexts.map(context => context.close())); }
});


test('a mesma composição atende um a seis e mantém os montes públicos', async ({ browser, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Composição de computador');
  test.setTimeout(120_000);
  for (const count of [1, 2, 3, 5, 6]) {
    const contexts: BrowserContext[] = [];
    try {
      let roomId = 0;
      for (const login of ['amigo', 'segundo', 'amigo3', 'amigo4', 'amigo5', 'amigo6'].slice(0, count)) {
        const context = await browser.newContext({ baseURL });
        contexts.push(context);
        const api = context.request;
        expect((await api.post('/api/session', { data: { login, password: 'senha-do-navegador' } })).ok()).toBe(true);
        const { deck } = await (await api.post('/api/decks', { multipart: { file: { name: 'assentos.cod', mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck><zone name="main"><card number="8" name="Island"/></zone></cockatrice_deck>') } } })).json();
        if (!roomId) roomId = (await (await api.post('/api/rooms', { data: roomBody() })).json()).room.id;
        else expect((await api.post(`/api/rooms/${roomId}/participants`, { data: {} })).ok()).toBe(true);
        expect((await api.put(`/api/rooms/${roomId}/participants/me/ready`, { data: { deckId: deck.id } })).ok()).toBe(true);
      }
      const api = contexts[0].request;
      const path = `/api/rooms/${roomId}`;
      expect((await api.post(`${path}/start`, { data: {} })).status()).toBe(201);
      await returnOpeningHandToLibrary(api, roomId);
      const draw = await api.post(`${path}/match/actions`, { data: { kind: 'draw', intentId: randomUUID(), count: 4 } });
      const { match } = await draw.json();
      const hand = match.players.find((player: { userId: number }) => player.userId === match.viewerId).hand;
      for (const [index, to] of ['graveyard', 'exile', 'command'].entries()) expect((await api.post(`${path}/match/actions`, { data: { kind: 'move', intentId: randomUUID(), cardIds: [hand[index].id], to } })).ok()).toBe(true);
      const page = await contexts[0].newPage();
      await page.goto(`/#/salas/${roomId}`);
      const own = page.getByRole('article', { name: 'Mesa de Amigo da mesa', exact: true });
      await expect(own).toBeVisible();
      await expect(page.getByRole('region', { name: 'Mão', exact: true }).getByRole('button', { name: 'Island', exact: true })).toBeVisible();
      for (const name of ['Cemitério', 'Exílio', 'Comando']) {
        const zone = own.getByRole('region', { name, exact: true });
        await expect(zone.getByRole('button', { name: 'Island', exact: true })).toBeVisible();
        await expect(zone.getByLabel('1 cartas', { exact: true })).toBeVisible();
      }
      const library = own.getByRole('region', { name: 'Grimório', exact: true });
      await expect(library.getByLabel('4 cartas', { exact: true })).toBeVisible();
      await expect(library).not.toContainText('Island');
      await expect(library.locator('img')).toHaveCount(3);
      const strip = page.getByRole('region', { name: 'Oponentes', exact: true });
      if (count === 1) await expect(strip).toHaveCount(0);
      else {
        await expect(strip.getByRole('article')).toHaveCount(count - 1);
        const boxes = await strip.getByRole('article').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().top));
        expect(Math.max(...boxes) - Math.min(...boxes)).toBeLessThan(2);
        if (count >= 5) {
          expect(await strip.evaluate(node => node.scrollWidth > node.clientWidth)).toBe(true);
          const last = strip.getByRole('article').last();
          await last.scrollIntoViewIfNeeded();
          await expect(last).toBeInViewport();
          expect(await strip.evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
          await expect(own).toBeVisible();
        }
      }
      const turnName = (await (await api.get(`${path}/match`)).json()).match.currentTurn.name;
      await expect(page.getByRole('article', { name: `Mesa de ${turnName}`, exact: true }).getByText('Na vez', { exact: true })).toHaveCount(1);
      await expect(page.getByText('Ordem:', { exact: false })).toBeVisible();
    } finally { await Promise.all(contexts.map(context => context.close())); }
  }
});
