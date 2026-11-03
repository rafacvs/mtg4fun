import { test, expect, roomBody } from './fixtures';
import type { Page } from '@playwright/test';

async function hit(page: Page, arcIndex = 1, input: 'dial' | 'button' | 'space' = 'dial') {
  const before = await page.locator('.arm-me .arm-hits').getAttribute('aria-label');
  // Observe the actual rendered needle crossing the middle of the colored arc.
  await page.waitForFunction(({ index, input }) => {
    const dial = document.querySelector<HTMLButtonElement>('.arm-me .arm-dial');
    const needle = dial?.querySelector('line')?.getAttribute('transform')?.match(/rotate\(([-\d.]+)\)/);
    const arcs = dial?.querySelectorAll('path');
    if (!dial || dial.disabled || !needle || !arcs?.length) return false;
    const path = arcs.length > index ? arcs[index] : arcs[0];
    const numbers = path.getAttribute('d')!.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
    const start = (Math.atan2(numbers[1], numbers[0]) * 180 / Math.PI + 360) % 360;
    const end = (Math.atan2(numbers.at(-1)!, numbers.at(-2)!) * 180 / Math.PI + 360) % 360;
    const width = (end - start + 360) % 360;
    const delta = (Number(needle[1]) - start + 360) % 360;
    if (delta > width * .1 && delta < width * .6) {
      if (input === 'button') document.querySelector<HTMLButtonElement>('.arm-screen .duel-primary')!.click();
      else if (input === 'space') {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
      } else dial.click();
      return true;
    }
    return false;
  }, { index: arcIndex, input }, { polling: 5, timeout: 15000 });
  await expect(page.locator('.arm-me .arm-hits')).not.toHaveAttribute('aria-label', before!, { timeout: 2000 });
}

async function preparePair(page: Page, guest: Page) {
  for (const [client, login] of [[page, 'amigo'], [guest, 'segundo']] as const) expect((await client.request.post('/api/session', { data: { login, password: 'senha-do-navegador' } })).ok()).toBe(true);
  const { room } = await (await page.request.post('/api/rooms', { data: roomBody({ seats: 2 }) })).json();
  expect((await guest.request.post(`/api/rooms/${room.id}/participants`, { data: {} })).ok()).toBe(true);
  for (const client of [page, guest]) { await client.goto(`/#/salas/${room.id}`); await expect(client.getByRole('button', { name: /^Rolar d20$/ })).toBeVisible(); }
}

