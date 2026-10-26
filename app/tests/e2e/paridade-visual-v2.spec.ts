import { randomUUID } from 'node:crypto';
import type { APIRequestContext, BrowserContext } from '@playwright/test';
import { test, expect, openMatchRail, returnOpeningHandToLibrary, roomBody } from './fixtures';
import { captureV2ReferenceBoards, writeV2ComparisonReport } from './paridade-visual-v2';

test('captura as nove pranchas V2 renderizadas nas dimensões publicadas', async ({ page }, testInfo) => {
  test.setTimeout(90_000);

  const boards = await captureV2ReferenceBoards(page, testInfo.outputDir);

  expect(boards).toEqual([
    ['V1', 'Mesa em quadrantes · 4 jogadores', { width: 1440, height: 900 }],
    ['V2', 'Foco · ampliar um oponente', { width: 1440, height: 900 }],
    ['V3', 'Leitura · prévia ao passar o mouse', { width: 1440, height: 900 }],
    ['V4', 'Crônica aberta · grade se ajusta', { width: 1440, height: 900 }],
    ['V5', 'Celular horizontal · quatro campos', { width: 844, height: 390 }],
    ['V6', 'Celular horizontal · foco em um oponente', { width: 844, height: 390 }],
    ['V7', 'Celular vertical · faixas e carta selecionada', { width: 390, height: 844 }],
    ['V8', 'Celular vertical · faixa expandida', { width: 390, height: 844 }],
    ['V9', 'Celular vertical · ler carta de oponente', { width: 390, height: 844 }],
  ]);
});

