import { test, expect, openQuickActions, openHand, roomBody } from './fixtures';

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

test('entrada usa a tipografia da mesa e o fundo noturno aprovado', async ({ page }) => {
  await page.goto('/');
  const title = page.getByRole('heading', { name: /Toda boa partida/ });
  await expect(title).toHaveCSS('font-family', /Cinzel/);
  await expect(page.getByLabel('Login', { exact: true })).toHaveCSS('font-family', /Geist/);
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(11, 14, 16)');
  const loaded = await page.evaluate(async () => {
    const faces = await Promise.all([
      document.fonts.load('700 24px Cinzel', 'Toda boa partida'),
      document.fonts.load('400 16px Geist', 'Login e senha'),
    ]);
    return faces.map(fonts => fonts.some(font => font.status === 'loaded'));
  });
  expect(loaded).toEqual([true, true]);
});

test('depois de entrar, reabre uma partida iniciada e compra uma carta', async ({ page }) => {
  const api = page.request;
  expect((await api.post('/api/session', { data: { login: 'amigo', password: 'senha-do-navegador' } })).ok()).toBe(true);
  const upload = await api.post('/api/decks', { multipart: { file: { name: 'login.cod', mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck version="1"><deckname>Login</deckname><zone name="main"><card number="2" name="Island"/></zone></cockatrice_deck>') } } });
  expect(upload.status()).toBe(201);
  const { deck } = await upload.json();
  const { room } = await (await api.post('/api/rooms', { data: roomBody() })).json();
  expect((await api.put(`/api/rooms/${room.id}/participants/me/ready`, { data: { deckId: deck.id } })).ok()).toBe(true);
  expect((await api.post(`/api/rooms/${room.id}/start`, { data: {} })).status()).toBe(201);
  expect((await api.delete('/api/session')).status()).toBe(204);
  await page.goto('/');
  await page.getByLabel('Login', { exact: true }).fill('amigo');
  await page.getByLabel('Senha', { exact: true }).fill('senha-do-navegador');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Lobby', exact: true })).toBeVisible();
  await page.goto(`/#/salas/${room.id}`);
  await openQuickActions(page);
  await page.getByRole('button', { name: 'Comprar', exact: true }).click();
  await openHand(page);
  await expect(page.getByRole('region', { name: 'Mão', exact: true }).getByRole('button', { name: 'Island', exact: true })).toBeVisible();
  await page.reload();
  await openHand(page);
  await expect(page.getByRole('region', { name: 'Mão', exact: true }).getByRole('button', { name: 'Island', exact: true })).toBeVisible();
});
