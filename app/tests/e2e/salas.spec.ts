import { test, expect } from './fixtures';
import type { Locator } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('preserva deck ao criar sala, acompanhar participação e recarregar', async ({ page, browser, baseURL }, testInfo) => {
  const activate = async (button: Locator) => testInfo.project.use.hasTouch ? button.tap() : button.click();
  await page.goto('/');
  await page.getByLabel('Login', { exact: true }).fill('amigo');
  await page.getByLabel('Senha', { exact: true }).fill('senha-do-navegador');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Salas', exact: true })).toBeVisible();
  await page.getByLabel('Arquivo .cod').setInputFiles({ name: 'amigos.cod', mimeType: 'application/xml', buffer: readFileSync(resolve('../api/tests/integration/testdata/cockatrice-deck.cod')) });
  await page.getByRole('button', { name: 'Importar deck', exact: true }).click();
  await expect(page.getByText('5 × Island', { exact: true })).toBeVisible();
  const rooms = page.getByRole('region', { name: 'Salas', exact: true });
  const viewer = await browser.newContext({ baseURL, viewport: testInfo.project.use.viewport, isMobile: testInfo.project.use.isMobile, hasTouch: testInfo.project.use.hasTouch });
  try {
    const other = await viewer.newPage();
    await other.goto('/');
    await other.getByLabel('Login', { exact: true }).fill('segundo');
    await other.getByLabel('Senha', { exact: true }).fill('senha-do-navegador');
    await other.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(other.getByRole('heading', { name: 'Salas', exact: true })).toBeVisible();
    const before = await rooms.getByRole('article').count();
    await activate(page.getByRole('button', { name: 'Criar sala', exact: true }));
    await expect(rooms.getByRole('article')).toHaveCount(before + 1);
    const title = await rooms.getByRole('article').last().getByRole('heading').innerText();
    const mine = rooms.getByRole('article').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
    const theirs = other.getByRole('article').filter({ has: other.getByRole('heading', { name: title, exact: true }) });
    await expect(theirs.getByText('5 vagas disponíveis')).toBeVisible();
    await activate(theirs.getByRole('button', { name: 'Entrar na sala', exact: true }));
    await expect(mine.getByText('Segundo amigo')).toBeVisible();
    await expect(mine.getByText('4 vagas disponíveis')).toBeVisible();
    await expect(theirs.getByText('Você participa desta sala.')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('salas.png'), fullPage: true });
    await page.reload();
    await expect(rooms.getByRole('article').filter({ has: page.getByRole('heading', { name: title, exact: true }) }).getByText('Você participa desta sala.')).toBeVisible();
    await page.getByLabel('Escolher deck salvo').selectOption({ label: 'Amigos & mágicas (7 cartas)' });
    await expect(page.getByText('5 × Island', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Excluir deck', exact: true }).click();
    await expect(page.getByText('Nenhum deck salvo. Importe seu primeiro arquivo.')).toBeVisible();
    await page.getByRole('button', { name: 'Sair', exact: true }).click();
    await expect(page.getByLabel('Login', { exact: true })).toBeVisible();
  } finally { await viewer.close(); }
});

test('prepara e inicia uma mesa com um participante', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Login', { exact: true }).fill('amigo');
  await page.getByLabel('Senha', { exact: true }).fill('senha-do-navegador');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.getByLabel('Arquivo .cod').setInputFiles({ name: 'amigos.cod', mimeType: 'application/xml', buffer: readFileSync(resolve('../api/tests/integration/testdata/cockatrice-deck.cod')) });
  await page.getByRole('button', { name: 'Importar deck', exact: true }).click();
  await page.getByRole('button', { name: 'Criar sala', exact: true }).click();
  const room = page.getByRole('article').filter({ has: page.getByText('Em preparação', { exact: true }) });
  await room.getByLabel('Deck para a partida').selectOption({ label: 'Amigos & mágicas' });
  await room.getByRole('button', { name: 'Confirmar deck', exact: true }).click();
  await expect(room.getByText('Pronto', { exact: false })).toBeVisible();
  await room.getByRole('button', { name: 'Iniciar partida', exact: true }).click();
  const board = page.getByRole('region', { name: 'Mesa da partida', exact: true });
  await expect(board).toBeVisible();
  await expect(board.getByText('Vida: 40', { exact: true })).toBeVisible();
  await expect(board.getByLabel('Zonas de Amigo da mesa')).toContainText('Grimório');
  await expect(board.getByLabel('Zonas de Amigo da mesa')).toContainText('Campo');
});
