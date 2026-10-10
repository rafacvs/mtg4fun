import { test, expect } from './fixtures';

test('convidado entra, recarrega a sessão e sai', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Toda boa partida/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('login.png'), fullPage: true });
  await page.getByLabel('Login', { exact: true }).fill('amigo');
  await page.getByLabel('Senha', { exact: true }).fill('senha-do-navegador');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Lobby' })).toBeVisible();
  await expect(page.getByText('Amigo da mesa', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('autenticado.png'), fullPage: true });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Lobby' })).toBeVisible();
  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  await expect(page.getByLabel('Login', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Login', { exact: true })).toBeVisible();
});

test('volta ao login ao sair de uma sessão já revogada', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Login', { exact: true }).fill('amigo');
  await page.getByLabel('Senha', { exact: true }).fill('senha-do-navegador');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Lobby' })).toBeVisible();
  // Revoke through the public API while the page still displays its prior state.
  expect((await page.request.delete('/api/session')).status()).toBe(204);
  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  await expect(page.getByLabel('Login', { exact: true })).toBeVisible();
});

test('credenciais inválidas mostram erro e permitem tentar novamente', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Login', { exact: true }).fill('amigo');
  await page.getByLabel('Senha', { exact: true }).fill('senha-incorreta');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Login ou senha inválidos.');
  await expect(page.getByLabel('Login', { exact: true })).toBeVisible();
  await page.getByLabel('Senha', { exact: true }).fill('senha-do-navegador');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Lobby' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