test('queda de braço: menu, convite, dois relógios, acertos, F5 e desistência', async ({ page, browser, baseURL }, info) => {
  test.setTimeout(90000);
  const context = await browser.newContext({ baseURL: baseURL!, viewport: page.viewportSize() ?? undefined, isMobile: info.project.use.isMobile, hasTouch: info.project.use.hasTouch });
  const guest = await context.newPage();
  try {
    await preparePair(page, guest);
    await page.getByRole('button', { name: 'Desafiar Segundo amigo para um X1' }).click();
    const menu = page.getByRole('dialog', { name: 'Desafiar Segundo amigo' });
    await expect(menu.getByRole('button', { name: /Cara ou coroa/ })).toBeVisible();
    const option = menu.getByRole('button', { name: /Queda de braço/ });
    await expect(option.locator('img')).toBeVisible();
    await page.screenshot({ path: info.outputPath('menu.png') });
    await option.click();
    await expect(guest.getByRole('dialog', { name: 'Convite para um X1' })).toContainText('queda de braço');
    await guest.getByRole('button', { name: 'Aceitar', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Queda de braço contra Segundo amigo' })).toBeVisible();
    await page.getByRole('button', { name: 'Começar', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Aguardando adversário', exact: true })).toBeDisabled();
    await guest.getByRole('button', { name: 'Começar', exact: true }).click();
    await hit(page);
    await expect(guest.locator('.arm-foe .arm-hits')).toHaveAttribute('aria-label', '1 de 5 tentativas');
    await page.reload();
    await expect(page.locator('.arm-me .arm-hits')).toHaveAttribute('aria-label', '1 de 5 tentativas');
    await page.screenshot({ path: info.outputPath('queda-de-braco.png') });
    // Every click consumes an attempt, even outside a colored zone.
    for (let i = 1; i < 5; i++) {
      await page.getByRole('button', { name: 'ACERTAR!', exact: true }).click();
      await expect(page.locator('.arm-me .arm-hits')).toHaveAttribute('aria-label', `${i + 1} de 5 tentativas`);
    }
    const needle = page.locator('.arm-me .arm-dial line');
    const stopped = await needle.getAttribute('transform');
    await page.waitForTimeout(500);
    await expect(needle).toHaveAttribute('transform', stopped!);
    // The other player never clicks: five full revolutions must finish their turn.
    await expect(page.locator('.duel-banner')).toContainText('venceu a queda de braço', { timeout: 20000 });
    await page.getByRole('button', { name: 'Desafiar Segundo amigo para um X1' }).click();
    await page.getByRole('button', { name: /Queda de braço/ }).click();
    await guest.getByRole('button', { name: 'Aceitar', exact: true }).click();
    await guest.getByRole('button', { name: 'Arregar (conta como derrota)' }).click();
    await expect(page.locator('.duel-banner')).toContainText('Queda de braço');
    await expect(page.locator('.dice-register-duel').last()).toContainText('Queda de braço');
    await expect(page.getByRole('dialog', { name: /Queda de braço contra/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Rolar d20$/ })).toBeVisible();
  } finally { await context.close(); }
});

for (const condition of [{ name: 'condições normais', offset: 0, lag: 0 }, { name: 'somente atraso de rede', offset: 0, lag: 120 }, { name: 'relógio diferente e atraso de rede', offset: 1000, lag: 120 }]) {
  test(`queda de braço: convidado pontua a zona exibida em ${condition.name}`, async ({ page, browser, baseURL }, info) => {
    test.setTimeout(60_000);
    const context = await browser.newContext({ baseURL, viewport: page.viewportSize() ?? undefined, isMobile: info.project.use.isMobile, hasTouch: info.project.use.hasTouch });
    await context.addInitScript(offset => {
      const original = Date.now;
      Date.now = () => original() + offset;
    }, condition.offset);
    const guest = await context.newPage();
    await guest.routeWebSocket('**/api/rooms/*/live', client => {
      const server = client.connectToServer();
      client.onMessage(message => { setTimeout(() => server.send(message), condition.lag); });
      server.onMessage(message => { setTimeout(() => client.send(message), condition.lag); });
    });
    try {
      await preparePair(page, guest);
      await page.getByRole('button', { name: 'Desafiar Segundo amigo para um X1' }).click();
      await page.getByRole('button', { name: /Queda de braço/ }).click();
      await guest.getByRole('button', { name: 'Aceitar', exact: true }).click();
      await page.getByRole('button', { name: 'Começar', exact: true }).click();
      await guest.getByRole('button', { name: 'Começar', exact: true }).click();
      await expect(page.getByRole('button', { name: 'ACERTAR!', exact: true })).toBeEnabled();
      await Promise.all([hit(guest, 3), hit(page, 3)]);
      // A painted red hit is six points, not merely a consumed attempt.
      await expect(guest.locator('.arm-me > p')).toContainText('6 pontos');
      await expect(page.locator('.arm-me > p')).toContainText('6 pontos');
      await expect(page.locator('.arm-foe > p')).toContainText('6 pontos');
      await guest.reload();
      await expect(guest.locator('.arm-me > p')).toContainText('6 pontos');
      // Changing the device clock mid-game must not change the needle's clock.
      if (condition.offset) await guest.evaluate(() => { const original = Date.now; Date.now = () => original() - 120_000; });
      await hit(guest, 3);
      await expect(guest.locator('.arm-me > p')).toContainText('12 pontos');
      await guest.getByRole('button', { name: 'Arregar (conta como derrota)' }).click();
      await expect(page.locator('.duel-banner')).toContainText('Queda de braço');
    } finally { await context.close(); }
  });

}

for (const input of ['dial', 'button', 'space'] as const) {
  test(`queda de braço: todos os socos dos dois jogadores com ${input} e convite invertido`, async ({ page, browser, baseURL }) => {
    test.setTimeout(60_000);
    const context = await browser.newContext({ baseURL });
    const guest = await context.newPage();
    try {
      await preparePair(page, guest);
      for (const [zone, points] of [12, 2, 3, 6].entries()) {
        // A fresh duel per color avoids automatic misses completing a round
        // while the test switches between the two independent clocks.
        await guest.getByRole('button', { name: 'Desafiar Amigo da mesa para um X1' }).click();
        await guest.getByRole('button', { name: /Queda de braço/ }).click();
        await page.getByRole('button', { name: 'Aceitar', exact: true }).click();
        await page.getByRole('button', { name: 'Começar', exact: true }).click();
        await guest.getByRole('button', { name: 'Começar', exact: true }).click();
        await Promise.all([hit(page, zone, input), hit(guest, zone, input)]);
        for (const client of [page, guest]) {
          await expect(client.locator('.arm-me > p')).toContainText(`${points} pontos`);
          await expect(client.locator('.arm-foe > p')).toContainText(`${points} pontos`);
          await expect(client.locator('.duel-error')).toHaveCount(0);
        }
        await guest.getByRole('button', { name: 'Arregar (conta como derrota)' }).click();
        for (const client of [page, guest]) await expect(client.getByRole('dialog', { name: /Queda de braço contra/ })).toHaveCount(0);
      }
    } finally { await context.close(); }
  });
}
