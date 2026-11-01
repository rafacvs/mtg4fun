import { test, expect, roomBody } from './fixtures';
import type { Page } from '@playwright/test';

const deckFile = (name: string) => `<cockatrice_deck><deckname>${name}</deckname><zone name="main"><card number="6" name="Island"/><card number="1" name="Gargos, Vicious Watcher"/></zone></cockatrice_deck>`;
const uniqueName = (label: string, info: { project: { name: string } }) => `${label} ${info.project.name} ${Date.now()}`;
const login = async (client: Page, user: string) => expect((await client.request.post('/api/session', { data: { login: user, password: 'senha-do-navegador' } })).ok()).toBe(true);
const isMobile = async (page: Page) => page.evaluate(() => matchMedia('(max-width: 800px), (max-width: 1000px) and (pointer: coarse)').matches);
const openDeckPanel = async (page: Page) => { if (await isMobile(page)) await page.getByRole('button', { name: /Trocar/ }).click(); };

test('importa e edita o deck sem sair da preparação, e a mesa vê a mudança', async ({ page, browser, baseURL }, info) => {
  test.setTimeout(60_000);
  const guestContext = await browser.newContext({ baseURL, viewport: info.project.use.viewport });
  try {
    const guest = await guestContext.newPage();
    await login(page, 'amigo');
    await login(guest, 'segundo');
    const { room } = await (await page.request.post('/api/rooms', { data: roomBody({ name: uniqueName('Mesa com import', info), seats: 4 }) })).json();
    expect((await guest.request.post(`/api/rooms/${room.id}/participants`, { data: {} })).ok()).toBe(true);
    await Promise.all([page.goto(`/#/salas/${room.id}`), guest.goto(`/#/salas/${room.id}`)]);
    await openDeckPanel(page);

    const deckName = uniqueName('Deck da mesa', info);
    await page.getByRole('button', { name: 'Importar deck', exact: true }).click();
    const importDialog = page.getByRole('dialog', { name: 'Importar deck' });
    await importDialog.getByLabel('Arquivo .cod').setInputFiles({ name: 'mesa.cod', mimeType: 'application/xml', buffer: Buffer.from(deckFile(deckName)) });
    await importDialog.getByRole('button', { name: 'Importar deck', exact: true }).click();
    await expect(importDialog).not.toBeVisible();
    await expect(page.getByLabel('Deck para a partida')).toHaveValue(/\d+/);
    const chosen = page.getByLabel('Deck escolhido');
    await expect(chosen).toContainText(deckName);
    await expect.poll(async () => {
      const { rooms } = await (await guest.request.get('/api/rooms')).json();
      return rooms.find((value: { id: number }) => value.id === room.id).participants.some((player: { deckId?: number }) => player.deckId);
    }).toBe(true);

    const reloaded = guest.waitForResponse(async response => response.url().endsWith(`/api/rooms/${room.id}/preparation-decks`) && (await response.json()).decks.some((deck: { image?: string }) => deck.image === 'Gargos, Vicious Watcher'));
    // O centro do card, longe do lápis no canto: o card inteiro abre a edição.
    await chosen.click();
    const editor = page.getByRole('dialog', { name: `Editar ${deckName}` });
    await expect(editor).toBeVisible();
    await expect(editor.getByRole('button', { name: 'Excluir deck' })).toHaveCount(0);
    await editor.getByRole('button', { name: 'Consultar Gargos, Vicious Watcher', exact: true }).click();
    await expect(editor.getByRole('region', { name: 'Preview de carta' })).toContainText('Gargos, Vicious Watcher');
    await editor.getByRole('button', { name: 'Marcar comandante Gargos, Vicious Watcher', exact: true }).click();
    await expect(editor.getByRole('region', { name: 'Comandante', exact: true })).toContainText('1 × Gargos, Vicious Watcher');
    await reloaded;
    await editor.getByRole('button', { name: 'Fechar edição do deck' }).click();
    await expect(editor).not.toBeVisible();
  } finally {
    await guestContext.close();
  }
});

test('pronto trava importar e editar até ser desfeito', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'No celular o painel do deck só abre antes do pronto.');
  await login(page, 'homonimo');
  const deckName = uniqueName('Deck travado', info);
  const uploaded = await page.request.post('/api/decks', { multipart: { file: { name: 'travado.cod', mimeType: 'application/xml', buffer: Buffer.from(deckFile(deckName)) } } });
  expect(uploaded.status()).toBe(201);
  const { room } = await (await page.request.post('/api/rooms', { data: roomBody({ name: uniqueName('Mesa travada', info), seats: 4 }) })).json();
  await page.goto(`/#/salas/${room.id}`);
  await page.getByLabel('Deck para a partida').selectOption({ label: deckName });
  const edit = page.getByRole('button', { name: `Editar deck ${deckName}` });
  await expect(edit).toBeVisible();
  await page.getByRole('button', { name: 'Estou pronto' }).click();
  await expect(edit).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Importar deck', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Desfazer prontidão' }).click();
  await expect(edit).toBeVisible();
  await expect(page.getByRole('button', { name: 'Importar deck', exact: true })).toBeEnabled();
});
