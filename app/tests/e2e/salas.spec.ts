import { test, expect } from './fixtures';
import type { Locator } from '@playwright/test';

test('cria sala, acompanha participação e mantém lugar ao recarregar', async ({ page, browser, baseURL }, testInfo) => {
  const activate = async (button: Locator) => testInfo.project.use.hasTouch ? button.tap() : button.click();
  await page.goto('/');
  await page.getByLabel('Login', { exact: true }).fill('amigo');
  await page.getByLabel('Senha', { exact: true }).fill('senha-do-navegador');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Salas', exact: true })).toBeVisible();
  const viewer = await browser.newContext({ baseURL, viewport: testInfo.project.use.viewport, isMobile: testInfo.project.use.isMobile, hasTouch: testInfo.project.use.hasTouch });
  try {
    const other = await viewer.newPage();
    await other.goto('/');
    await other.getByLabel('Login', { exact: true }).fill('segundo');
    await other.getByLabel('Senha', { exact: true }).fill('senha-do-navegador');
    await other.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(other.getByRole('heading', { name: 'Salas', exact: true })).toBeVisible();
    const before = await page.getByRole('article').count();
    await activate(page.getByRole('button', { name: 'Criar sala', exact: true }));
    await expect(page.getByRole('article')).toHaveCount(before + 1);
    const title = await page.getByRole('article').last().getByRole('heading').innerText();
    const mine = page.getByRole('article').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
    const theirs = other.getByRole('article').filter({ has: other.getByRole('heading', { name: title, exact: true }) });
    await expect(theirs.getByText('5 vagas disponíveis')).toBeVisible();
    await activate(theirs.getByRole('button', { name: 'Entrar na sala', exact: true }));
    await expect(mine.getByText('Segundo amigo')).toBeVisible();
    await expect(mine.getByText('4 vagas disponíveis')).toBeVisible();
    await expect(theirs.getByText('Você participa desta sala.')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('salas.png'), fullPage: true });
    await page.reload();
    await expect(page.getByRole('article').filter({ has: page.getByRole('heading', { name: title, exact: true }) }).getByText('Você participa desta sala.')).toBeVisible();
    await page.getByRole('button', { name: 'Sair', exact: true }).click();
    await expect(page.getByLabel('Login', { exact: true })).toBeVisible();
  } finally { await viewer.close(); }
});
