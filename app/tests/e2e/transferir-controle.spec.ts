import type { Locator } from '@playwright/test';
import { test, expect } from './fixtures';

const deckFile = {
  name: 'ilha.cod',
  mimeType: 'application/xml',
  buffer: Buffer.from('<cockatrice_deck><zone name="main"><card number="1" name="Island"/></zone></cockatrice_deck>'),
};

test('transfere o controle e devolve a carta à zona do dono por mouse ou toque', async ({ page, browser, baseURL }, info) => {
  test.skip(info.project.name === 'celular', 'A mesa exige orientação horizontal.');
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

    const chosenPage = await third.newPage();
    await page.route('**/api/cards/image?*', route => route.fulfill({ status: 502, body: 'indisponível' }));
    await chosenPage.route('**/api/cards/image?*', route => route.fulfill({ status: 502, body: 'indisponível' }));
    await page.goto(`/#/salas/${room.id}`);
    await chosenPage.goto(`/#/salas/${room.id}`);
    const ownerTable = page.getByRole('article', { name: 'Mesa de Amigo da mesa', exact: true });
    const ownerCard = ownerTable.getByRole('region', { name: 'Campo', exact: true }).getByRole('button', { name: 'Island', exact: true });
    await activate(ownerCard);
    const ownerPreview = page.getByRole('dialog', { name: 'Imagem de Island' });
    const transfer = ownerPreview.getByRole('region', { name: 'Controle da carta' });
    const target = transfer.getByLabel('Transferir controle para');
    await expect(target.locator('option:checked')).toHaveText('Segundo amigo');
    await target.selectOption({ label: 'Amigo 3' });
    await page.waitForTimeout(1200);
    await expect(target.locator('option:checked')).toHaveText('Amigo 3');
    await activate(transfer.getByRole('button', { name: 'Transferir controle', exact: true }));
    await expect(ownerTable.getByRole('region', { name: 'Campo', exact: true }).getByRole('button', { name: 'Island', exact: true })).toHaveCount(0);

    const chosenTable = chosenPage.getByRole('article', { name: 'Mesa de Amigo 3', exact: true });
    const controlledCard = chosenTable.getByRole('region', { name: 'Campo', exact: true }).getByRole('button', { name: 'Island', exact: true });
    await expect(controlledCard).toBeVisible();
    await controlledCard.dragTo(chosenTable.getByRole('region', { name: 'Cemitério', exact: true }), { steps: 8 });
    await expect(chosenPage.getByText('Escolha explicitamente a zona do dono para mover a carta.')).toBeVisible();
    await expect(controlledCard).toBeVisible();
    await expect(ownerTable.getByRole('region', { name: 'Cemitério', exact: true }).getByRole('button', { name: 'Island', exact: true })).toHaveCount(0);

    const controllerPreview = chosenPage.getByRole('dialog', { name: 'Imagem de Island' });
    const ownerZones = controllerPreview.getByRole('region', { name: 'Controle da carta' });
    await expect(ownerZones.getByText('Mover para zona de Amigo da mesa', { exact: false })).toBeVisible();
    await ownerZones.getByLabel('Mover para zona de Amigo da mesa').selectOption('graveyard');
    await activate(ownerZones.getByRole('button', { name: 'Mover para zona do dono', exact: true }));
    await expect(chosenTable.getByRole('region', { name: 'Campo', exact: true }).getByRole('button', { name: 'Island', exact: true })).toHaveCount(0);
    await expect(ownerTable.getByRole('region', { name: 'Cemitério', exact: true }).getByRole('button', { name: 'Island', exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Registro da partida', exact: true })).toContainText('transferiu o controle de uma carta para Amigo 3');
  } finally {
    await second.close();
    await third.close();
  }
});
