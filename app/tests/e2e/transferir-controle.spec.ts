import type { Locator, Page } from '@playwright/test';
import { test, expect, openMatchRail, selectFieldArea } from './fixtures';

const deckFile = {
  name: 'ilha.cod',
  mimeType: 'application/xml',
  buffer: Buffer.from('<cockatrice_deck><zone name="main"><card number="1" name="Island"/></zone></cockatrice_deck>'),
};

test('transfere o controle e devolve a carta à zona do dono por mouse ou toque', async ({ page, browser, baseURL }, info) => {
  test.setTimeout(60_000);

  const activate = async (locator: Locator) => {
    if (info.project.use.hasTouch) await locator.tap(); else await locator.click();
  };
  const owner = page.request;
  expect((await owner.post('/api/session', { data: { login: 'amigo', password: 'senha-do-navegador' } })).ok()).toBe(true);
  const ownerDeck = await owner.post('/api/decks', { multipart: { file: deckFile } });
  expect(ownerDeck.status()).toBe(201);
  const ownerDeckID = (await ownerDeck.json()).deck.id;
  const room = (await (await owner.post('/api/rooms', { data: {} })).json()).room;
  const context = async () => browser.newContext({ baseURL, viewport: info.project.use.viewport, isMobile: info.project.use.isMobile, hasTouch: info.project.use.hasTouch });
  const second = await context();
  const third = await context();
  try {
    for (const [api, login] of [[second.request, 'segundo'], [third.request, 'amigo3']] as const) {
      expect((await api.post('/api/session', { data: { login, password: 'senha-do-navegador' } })).ok()).toBe(true);
      const deck = await api.post('/api/decks', { multipart: { file: deckFile } });
      expect(deck.status()).toBe(201);
      expect((await api.post(`/api/rooms/${room.id}/participants`, { data: {} })).ok()).toBe(true);
      expect((await api.put(`/api/rooms/${room.id}/participants/me/ready`, { data: { deckId: (await deck.json()).deck.id } })).ok()).toBe(true);
    }
    expect((await owner.put(`/api/rooms/${room.id}/participants/me/ready`, { data: { deckId: ownerDeckID } })).ok()).toBe(true);
    expect((await owner.post(`/api/rooms/${room.id}/start`, { data: {} })).status()).toBe(201);
    const drawn = (await (await owner.post(`/api/rooms/${room.id}/match/actions`, { data: { intentId: crypto.randomUUID(), kind: 'draw', count: 1 } })).json()).match.players[0].hand[0];
    expect((await owner.post(`/api/rooms/${room.id}/match/actions`, { data: { intentId: crypto.randomUUID(), kind: 'move', cardIds: [drawn.id], to: 'battlefield' } })).ok()).toBe(true);

    const thirdDraw = await third.request.post(`/api/rooms/${room.id}/match/actions`, { data: { intentId: crypto.randomUUID(), kind: 'draw', count: 1 } });
    expect(thirdDraw.ok()).toBe(true);
    const thirdMatch = (await thirdDraw.json()).match;
    const thirdId = thirdMatch.viewerId;
    const secondId = thirdMatch.players.find((player: { name: string }) => player.name === 'Segundo amigo').userId;
    const ownCardId = thirdMatch.players.find((player: { userId: number }) => player.userId === thirdId).hand[0].id;
    expect((await third.request.post(`/api/rooms/${room.id}/match/actions`, { data: { intentId: crypto.randomUUID(), kind: 'move', cardIds: [ownCardId], to: 'battlefield' } })).ok()).toBe(true);
    const chosenPage = await third.newPage();
    await page.route('**/api/cards/image?*', route => route.fulfill({ status: 502, body: 'indisponível' }));
    await chosenPage.route('**/api/cards/image?*', route => route.fulfill({ status: 502, body: 'indisponível' }));
    await page.goto(`/#/salas/${room.id}`);
    await chosenPage.goto(`/#/salas/${room.id}`);
    await page.getByRole('button', { name: 'Ampliar mesa de Amigo da mesa', exact: true }).click();
    await chosenPage.getByRole('button', { name: 'Ampliar mesa de Amigo 3', exact: true }).click();
    const ownerTable = page.getByRole('article', { name: 'Mesa de Amigo da mesa', exact: true });
    const ownerCard = ownerTable.getByRole('region', { name: 'Campo', exact: true }).getByRole('button', { name: 'Island', exact: true });
    await activate(ownerCard);
    const ownerPreview = page.getByRole('dialog', { name: 'Imagem de Island' });
    await ownerPreview.getByRole('button', { name: 'Outras ações', exact: true }).click();
    const transfer = ownerPreview.getByRole('region', { name: 'Controle da carta' });
    const target = transfer.getByLabel('Transferir controle para');
    await expect(target.locator('option:checked')).toHaveText('Segundo amigo');
    await target.selectOption({ label: 'Amigo 3' });
    await page.waitForTimeout(1200);
    await expect(target.locator('option:checked')).toHaveText('Amigo 3');
    await activate(transfer.getByRole('button', { name: 'Transferir controle', exact: true }));
    await expect(ownerTable.getByRole('region', { name: 'Campo', exact: true }).getByRole('button', { name: 'Island', exact: true })).toHaveCount(0);

    await activate(ownerPreview.getByRole('button', { name: 'Fechar', exact: true }));
    const chosenTable = chosenPage.getByRole('article', { name: 'Mesa de Amigo 3', exact: true });
    const chosenField = chosenTable.getByRole('region', { name: 'Campo', exact: true });
    const controlledCard = chosenField.locator(`[data-card-id="${drawn.id}"]`);
    await expect(controlledCard).toBeVisible();
    if (!info.project.use.hasTouch) {
      // Multiple-card selection is by mouse area; touch keeps individual actions.
      await selectFieldArea(chosenPage, chosenField);
      await expect(chosenField.locator('.is-selected')).toHaveCount(2);
      const before = await third.request.get(`/api/rooms/${room.id}/match`);
      const beforePlayer = (await before.json()).match.players.find((player: { userId: number }) => player.userId === thirdId);
      const anchor = (await controlledCard.boundingBox())!;
      await dragCard(chosenPage, controlledCard, { x: anchor.x + anchor.width + 100, y: anchor.y + anchor.height / 2 }, false);
      await expect(chosenField.locator('.is-selected')).toHaveCount(0);
      await expect(async () => {
        const response = await third.request.get(`/api/rooms/${room.id}/match`);
        const current = (await response.json()).match.players.find((player: { userId: number }) => player.userId === thirdId);
        const [first, received] = current.battlefield;
        expect(first.positionX).not.toBe(beforePlayer.battlefield[0].positionX);
        expect(received.positionX - first.positionX).toBe(beforePlayer.battlefield[1].positionX - beforePlayer.battlefield[0].positionX);
        expect(received.ownerId).toBe(drawn.ownerId);
      }).toPass();
      await selectFieldArea(chosenPage, chosenField);
      await expect(chosenField.locator('.is-selected')).toHaveCount(2);
      expect((await third.request.post(`/api/rooms/${room.id}/match/actions`, { data: { intentId: crypto.randomUUID(), kind: 'transfer_control', cardId: drawn.id, controllerId: secondId } })).ok()).toBe(true);
      await expect(chosenField.locator('.is-selected')).toHaveCount(1);
      await expect(controlledCard).toHaveCount(0);
      expect((await second.request.post(`/api/rooms/${room.id}/match/actions`, { data: { intentId: crypto.randomUUID(), kind: 'transfer_control', cardId: drawn.id, controllerId: thirdId } })).ok()).toBe(true);
      await expect(controlledCard).toBeVisible();
      await chosenPage.keyboard.press('Escape');
      await expect(chosenField.locator('.is-selected')).toHaveCount(0);
    }
    await chosenTable.getByRole('region', { name: 'Cemitério', exact: true }).scrollIntoViewIfNeeded();
    const graveyard = (await chosenTable.getByRole('region', { name: 'Cemitério', exact: true }).boundingBox())!;
    await dragCard(chosenPage, controlledCard, { x: graveyard.x + graveyard.width / 2, y: graveyard.y + graveyard.height / 2 }, Boolean(info.project.use.hasTouch));
    await expect(chosenPage.getByText('Escolha explicitamente a zona do dono para mover a carta.')).toBeVisible();
    await expect(controlledCard).toBeVisible();
    await expect(ownerTable.getByRole('region', { name: 'Cemitério', exact: true }).getByRole('button', { name: 'Island', exact: true })).toHaveCount(0);

    const controllerPreview = chosenPage.getByRole('dialog', { name: 'Imagem de Island' });
    await controllerPreview.getByRole('button', { name: 'Mover para…', exact: true }).click();
    const ownerZones = controllerPreview.getByRole('region', { name: 'Controle da carta' });
    await expect(ownerZones.getByText('Mover para zona de Amigo da mesa', { exact: false })).toBeVisible();
    await ownerZones.getByLabel('Mover para zona de Amigo da mesa').selectOption('graveyard');
    await chosenPage.screenshot({ path: info.outputPath('controle-design-atual.png'), fullPage: true });
    await activate(ownerZones.getByRole('button', { name: 'Mover para zona do dono', exact: true }));
    await expect(controlledCard).toHaveCount(0);
    await expect(chosenField.locator(`[data-card-id="${ownCardId}"]`)).toBeVisible();
    await expect(ownerTable.getByRole('region', { name: 'Cemitério', exact: true }).getByRole('button', { name: 'Island', exact: true })).toBeVisible();
    await openMatchRail(page);
    await expect(page.getByRole('region', { name: 'Registro da partida', exact: true })).toContainText('transferiu o controle de uma carta para Amigo 3');
  } finally {
    await second.close();
    await third.close();
  }
});

async function dragCard(page: Page, source: Locator, target: { x: number; y: number }, touch: boolean) {
  const box = (await source.boundingBox())!;
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 };
  if (!touch) {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 8 });
    await page.mouse.up();
    return;
  }
  const session = await page.context().newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
  for (let step = 1; step <= 8; step++) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + (target.x - start.x) * step / 8, y: start.y + (target.y - start.y) * step / 8, id: 1 }] });
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await session.detach();
}
