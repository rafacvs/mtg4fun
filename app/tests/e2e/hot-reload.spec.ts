import { test, expect } from './fixtures';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Docker verification supplies disposable copies of the sources.
test('React atualiza no navegador e Go reinicia preservando a sessão', async ({ page, request }) => {
  test.skip(!process.env.E2E_HOT_RELOAD_ROOT, 'Executado pela verificação Docker dev');
  test.setTimeout(120_000);
  const root = process.env.E2E_HOT_RELOAD_ROOT!;
  const reactFile = join(root, 'app/src/features/auth/LoginScreen.tsx');
  const goFile = join(root, 'api/internal/httpserver/middleware.go');
  const reactSource = readFileSync(reactFile, 'utf8');
  const goSource = readFileSync(goFile, 'utf8');
  try {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Toda boa partida/ })).toBeVisible();
    const marker = await page.evaluate(() => {
      (window as unknown as { reloadMarker: string }).reloadMarker = 'mesmo-documento';
      return performance.timeOrigin;
    });
    writeFileSync(reactFile, reactSource.replace('Toda boa partida', 'Recarga React confirmada'));
    await expect(page.getByRole('heading', { name: /Recarga React confirmada/ })).toBeVisible({ timeout: 30_000 });
    expect(await page.evaluate(() => performance.timeOrigin)).toBe(marker);
    expect(await page.evaluate(() => (window as unknown as { reloadMarker: string }).reloadMarker)).toBe('mesmo-documento');
    await page.getByLabel('Login', { exact: true }).fill('amigo');
    await page.getByLabel('Senha', { exact: true }).fill('senha-do-navegador');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Lobby', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sair', exact: true })).toBeVisible();
    writeFileSync(goFile, goSource.replace('Origem não permitida.', 'Recarga Go confirmada.'));
    await expect.poll(async () => {
      try {
        const response = await request.post('/api/session', { headers: { Origin: 'https://outro.example' }, data: {} });
        return (await response.json()).error;
      } catch { return 'API reiniciando'; }
    }, { timeout: 60_000 }).toBe('Recarga Go confirmada.');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Lobby', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sair', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Sair', exact: true }).click();
    await expect(page.getByLabel('Login', { exact: true })).toBeVisible();
  } finally {
    writeFileSync(reactFile, reactSource);
    writeFileSync(goFile, goSource);
  }
});
