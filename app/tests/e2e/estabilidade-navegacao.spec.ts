import { chromium } from '@playwright/test';
import { test, expect, roomBody } from './fixtures';

test('alternar entre lobby rolável e biblioteca mantém o cabeçalho na mesma posição', async ({ baseURL }) => {
  const browser = await chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'] });
  const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 1000 } });
  try {
    const page = await context.newPage();
    expect((await page.request.post('/api/session', { data: { login: 'amigo', password: 'senha-do-navegador' } })).ok()).toBe(true);
    for (let index = 0; index < 5; index++) {
      expect((await page.request.post('/api/rooms', { data: roomBody({ name: `Mesa ${index + 1}` }) })).ok()).toBe(true);
    }
    await page.goto('/#/salas');
    await expect(page.getByRole('article', { name: 'Mesa 5' })).toBeVisible();
    const measure = () => page.evaluate(() => ({
      left: document.querySelector('.app-header')!.getBoundingClientRect().left,
      width: document.body.getBoundingClientRect().width,
      scrolls: document.documentElement.scrollHeight > document.documentElement.clientHeight,
    }));
    const lobby = await measure();
    expect(lobby.scrolls).toBe(true);
    await page.getByRole('link', { name: 'Meus decks' }).click();
    await expect(page.getByRole('heading', { name: 'Sua biblioteca começa aqui.' })).toBeVisible();
    const decks = await measure();
    expect(decks.scrolls).toBe(false);
    expect(decks.width).toBe(lobby.width);
    expect(decks.left).toBe(lobby.left);
    await page.getByRole('link', { name: 'Salas', exact: true }).click();
    expect((await measure()).left).toBe(lobby.left);
  } finally {
    await context.close();
    await browser.close();
  }
});
