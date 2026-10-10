import { test, expect } from './fixtures';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('importa, reutiliza e exclui deck salvo', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Login', { exact: true }).fill('amigo');
  await page.getByLabel('Senha', { exact: true }).fill('senha-do-navegador');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
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
