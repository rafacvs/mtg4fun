import { test, expect, roomBody } from './fixtures';

test('biblioteca e lobby apresentam dados reais', async ({ page }, info) => {
  expect((await page.request.post('/api/session', { data: { login: 'amigo', password: 'senha-do-navegador' } })).ok()).toBe(true);
  const upload = await page.request.post('/api/decks', { multipart: { file: { name: 'ilha.cod', mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck><deckname>Marés de Simic</deckname><zone name="main"><card number="7" name="Island"/></zone></cockatrice_deck>') } } });
  expect(upload.status(), await upload.text()).toBe(201);
  await page.request.post('/api/rooms', { data: roomBody({ name: 'A mesa dos amigos' }) });
  await page.goto('/#/salas');
  await expect(page.getByText('A mesa dos amigos')).toBeVisible();
  await page.screenshot({ path: info.outputPath('lobby.png'), fullPage: true });
  await page.getByRole('link', { name: 'Meus decks' }).click();
  const importCard = page.locator('.import-card');
  const librarySearch = page.locator('.library-search');
  await expect(importCard).toBeVisible();
  await expect(librarySearch).toBeVisible();
  const [importBounds, searchBounds] = await Promise.all([importCard.boundingBox(), librarySearch.boundingBox()]);
  expect(importBounds).not.toBeNull();
  expect(searchBounds).not.toBeNull();
  expect(importBounds!.y + importBounds!.height).toBeLessThanOrEqual(searchBounds!.y + 1);
  await page.getByRole('button', { name: /Marés de Simic/ }).click();
  await expect(page.getByRole('heading', { name: 'Marés de Simic' })).toBeVisible();
  await page.screenshot({ path: info.outputPath('decks.png'), fullPage: true });
});