test('produz o comparativo inicial de cada prancha com uma partida real descartável', async ({ page, browser, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'O procedimento fixa os três viewports de referência.');
  test.setTimeout(120_000);
  await captureV2ReferenceBoards(page, testInfo.outputDir);

  const contexts: BrowserContext[] = [];
  let roomId = 0;
  try {
    for (const login of ['amigo', 'segundo', 'amigo3', 'amigo4']) {
      const context = login === 'amigo' ? page.context() : await browser.newContext({ baseURL });
      if (context !== page.context()) contexts.push(context);
      const api: APIRequestContext = context.request;
      expect((await api.post('/api/session', { data: { login, password: 'senha-do-navegador' } })).ok()).toBe(true);
      const { deck } = await (await api.post('/api/decks', { multipart: { file: { name: `${login}.cod`, mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck><zone name="main"><card number="20" name="Island"/></zone></cockatrice_deck>') } } })).json();
      if (!roomId) roomId = (await (await api.post('/api/rooms', { data: roomBody() })).json()).room.id;
      else expect((await api.post(`/api/rooms/${roomId}/participants`, { data: {} })).ok()).toBe(true);
      expect((await api.put(`/api/rooms/${roomId}/participants/me/ready`, { data: { deckId: deck.id } })).ok()).toBe(true);
    }
    const matchPath = `/api/rooms/${roomId}/match`;
    expect((await page.request.post(`/api/rooms/${roomId}/start`, { data: {} })).status()).toBe(201);
    await Promise.all([page.context(), ...contexts].map(context => returnOpeningHandToLibrary(context.request, roomId)));
    for (const context of [page.context(), ...contexts]) {
      const created = await context.request.post(`${matchPath}/actions`, { data: { kind: 'create-token', intentId: randomUUID(), tokenName: 'Soldier Token' } });
      expect(created.ok()).toBe(true);
    }
    expect((await page.request.post(`${matchPath}/actions`, { data: { kind: 'draw', intentId: randomUUID(), count: 5 } })).ok()).toBe(true);
    await page.goto(`/#/salas/${roomId}`);
    await expect(page.getByRole('article', { name: /Mesa de/ })).toHaveCount(4);
    // The acceptance evidence must include an actual complete card, fetched by
    // the public image endpoint.  Do not route this request to a placeholder:
    // a failed source is an acceptance failure, not a reason to fake artwork.
    const hand = page.getByRole('region', { name: 'Mão', exact: true });
    const islandImage = hand.getByRole('button', { name: 'Island', exact: true }).first().locator('img');
    await expect(islandImage).toHaveAttribute('src', /\/api\/cards\/image\?/);
    await expect.poll(() => islandImage.evaluate(node => {
      const image = node as HTMLImageElement;
      return image.complete && image.naturalWidth > 0;
    })).toBe(true);

    const captures = new Map<string, string>();
    const capture = async (id: string) => {
      const name = `${id.toLowerCase()}-aplicacao-atual.png`;
      await page.screenshot({ path: testInfo.outputPath(name) });
      captures.set(id, name);
    };
    await page.setViewportSize({ width: 1440, height: 900 });
    await capture('V1');
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.screenshot({ path: testInfo.outputPath('diagnostico-1366x768-aplicacao-atual.png') });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole('button', { name: 'Ampliar mesa de Segundo amigo', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Voltar à visão geral', exact: true })).toBeVisible();
    await capture('V2');
    await page.getByRole('button', { name: 'Voltar à visão geral', exact: true }).click();
    await page.getByRole('article', { name: 'Mesa de Amigo da mesa', exact: true }).getByRole('button', { name: 'Soldier Token', exact: true }).hover();
    await expect(page.getByRole('region', { name: 'Prévia da carta', exact: true })).toBeVisible();
    await capture('V3');
    await openMatchRail(page, 'Registro');
    await expect(page.getByRole('region', { name: 'Registro da partida', exact: true })).toBeVisible();
    await capture('V4');
    await page.getByRole('button', { name: 'Registro', exact: true }).click();
    await page.setViewportSize({ width: 844, height: 390 });
    await capture('V5');
    const landscapeFocus = page.getByRole('button', { name: 'Ampliar mesa de Segundo amigo', exact: true });
    await expect(landscapeFocus).toBeVisible();
    await landscapeFocus.click();
    await expect(page.locator('.desktop-fields.has-field-focus')).toBeVisible();
    await capture('V6');
    await page.getByRole('button', { name: 'Voltar à visão geral', exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    const handCard = hand.getByRole('button', { name: 'Island', exact: true }).first();
    await handCard.click();
    await expect(handCard).toHaveAttribute('aria-pressed', 'true');
    await capture('V7');
    const portraitFocus = page.getByRole('button', { name: 'Ampliar mesa de Segundo amigo', exact: true });
    await expect(portraitFocus).toBeVisible();
    await portraitFocus.click();
    await expect(page.locator('.desktop-fields.has-field-focus')).toBeVisible();
    await capture('V8');
    await page.getByRole('button', { name: 'Voltar à visão geral', exact: true }).click();
    const opponentCard = page.getByRole('region', { name: 'Oponentes', exact: true }).getByRole('button', { name: 'Soldier Token', exact: true }).first();
    await opponentCard.click();
    const reading = page.getByRole('dialog', { name: 'Imagem de Soldier Token', exact: true });
    await expect(reading).toBeVisible();
    await expect(reading.getByRole('button', { name: 'Ver campo', exact: true })).toBeVisible();
    await capture('V9');
    writeV2ComparisonReport(testInfo.outputDir, captures);
  } finally {
    await Promise.all(contexts.map(context => context.close()));
  }
});

test('registra mesa geral e foco de dois a seis participantes em cada orientação', async ({ page, browser, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'A matriz usa os viewports de referência.');
  test.setTimeout(300_000);

  const logins = ['amigo', 'segundo', 'amigo3', 'amigo4', 'amigo5', 'amigo6'];
  for (const playerCount of [2, 3, 4, 5, 6]) {
    const contexts: BrowserContext[] = [];
    let roomId = 0;
    try {
      for (const login of logins.slice(0, playerCount)) {
        const context = login === 'amigo' ? page.context() : await browser.newContext({ baseURL });
        if (context !== page.context()) contexts.push(context);
        const api: APIRequestContext = context.request;
        expect((await api.post('/api/session', { data: { login, password: 'senha-do-navegador' } })).ok()).toBe(true);
        const { deck } = await (await api.post('/api/decks', { multipart: { file: { name: `${login}-${playerCount}.cod`, mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck><zone name="main"><card number="20" name="Island"/></zone></cockatrice_deck>') } } })).json();
        if (!roomId) roomId = (await (await api.post('/api/rooms', { data: roomBody() })).json()).room.id;
        else expect((await api.post(`/api/rooms/${roomId}/participants`, { data: {} })).ok()).toBe(true);
        expect((await api.put(`/api/rooms/${roomId}/participants/me/ready`, { data: { deckId: deck.id } })).ok()).toBe(true);
      }
      expect((await page.request.post(`/api/rooms/${roomId}/start`, { data: {} })).status()).toBe(201);
      await Promise.all([page.context(), ...contexts].map(context => returnOpeningHandToLibrary(context.request, roomId)));
      await page.goto(`/#/salas/${roomId}`);
      await expect(page.getByRole('article', { name: /Mesa de/ })).toHaveCount(playerCount);

      for (const [orientation, viewport] of [['desktop', { width: 1440, height: 900 }], ['horizontal', { width: 844, height: 390 }], ['vertical', { width: 390, height: 844 }]] as const) {
        await page.setViewportSize(viewport);
        await page.screenshot({ path: testInfo.outputPath(`matriz-${playerCount}-${orientation}-geral.png`) });
        const focus = page.getByRole('button', { name: 'Ampliar mesa de Segundo amigo', exact: true });
        await expect(focus).toBeVisible();
        await focus.click();
        await expect(page.getByRole('button', { name: 'Voltar à visão geral', exact: true })).toBeVisible();
        await page.screenshot({ path: testInfo.outputPath(`matriz-${playerCount}-${orientation}-foco.png`) });
        const back = page.getByRole('button', { name: 'Voltar à visão geral', exact: true });
        await back.click();
      }
      await page.setViewportSize({ width: 1366, height: 768 });
      await page.screenshot({ path: testInfo.outputPath(`matriz-${playerCount}-desktop-1366x768.png`) });
    } finally {
      await Promise.all(contexts.map(context => context.close()));
    }
  }
});
