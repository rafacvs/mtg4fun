import { test, expect } from './fixtures';

test('esferas de mana renderizam e animam sem impedir entrar e sair', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const scene = page.locator('.mana-orbs');
  const canvas = scene.locator('canvas');
  await expect(scene).toHaveClass(/is-ready/, { timeout: 15_000 });
  const first = await canvas.screenshot();
  await page.waitForTimeout(350);
  const next = await canvas.screenshot();
  expect(first.equals(next)).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('login-com-esferas.png'), fullPage: true });
  await page.getByLabel('Login', { exact: true }).fill('amigo');
  await page.getByLabel('Senha', { exact: true }).fill('senha-do-navegador');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Lobby', exact: true })).toBeVisible();
  await expect(canvas).toHaveCount(0);
  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  await expect(scene).toHaveClass(/is-ready/, { timeout: 15_000 });
  expect(errors).toEqual([]);
});

test('preferência por movimento reduzido mantém as esferas estáticas', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const scene = page.locator('.mana-orbs');
  await expect(scene).toHaveClass(/is-ready/, { timeout: 15_000 });
  const canvas = scene.locator('canvas');
  const first = await canvas.screenshot();
  await page.waitForTimeout(350);
  expect(first.equals(await canvas.screenshot())).toBe(true);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForTimeout(350);
  expect(first.equals(await canvas.screenshot())).toBe(false);
});

test('login continua funcionando sem WebGL', async ({ page }, info) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value: function(this: HTMLCanvasElement, type: string, ...options: unknown[]) {
        return type === 'webgl2' ? null : Reflect.apply(original, this, [type, ...options]);
      },
    });
  });
  await page.goto('/');
  await expect(page.locator('.mana-orbs-fallback')).toBeVisible();
  await expect(page.locator('.mana-orbs-fallback span')).toHaveCount(5);
  await page.screenshot({ path: info.outputPath('login-sem-webgl.png'), fullPage: true });
  await page.getByLabel('Login', { exact: true }).fill('amigo');
  await page.getByLabel('Senha', { exact: true }).fill('senha-do-navegador');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Lobby', exact: true })).toBeVisible();
});
