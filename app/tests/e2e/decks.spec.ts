import { test, expect } from './fixtures';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('importa, reutiliza e exclui deck salvo', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Login', { exact: true }).fill('amigo');
  await page.getByLabel('Senha', { exact: true }).fill('senha-do-navegador');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.getByRole('link', { name: 'Meus decks', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Meus decks' })).toBeVisible();
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Selecionar arquivo', exact: true }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({ name: 'amigos.cod', mimeType: 'application/xml', buffer: readFileSync(resolve('../api/tests/integration/testdata/cockatrice-deck.cod')) });
  await page.getByRole('button', { name: 'Importar deck', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Amigos & mágicas' })).toBeVisible();
  await expect(page.getByText('5 × Island', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.reload();
  await page.getByLabel('Escolher deck salvo').selectOption({ label: 'Amigos & mágicas (7 cartas)' });
  await expect(page.getByText('5 × Island', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Excluir deck', exact: true }).click();
  await expect(page.getByText('Nenhum deck salvo. Importe seu primeiro arquivo.')).toBeVisible();
  await page.getByLabel('Arquivo .cod').setInputFiles({ name: 'inválido.cod', mimeType: 'application/xml', buffer: Buffer.from('not XML') });
  await page.getByRole('button', { name: 'Importar deck', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Arquivo .cod inválido');
  await expect(page.getByRole('button', { name: 'Importar deck', exact: true })).toBeVisible();
});

test('aguarda a listagem inicial antes de importar', async ({ page }) => {
  let releaseListing!: () => void;
  const listingGate = new Promise<void>(resolve => { releaseListing = resolve; });
  await page.route('**/api/decks', async route => {
    if (route.request().method() !== 'GET') { await route.continue(); return; }
    const response = await route.fetch();
    await listingGate;
    await route.fulfill({ response });
  });
  await page.goto('/');
  await page.getByLabel('Login', { exact: true }).fill('amigo');
  await page.getByLabel('Senha', { exact: true }).fill('senha-do-navegador');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.getByRole('link', { name: 'Meus decks', exact: true }).click();
  await expect(page.getByText('Carregando decks…')).toBeVisible();
  await page.getByLabel('Arquivo .cod').setInputFiles({ name: 'amigos.cod', mimeType: 'application/xml', buffer: readFileSync(resolve('../api/tests/integration/testdata/cockatrice-deck.cod')) });
  try {
    await expect(page.getByRole('button', { name: 'Importar deck', exact: true })).toBeDisabled();
  } finally { releaseListing(); }
  await expect(page.getByRole('button', { name: 'Importar deck', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Importar deck', exact: true }).click();
  await expect(page.getByText('5 × Island', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Excluir deck', exact: true }).click();
  await expect(page.getByText('Nenhum deck salvo. Importe seu primeiro arquivo.')).toBeVisible();
});

test('consulta texto e imagem da carta e explica imagem indisponível', async ({ page }) => {
  let imageAvailable = true;
  await page.route('**/api/cards/image?*', async route => {
    if (imageAvailable) {
      await route.fulfill({ status: 200, contentType: 'image/jpeg', headers: { 'Cache-Control': 'no-store' }, body: Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9k=', 'base64') });
      return;
    }
    await route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'Não foi possível carregar a imagem desta carta.' }) });
  });
  await page.goto('/');
  await page.getByLabel('Login', { exact: true }).fill('amigo');
  await page.getByLabel('Senha', { exact: true }).fill('senha-do-navegador');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.getByRole('link', { name: 'Meus decks', exact: true }).click();
  await page.getByLabel('Arquivo .cod').setInputFiles({ name: 'amigos.cod', mimeType: 'application/xml', buffer: readFileSync(resolve('../api/tests/integration/testdata/cockatrice-deck.cod')) });
  await page.getByRole('button', { name: 'Importar deck', exact: true }).click();
  await page.getByRole('button', { name: 'Consultar Island', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Island', exact: true })).toBeVisible();
  await expect(page.getByText('Add U.', { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Imagem ampliada de Island' })).toBeVisible();
  await page.getByRole('button', { name: 'Fechar consulta', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Island', exact: true })).not.toBeVisible();

  imageAvailable = false;
  await page.getByRole('button', { name: 'Consultar Fire // Ice', exact: true }).click();
  await expect(page.getByText('A imagem não está disponível agora. O texto da carta continua acessível.', { exact: true })).toBeVisible();
});
