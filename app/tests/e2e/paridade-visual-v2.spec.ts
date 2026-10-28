import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { APIRequestContext, BrowserContext } from '@playwright/test';
import { test, expect, closeMatchRail, openMatchRail, returnOpeningHandToLibrary, roomBody } from './fixtures';
import { captureV2ReferenceBoards, writeV2ComparisonReport } from './paridade-visual-v2';

async function expectFieldsInsideTable(page: import('@playwright/test').Page, count: number) {
  const fields = page.locator('.desktop-fields');
  const bounds = await fields.boundingBox();
  expect(bounds).not.toBeNull();
  const tables = await fields.getByRole('article', { name: /Mesa de/ }).all();
  expect(tables).toHaveLength(count);
  const boxes = await Promise.all(tables.map(async table => {
    await expect(table).toBeVisible();
    const box = await table.boundingBox();
    expect(box).not.toBeNull();
    return box!;
  }));
  for (const box of boxes) {
    expect(box.width).toBeGreaterThan(40);
    expect(box.height).toBeGreaterThan(40);
    expect(box.x).toBeGreaterThanOrEqual(bounds!.x - 1);
    expect(box.y).toBeGreaterThanOrEqual(bounds!.y - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(bounds!.x + bounds!.width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(bounds!.y + bounds!.height + 1);
  }
  for (const [index, box] of boxes.entries()) for (const other of boxes.slice(index + 1)) {
    const overlapWidth = Math.min(box.x + box.width, other.x + other.width) - Math.max(box.x, other.x);
    const overlapHeight = Math.min(box.y + box.height, other.y + other.height) - Math.max(box.y, other.y);
    expect(overlapWidth <= 1 || overlapHeight <= 1).toBe(true);
  }
}

async function expectOccupiedFieldsVisible(page: import('@playwright/test').Page, count: number) {
  const tables = page.locator('.desktop-fields').getByRole('article', { name: /Mesa de/ });
  await expect(tables).toHaveCount(count);
  for (const table of await tables.all()) {
    const field = table.locator('.zone-battlefield');
    const cards = field.getByRole('button', { name: 'Soldier Token', exact: true });
    await expect(cards).toHaveCount(3);
    await expect.poll(async () => {
      const bounds = await field.boundingBox();
      if (!bounds) return false;
      const boxes = await Promise.all((await cards.all()).map(card => card.boundingBox()));
      return boxes.every(box => box && box.x >= bounds.x - 1 && box.y >= bounds.y - 1
        && box.x + box.width <= bounds.x + bounds.width + 1
        && box.y + box.height <= bounds.y + bounds.height + 1);
    }).toBe(true);
  }
}

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
      const drawn = await context.request.post(`${matchPath}/actions`, { data: { kind: 'draw', intentId: randomUUID(), count: 1 } });
      expect(drawn.ok()).toBe(true);
      const { match } = await drawn.json();
      const own = match.players.find((player: { userId: number }) => player.userId === match.viewerId);
      expect((await context.request.post(`${matchPath}/actions`, { data: { kind: 'move', intentId: randomUUID(), cardIds: [own.hand[0].id], to: 'battlefield' } })).ok()).toBe(true);
      expect((await context.request.post(`${matchPath}/actions`, { data: { kind: 'position', intentId: randomUUID(), cardId: own.hand[0].id, x: 2, row: 0 } })).ok()).toBe(true);
    }
    expect((await page.request.post(`${matchPath}/actions`, { data: { kind: 'draw', intentId: randomUUID(), count: 5 } })).ok()).toBe(true);
    await page.goto(`/#/salas/${roomId}`);
    await expect(page.getByRole('article', { name: /Mesa de/ })).toHaveCount(4);
    // The acceptance evidence must include an actual complete card, fetched by
    // the public image endpoint.  Do not route this request to a placeholder:
    // a failed source is an acceptance failure, not a reason to fake artwork.
    const imageResponse = await page.request.get('/api/cards/image?name=Island');
    expect(imageResponse.ok(), await imageResponse.text()).toBe(true);
    expect(imageResponse.headers()['content-type']).toMatch(/^image\//);
    const hand = page.getByRole('region', { name: 'Mão', exact: true });
    const islandImage = hand.getByRole('button', { name: 'Island', exact: true }).first().locator('img');
    await expect(islandImage).toHaveAttribute('src', /\/api\/cards\/image\?/);
    await expect.poll(() => islandImage.evaluate(node => {
      const image = node as HTMLImageElement;
      return image.complete && image.naturalWidth > 0;
    })).toBe(true);
    const fieldImages = page.locator('.zone-battlefield .playing-card[aria-label="Island"] img');
    await expect(fieldImages).toHaveCount(4);
    await expect.poll(() => fieldImages.evaluateAll(nodes => nodes.every(node => {
      const image = node as HTMLImageElement;
      return image.complete && image.naturalWidth > 0;
    }))).toBe(true);

    const captures = new Map<string, string>();
    const capture = async (id: string) => {
      const name = `${id.toLowerCase()}-aplicacao-atual.png`;
      await page.screenshot({ path: testInfo.outputPath(name), animations: 'disabled' });
      captures.set(id, name);
    };
    await page.setViewportSize({ width: 1440, height: 900 });
    await capture('V1');
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.screenshot({ path: testInfo.outputPath('diagnostico-1366x768-aplicacao-atual.png') });
    await page.setViewportSize({ width: 1440, height: 900 });
    // O foco desktop foi removido por decisão do usuário; a captura registra a grade atual.
    await expect(page.locator('.seat-focus')).toHaveCount(0);
    await capture('V2');
    await page.getByRole('article', { name: 'Mesa de Amigo da mesa', exact: true }).getByRole('button', { name: 'Island', exact: true }).hover();
    await expect(page.getByRole('region', { name: 'Prévia da carta', exact: true })).toBeVisible();
    await capture('V3');
    await openMatchRail(page, 'Registro');
    await expect(page.getByRole('region', { name: 'Registro da partida', exact: true })).toBeVisible();
    await capture('V4');
    await closeMatchRail(page);
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.locator('.match-board')).toHaveClass(/mobile-table/);
    await page.getByRole('button', { name: 'Abrir visão geral', exact: true }).click();
    await capture('V5');
    const landscapeFocus = page.getByRole('button', { name: 'Ampliar mesa de Segundo amigo', exact: true });
    await expect(landscapeFocus).toBeVisible();
    await landscapeFocus.click();
    await expect(page.locator('.desktop-fields.has-field-focus')).toBeVisible();
    await capture('V6');
    await page.getByRole('button', { name: 'Abrir visão geral', exact: true }).click();
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
    const opponentCard = page.getByRole('region', { name: 'Oponentes', exact: true }).getByRole('button', { name: 'Island', exact: true }).first();
    await opponentCard.click();
    const reading = page.getByRole('dialog', { name: 'Imagem de Island', exact: true });
    await expect(reading).toBeVisible();
    await expect(reading.getByRole('button', { name: 'Ver campo', exact: true })).toBeVisible();
    await capture('V9');
    writeV2ComparisonReport(testInfo.outputDir, captures);
    const comparison = JSON.parse(readFileSync(testInfo.outputPath('comparativo-v2.json'), 'utf8')) as {
      rows: Array<{ id: string; visualReview: Record<string, string> }>;
    };
    expect(comparison.rows).toHaveLength(9);
    for (const row of comparison.rows) {
      expect(row.visualReview).toMatchObject({
        composition: 'Aguardando revisão visual humana.',
        measures: 'Aguardando revisão visual humana.',
        typography: 'Aguardando revisão visual humana.',
        colors: 'Aguardando revisão visual humana.',
        playmat: 'Aguardando revisão visual humana.',
        frames: 'Aguardando revisão visual humana.',
        controls: 'Aguardando revisão visual humana.',
        differences: 'Aguardando revisão visual humana.',
        exceptionJustification: 'Aguardando revisão visual humana.',
      });
    }
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
      // Controlled token artwork is not visual evidence. These real API actions
      // populate each field so geometry is exercised with occupied positions.
      for (const context of [page.context(), ...contexts]) {
        for (const [index, [x, row]] of [[0, 0], [2, 0], [0, 2]].entries()) {
          const created = await context.request.post(`/api/rooms/${roomId}/match/actions`, { data: { kind: 'create-token', intentId: randomUUID(), tokenName: 'Soldier Token' } });
          expect(created.ok()).toBe(true);
          const { match } = await created.json();
          const own = match.players.find((player: { userId: number }) => player.userId === match.viewerId);
          const cardId = own.battlefield.at(-1).id;
          expect((await context.request.post(`/api/rooms/${roomId}/match/actions`, { data: { kind: 'position', intentId: randomUUID(), cardId, x, row } })).ok()).toBe(true);
          if (index === 2) expect((await context.request.post(`/api/rooms/${roomId}/match/actions`, { data: { kind: 'set_tapped', intentId: randomUUID(), cardIds: [cardId], tapped: true } })).ok()).toBe(true);
        }
      }
      await page.goto(`/#/salas/${roomId}`);
      await expect(page.getByRole('article', { name: /Mesa de/ })).toHaveCount(playerCount);

      for (const [orientation, viewport] of [['desktop', { width: 1440, height: 900 }], ['horizontal', { width: 844, height: 390 }], ['vertical', { width: 390, height: 844 }]] as const) {
        await page.setViewportSize(viewport);
        await expect(page.locator('.match-board')).toHaveClass(orientation === 'desktop' ? /desktop-table/ : /mobile-table/);
        if (orientation !== 'desktop') {
          await expect(page.getByRole('article', { name: 'Mesa de Amigo da mesa', exact: true })).toBeVisible();
          await page.getByRole('button', { name: 'Abrir visão geral', exact: true }).click();
        }
        await expectFieldsInsideTable(page, playerCount);
        await expectOccupiedFieldsVisible(page, playerCount);
        if (playerCount === 2 && orientation !== 'vertical') {
          const fields = await page.locator('.desktop-fields').boundingBox();
          for (const table of await page.locator('.desktop-fields').getByRole('article', { name: /Mesa de/ }).all()) {
            const box = await table.boundingBox();
            expect(box!.width).toBeCloseTo(fields!.width, 0);
          }
        }
        await page.screenshot({ path: testInfo.outputPath(`matriz-${playerCount}-${orientation}-geral.png`) });
        if (orientation !== 'desktop') {
          await page.getByRole('button', { name: 'Ampliar mesa de Segundo amigo', exact: true }).click();
          const focusedTable = page.getByRole('article', { name: 'Mesa de Segundo amigo', exact: true });
          await expect(focusedTable).toBeVisible();
          await expect(page.getByRole('article', { name: 'Mesa de Amigo da mesa', exact: true })).toBeHidden();
          const focusedCards = focusedTable.getByRole('button', { name: 'Soldier Token', exact: true });
          await expect(focusedCards).toHaveCount(3);
          for (const card of await focusedCards.all()) await expect(card).toBeInViewport({ ratio: .99 });
          await page.screenshot({ path: testInfo.outputPath(`matriz-${playerCount}-${orientation}-foco.png`) });
          await page.getByRole('button', { name: 'Voltar para meu campo', exact: true }).click();
        } else await expect(page.locator('.seat-focus')).toHaveCount(0);
      }
      await page.setViewportSize({ width: 1366, height: 768 });
      await page.screenshot({ path: testInfo.outputPath(`matriz-${playerCount}-desktop-1366x768.png`) });
    } finally {
      await Promise.all(contexts.map(context => context.close()));
    }
  }
});
