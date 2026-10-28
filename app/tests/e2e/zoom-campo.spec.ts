import { randomUUID } from 'node:crypto';
import { test, expect, returnOpeningHandToLibrary, roomBody } from './fixtures';

test('grade manual e zoom são independentes para cada campo', async ({ page, browser, baseURL }, info) => {
  test.setTimeout(90_000);
  const other = await browser.newContext({ baseURL });
  try {
    let roomId = 0;
    for (const [api, login] of [[page.request, 'amigo'], [other.request, 'segundo']] as const) {
      expect((await api.post('/api/session', { data: { login, password: 'senha-do-navegador' } })).ok()).toBe(true);
      const { deck } = await (await api.post('/api/decks', { multipart: { file: { name: 'zoom.cod', mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck><zone name="main"><card number="20" name="Island"/></zone></cockatrice_deck>') } } })).json();
      if (!roomId) roomId = (await (await api.post('/api/rooms', { data: roomBody() })).json()).room.id;
      else expect((await api.post(`/api/rooms/${roomId}/participants`, { data: {} })).ok()).toBe(true);
      expect((await api.put(`/api/rooms/${roomId}/participants/me/ready`, { data: { deckId: deck.id } })).ok()).toBe(true);
    }
    expect((await page.request.post(`/api/rooms/${roomId}/start`, { data: {} })).status()).toBe(201);
    await Promise.all([page.request, other.request].map(api => returnOpeningHandToLibrary(api, roomId)));
    for (const api of [page.request, other.request]) {
      for (const [x, row] of [[0, 0], [2, 2]]) {
        const result = await api.post(`/api/rooms/${roomId}/match/actions`, { data: { kind: 'create-token', intentId: randomUUID(), tokenName: 'Soldier Token' } });
        const { match } = await result.json();
        const card = match.players.find((player: { userId: number }) => player.userId === match.viewerId).battlefield.at(-1);
        expect((await api.post(`/api/rooms/${roomId}/match/actions`, { data: { kind: 'position', intentId: randomUUID(), cardId: card.id, x, row } })).ok()).toBe(true);
      }
    }
    await page.goto(`/#/salas/${roomId}`);
    const own = page.getByRole('article', { name: 'Mesa de Amigo da mesa', exact: true });
    const field = own.getByRole('region', { name: 'Campo', exact: true });
    const canvas = field.locator('[data-battlefield-canvas]');
    await expect(field.locator('[data-pos-x="2"][data-row="2"]')).toHaveCount(1);
    const start = await field.locator('[data-pos-x="0"][data-row="0"]').boundingBox();
    const far = await field.locator('[data-pos-x="2"][data-row="2"]').boundingBox();
    expect(far!.x - start!.x).toBeGreaterThan(start!.width * 2);
    expect(far!.y - start!.y).toBeGreaterThan(start!.height * 2);
    if (!info.project.use.hasTouch) {
      const target = { x: start!.x + start!.width * 3.6, y: start!.y + start!.height * 1.1 };
      await page.mouse.move(start!.x + start!.width / 2, start!.y + start!.height / 2);
      await page.mouse.down();
      await page.mouse.move(target.x, target.y, { steps: 8 });
      await page.mouse.up();
      await expect(field.locator('[data-pos-x="3"][data-row="1"]')).toHaveCount(1);
      await expect.poll(async () => (await (await page.request.get(`/api/rooms/${roomId}/match`)).json()).match.players.find((player: { name: string }) => player.name === 'Amigo da mesa').battlefield.some((card: { positionX: number; row: number }) => card.positionX === 3 && card.row === 1)).toBe(true);
    }
    const before = (await (await page.request.get(`/api/rooms/${roomId}/match`)).json()).match.players;
    const box = (await field.boundingBox())!;
    if (info.project.use.hasTouch) {
      const cdp = await page.context().newCDPSession(page);
      const points = (offset: number) => [{ x: start!.x + start!.width / 2 + 25 - offset, y: start!.y + start!.height / 2 }, { x: start!.x + start!.width / 2 + 25 + offset, y: start!.y + start!.height / 2 }];
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(25) });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(45) });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await cdp.detach();
    } else {
      await page.mouse.move(box.x + 140, box.y + 100);
      await page.mouse.wheel(0, -250);
    }
    await expect.poll(async () => Number(await canvas.getAttribute('data-zoom'))).toBeGreaterThan(1.1);
    if (info.project.name === 'desktop') {
      const opponent = page.getByRole('article', { name: 'Mesa de Segundo amigo', exact: true });
      await expect(opponent.locator('[data-battlefield-canvas]')).toHaveAttribute('data-zoom', '1');
      const ownZoom = await canvas.getAttribute('data-zoom');
      const opponentBox = (await opponent.getByRole('region', { name: 'Campo', exact: true }).boundingBox())!;
      await page.mouse.move(opponentBox.x + 140, opponentBox.y + 100);
      await page.mouse.wheel(0, -200);
      await expect.poll(async () => Number(await opponent.locator('[data-battlefield-canvas]').getAttribute('data-zoom'))).toBeGreaterThan(1.1);
      await expect(canvas).toHaveAttribute('data-zoom', ownZoom!);
    } else {
      const ownZoom = await canvas.getAttribute('data-zoom');
      await page.getByRole('button', { name: 'Abrir visão geral', exact: true }).tap();
      await page.getByRole('button', { name: 'Ampliar mesa de Segundo amigo', exact: true }).tap();
      const opponent = page.getByRole('article', { name: 'Mesa de Segundo amigo', exact: true });
      const opponentCanvas = opponent.locator('[data-battlefield-canvas]');
      await expect(opponentCanvas).toHaveAttribute('data-zoom', '1');
      const opponentBox = (await opponent.getByRole('region', { name: 'Campo', exact: true }).boundingBox())!;
      const cdp = await page.context().newCDPSession(page);
      const points = (offset: number) => [{ x: opponentBox.x + 140 - offset, y: opponentBox.y + 100 }, { x: opponentBox.x + 140 + offset, y: opponentBox.y + 100 }];
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(25) });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(45) });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await cdp.detach();
      await expect.poll(async () => Number(await opponentCanvas.getAttribute('data-zoom'))).toBeGreaterThan(1.1);
      await page.getByRole('button', { name: 'Voltar para meu campo', exact: true }).tap();
      await expect(canvas).toHaveAttribute('data-zoom', ownZoom!);
    }
    await field.getByRole('button', { name: 'Centralizar campo de Amigo da mesa', exact: true }).click();
    await expect.poll(async () => {
      const fieldBox = (await field.locator('.battlefield-scroll').boundingBox())!;
      const boxes = await Promise.all((await field.getByRole('button', { name: 'Soldier Token', exact: true }).all()).map(card => card.boundingBox()));
      return boxes.every(card => card && card.x >= fieldBox.x - 1 && card.y >= fieldBox.y - 1 && card.x + card.width <= fieldBox.x + fieldBox.width + 1 && card.y + card.height <= fieldBox.y + fieldBox.height + 1);
    }).toBe(true);
    expect((await (await page.request.get(`/api/rooms/${roomId}/match`)).json()).match.players).toEqual(before);
    if (!info.project.use.hasTouch) {
      const moving = field.locator('[data-pos-x="3"][data-row="1"] .playing-card');
      const destination = field.locator('[data-pos-x="2"][data-row="2"] .playing-card');
      const movingId = await moving.getAttribute('data-card-id');
      const from = (await moving.boundingBox())!;
      const to = (await destination.boundingBox())!;
      await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
      await page.mouse.down();
      await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
      await page.mouse.up();
      await expect(field.locator('[data-pos-x="2"][data-row="2"][data-stack-size="2"]')).toHaveCount(2);
      expect((await page.request.post(`/api/rooms/${roomId}/match/actions`, { data: { kind: 'set_tapped', intentId: randomUUID(), cardIds: [movingId], tapped: true } })).ok()).toBe(true);
      await expect(field.locator(`[data-card-id="${movingId}"]`)).toHaveAttribute('data-tapped', 'true');
    }
    if (info.project.use.hasTouch) {
      const card = (await field.locator('[data-pos-x="0"][data-row="0"]').boundingBox())!;
      const cdp = await page.context().newCDPSession(page);
      const from = { x: card.x + card.width / 2, y: card.y + card.height / 2 };
      const target = { x: card.x + card.width * 1.5, y: card.y + card.height * 1.3 };
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [target] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await cdp.detach();
      await expect(field.locator('[data-pos-x="1"][data-row="1"]')).toHaveCount(1);
      await expect.poll(async () => (await (await page.request.get(`/api/rooms/${roomId}/match`)).json()).match.players.find((player: { name: string }) => player.name === 'Amigo da mesa').battlefield.some((item: { positionX: number; row: number }) => item.positionX === 1 && item.row === 1)).toBe(true);
    }
    await page.reload();
    await expect(page.locator('[data-pos-x="2"][data-row="2"]').first()).toBeAttached();
    await page.screenshot({ path: info.outputPath('campo-enquadrado.png') });
  } finally { await other.close(); }
});
