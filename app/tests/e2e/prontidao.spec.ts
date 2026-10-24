import { test, expect, roomBody } from './fixtures';

const deckFile = (name: string) => ({
  name: `${name}.cod`,
  mimeType: 'application/xml',
  buffer: Buffer.from(`<cockatrice_deck><deckname>${name}</deckname><zone name="main"><card number="3" name="Island"/></zone></cockatrice_deck>`),
});

test('desfaz a prontidão, devolve o seletor e impede o início', async ({ page, browser, baseURL }) => {
  test.setTimeout(60_000);
  await page.goto('/');
  await page.getByLabel('Login', { exact: true }).fill('amigo');
  await page.getByLabel('Senha', { exact: true }).fill('senha-do-navegador');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Lobby', exact: true })).toBeVisible();
  const { deck } = await (await page.request.post('/api/decks', { multipart: { file: deckFile('Mesa do criador') } })).json();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Lobby', exact: true })).toBeVisible();
  const other = await browser.newContext({ baseURL });
  try {
    expect((await other.request.post('/api/session', { data: { login: 'segundo', password: 'senha-do-navegador' } })).ok()).toBe(true);
    const { deck: first } = await (await other.request.post('/api/decks', { multipart: { file: deckFile('Primeiro deck') } })).json();
    const { deck: second } = await (await other.request.post('/api/decks', { multipart: { file: deckFile('Segundo deck') } })).json();
    const { room } = await (await page.request.post('/api/rooms', { data: roomBody() })).json();
    expect((await other.request.post(`/api/rooms/${room.id}/participants`, { data: {} })).ok()).toBe(true);
    const guest = await other.newPage();
    await guest.goto(`/#/salas/${room.id}`);
    await page.goto(`/#/salas/${room.id}`);
    await expect(page.getByRole('region', { name: 'Preparação da sala' })).toBeVisible();
    await page.getByLabel('Deck para a partida').selectOption(String(deck.id));
    await expect(page.getByRole('button', { name: 'Iniciar partida', exact: true })).toBeDisabled();
    await expect(page.getByRole('status').filter({ hasText: 'Ainda falta: Amigo da mesa' })).toBeVisible();
    await page.getByRole('button', { name: 'Estou pronto', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Ainda falta: Segundo amigo' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Iniciar partida', exact: true })).toBeDisabled();
    await guest.getByLabel('Deck para a partida').selectOption(String(first.id));
    await guest.getByRole('button', { name: 'Estou pronto', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Todos prontos para começar.' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Iniciar partida', exact: true })).toBeEnabled();
    await guest.getByRole('button', { name: 'Desfazer prontidão', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Iniciar partida', exact: true })).toBeDisabled();
    await expect(page.getByRole('status').filter({ hasText: 'Ainda falta: Segundo amigo' })).toBeVisible();
    const selector = guest.getByLabel('Deck para a partida');
    await expect(selector).toBeEnabled();
    await expect(selector).toHaveValue(String(first.id));
    await selector.selectOption(String(second.id));
    await expect(selector).toHaveValue(String(second.id));
    await expect(page.getByRole('button', { name: 'Iniciar partida', exact: true })).toBeDisabled();
  } finally {
    await other.close();
  }
});
