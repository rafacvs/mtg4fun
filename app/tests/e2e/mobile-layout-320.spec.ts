import { test, expect, returnOpeningHandToLibrary, roomBody } from './fixtures';

test('mesa móvel mantém campo, mão, trilho e ações acessíveis sem rolagem da página', async ({ page, browser, baseURL }, info) => {
  test.skip(info.project.name !== 'celular', 'Matriz móvel com toque.');
  test.setTimeout(120_000);
  const other = await browser.newContext({ baseURL });
  try {
    let roomId = 0;
    for (const [api, login] of [[page.request, 'amigo'], [other.request, 'segundo']] as const) {
      expect((await api.post('/api/session', { data: { login, password: 'senha-do-navegador' } })).ok()).toBe(true);
      const { deck } = await (await api.post('/api/decks', { multipart: { file: { name: 'mobile.cod', mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck><zone name="main"><card number="20" name="Island"/></zone></cockatrice_deck>') } } })).json();
      if (!roomId) roomId = (await (await api.post('/api/rooms', { data: roomBody() })).json()).room.id;
      else expect((await api.post(`/api/rooms/${roomId}/participants`, { data: {} })).ok()).toBe(true);
      expect((await api.put(`/api/rooms/${roomId}/participants/me/ready`, { data: { deckId: deck.id } })).ok()).toBe(true);
    }
    expect((await page.request.post(`/api/rooms/${roomId}/start`, { data: {} })).status()).toBe(201);
    await returnOpeningHandToLibrary(page.request, roomId);
    expect((await page.request.post(`/api/rooms/${roomId}/match/actions`, { data: { kind: 'draw', intentId: crypto.randomUUID(), count: 15 } })).ok()).toBe(true);
    await page.goto(`/#/salas/${roomId}`);
    const hand = page.getByRole('region', { name: 'Mão', exact: true });
    const cards = hand.getByRole('button', { name: 'Island', exact: true });
    await expect(cards).toHaveCount(15);
    const field = page.locator('.focused-table');
    const bar = page.getByRole('toolbar', { name: 'Ações da seleção', exact: true });
    const viewports = [
      ['320x568', 320, 568], ['360x640', 360, 640], ['390x844', 390, 844],
      ['768x1024', 768, 1024], ['568x320', 568, 320], ['844x390', 844, 390],
    ] as const;
    for (const [name, width, height] of viewports) {
      await page.setViewportSize({ width, height });
      await expect(field).toBeVisible();
      await expect(hand).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
      const [fieldBox, handBox, controlsBox] = await Promise.all([field.boundingBox(), hand.boundingBox(), page.getByRole('navigation', { name: 'Controles da mesa' }).boundingBox()]);
      expect(fieldBox!.y + fieldBox!.height).toBeLessThanOrEqual(handBox!.y + 1);
      expect(controlsBox!.y + controlsBox!.height).toBeLessThanOrEqual(handBox!.y + 1);
      for (const button of await page.locator('.table-toolbar button:visible, .table-toolbar a:visible, .mobile-table-controls button:visible').all()) {
        const box = (await button.boundingBox())!;
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
        expect(box.y + box.height).toBeLessThanOrEqual(height + 1);
      }
      const life = field.getByRole('button', { name: 'Abrir jogador Amigo da mesa', exact: true });
      const lifeBox = (await life.boundingBox())!;
      expect(lifeBox.width).toBeGreaterThanOrEqual(44);
      expect(lifeBox.height).toBeGreaterThanOrEqual(44);
      const [railBox, battlefieldBox] = await Promise.all([field.locator('.zone-column').boundingBox(), field.locator('.battlefield-scroll').boundingBox()]);
      expect(railBox!.x + railBox!.width).toBeLessThanOrEqual(battlefieldBox!.x + 1);
      const commandBox = (await field.getByRole('region', { name: 'Comando', exact: true }).boundingBox())!;
      const libraryBox = (await field.getByRole('region', { name: 'Grimório', exact: true }).boundingBox())!;
      expect(commandBox.y + commandBox.height).toBeLessThanOrEqual(libraryBox.y + 1);
      await expect(field.getByRole('button', { name: 'Fundo do grimório', exact: true })).toHaveCount(0);
      await page.screenshot({ path: info.outputPath(`${name}-mesa.png`) });
      await page.getByRole('button', { name: 'Comandos', exact: true }).tap();
      const panel = page.getByRole('region', { name: 'Comandos da partida', exact: true });
      const panelBox = (await panel.boundingBox())!;
      for (const label of ['Passar turno', 'Comprar', 'Desvirar todas', 'Ações']) {
        const button = panel.getByRole('button', { name: label, exact: true });
        await expect(button).toBeVisible();
        const box = (await button.boundingBox())!;
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.y).toBeGreaterThanOrEqual(panelBox.y - 1);
        expect(box.y + box.height).toBeLessThanOrEqual(panelBox.y + panelBox.height + 1);
      }
      await page.screenshot({ path: info.outputPath(`${name}-comandos.png`) });
      await panel.getByRole('button', { name: 'Fechar comandos', exact: true }).tap();
      await cards.first().tap();
      await expect(bar).toBeVisible();
      const barBox = (await bar.boundingBox())!;
      const resizedField = (await field.boundingBox())!;
      expect(resizedField.y + resizedField.height).toBeLessThanOrEqual(barBox.y + 1);
      expect(barBox.y + barBox.height).toBeLessThanOrEqual(handBox!.y + 1);
      for (const button of await bar.getByRole('button').all()) {
        const box = (await button.boundingBox())!;
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.x).toBeGreaterThanOrEqual(barBox.x - 1);
        expect(box.x + box.width).toBeLessThanOrEqual(barBox.x + barBox.width + 1);
        expect(box.y + box.height).toBeLessThanOrEqual(barBox.y + barBox.height + 1);
      }
      const rail = field.locator('.zone-column');
      expect((await rail.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await page.screenshot({ path: info.outputPath(`${name}-selecionada.png`) });
      await page.getByRole('button', { name: 'Comandos', exact: true }).tap();
      const draw = panel.getByRole('button', { name: 'Comprar', exact: true });
      await expect(draw).toBeVisible();
      expect(await draw.evaluate(node => { const r = node.getBoundingClientRect(); const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return hit === node || node.contains(hit); })).toBe(true);
      await panel.getByRole('button', { name: 'Fechar comandos', exact: true }).tap();
      await bar.getByRole('button', { name: 'Limpar seleção', exact: true }).tap();
    }
    await page.setViewportSize({ width: 320, height: 568 });
    await field.getByRole('button', { name: 'Abrir jogador Amigo da mesa', exact: true }).tap();
    const playerMenu = page.getByRole('dialog', { name: 'Jogador Amigo da mesa', exact: true });
    await expect(playerMenu.getByRole('button', { name: 'Diminuir vida', exact: true })).toBeVisible();
    await expect(playerMenu.getByRole('button', { name: 'Aumentar vida', exact: true })).toBeVisible();
    await playerMenu.getByRole('button', { name: 'Fechar jogador', exact: true }).tap();
    const row = hand.locator('.zone-cards');
    expect(await row.evaluate(node => node.scrollWidth > node.clientWidth)).toBe(true);
    const cdp = await page.context().newCDPSession(page);
    const box = (await row.boundingBox())!;
    for (let i = 0; i < 3; i++) {
      const y = box.y + box.height - 25;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width - 8, y }] });
      for (let step = 1; step <= 5; step++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + box.width - 8 - step * 20, y }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
    await cdp.detach();
    await expect.poll(() => row.evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
    const last = (await cards.last().boundingBox())!, rowBox = (await row.boundingBox())!;
    expect(last.x + last.width).toBeLessThanOrEqual(rowBox.x + rowBox.width + 2);
    await page.screenshot({ path: info.outputPath('320-mao-deslizada.png') });
    await page.setViewportSize({ width: 568, height: 320 });
    await expect(page.locator('.match-board')).toHaveClass(/mobile-table/);
    const rail = field.locator('.zone-column');
    const railBox = (await rail.boundingBox())!;
    const railTouch = await page.context().newCDPSession(page);
    for (let swipe = 0; swipe < 3; swipe++) {
      await railTouch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: railBox.x + railBox.width / 2, y: railBox.y + railBox.height - 10 }] });
      for (let step = 1; step <= 5; step++) await railTouch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: railBox.x + railBox.width / 2, y: railBox.y + railBox.height - 10 - step * 15 }] });
      await railTouch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
    await railTouch.detach();
    await expect.poll(() => rail.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
    const exile = (await rail.getByRole('region', { name: 'Exílio', exact: true }).boundingBox())!;
    expect(exile.y + exile.height).toBeLessThanOrEqual(railBox.y + railBox.height + 1);
    const libraryButton = rail.getByRole('button', { name: 'Abrir ações do grimório', exact: true });
    const libraryBox = (await libraryButton.boundingBox())!;
    expect(libraryBox.width).toBeGreaterThanOrEqual(44);
    expect(libraryBox.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: info.outputPath('568-trilho-deslizado.png') });
  } finally { await other.close(); }
});
