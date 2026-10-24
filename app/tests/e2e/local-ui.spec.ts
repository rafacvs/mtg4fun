import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';

const login = process.env.LOCAL_UI_LOGIN;
const password = process.env.LOCAL_UI_PASSWORD;

test.skip(!login || !password || !process.env.E2E_BASE_URL, 'Validação manual no servidor local.');

for (const viewport of [
  { name: 'celular', width: 390, height: 844 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'desktop', width: 1440, height: 900 },
]) {
  test(`lobby, decks e preview no ${viewport.name}`, async ({ browser }, testInfo) => {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, baseURL: process.env.E2E_BASE_URL });
    const page = await context.newPage();
    try {
      await page.goto('/');
      await page.getByLabel('Login', { exact: true }).fill(login!);
      await page.getByLabel('Senha', { exact: true }).fill(password!);
      await page.getByRole('button', { name: 'Entrar', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Lobby' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Salas', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Criar sala' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Meus decks' })).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`${viewport.name}-lobby.png`), fullPage: true });

      await page.getByRole('link', { name: 'Meus decks' }).click();
      await expect(page).toHaveURL(/#\/decks$/);
      await expect(page.getByRole('heading', { name: 'Seus decks, em um só lugar.' })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`${viewport.name}-decks.png`), fullPage: true });

      await page.getByLabel('Arquivo .cod').setInputFiles(resolve('../api/tests/integration/testdata/decks/deck_hydra.cod'));
      await page.getByRole('button', { name: 'Importar deck' }).click();
      await expect(page.getByRole('button', { name: 'Excluir deck' })).toBeVisible();
      const options = page.getByRole('button', { name: /^Consultar / });
      await expect(options.first()).toBeVisible();
      await options.first().click();
      await expect(page.getByRole('button', { name: 'Fechar consulta' })).toBeVisible();
      await expect(page.locator('.deck-preview')).toBeVisible();
      const listSize = await page.locator('.deck-card-list ul').evaluate(element => ({ visible: element.clientHeight, content: element.scrollHeight }));
      expect(listSize.content).toBeGreaterThan(listSize.visible);
      expect(listSize.visible).toBeLessThanOrEqual(viewport.width < 760 ? 270 : 540);
      const preview = await page.locator('.deck-preview').boundingBox();
      expect(preview).not.toBeNull();
      expect(preview!.y).toBeLessThan(viewport.height * 1.5);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`${viewport.name}-preview.png`), fullPage: true });
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Meus decks', exact: true })).toBeVisible();
      await page.getByLabel('Escolher deck salvo').selectOption({ index: 1 });
      await expect(page.getByRole('button', { name: /^Consultar / }).first()).toBeVisible();
      await page.getByRole('button', { name: 'Excluir deck' }).click();
      await page.getByRole('dialog', { name: 'Excluir deck?' }).getByRole('button', { name: 'Confirmar exclusão' }).click();
      await page.getByRole('link', { name: 'Salas' }).click();
      await expect(page.getByRole('heading', { name: 'Lobby' })).toBeVisible();
      await expect(page).toHaveURL(/#\/salas$/);
    } finally {
      await context.close();
    }
  });
}
