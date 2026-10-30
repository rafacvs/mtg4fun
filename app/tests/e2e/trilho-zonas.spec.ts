import { test, expect, roomBody } from './fixtures';
import type { BrowserContext } from '@playwright/test';

for (const count of [2, 3, 4]) {
  test(`trilhos legíveis para ${count} jogadores`, async ({ browser, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop');
    test.setTimeout(90_000);
    const contexts: BrowserContext[] = [];
    try {
      let room = 0;
      for (const login of ['amigo', 'segundo', 'amigo3', 'amigo4'].slice(0, count)) {
        const context = await browser.newContext({ baseURL }); contexts.push(context);
        const api = context.request;
        expect((await api.post('/api/session', { data: { login, password: 'senha-do-navegador' } })).ok()).toBeTruthy();
        const { deck } = await (await api.post('/api/decks', { multipart: { file: { name: 'deck.cod', mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck><zone name="main"><card number="8" name="Island"/></zone></cockatrice_deck>') } } })).json();
        if (!room) room = (await (await api.post('/api/rooms', { data: roomBody() })).json()).room.id;
        else expect((await api.post(`/api/rooms/${room}/participants`, { data: {} })).ok()).toBeTruthy();
        expect((await api.put(`/api/rooms/${room}/participants/me/ready`, { data: { deckId: deck.id } })).ok()).toBeTruthy();
      }
      expect((await contexts[0].request.post(`/api/rooms/${room}/start`, { data: {} })).ok()).toBeTruthy();
      expect((await contexts[0].request.post(`/api/rooms/${room}/match/actions`, { data: { kind: 'turn', direction: 'next', intentId: crypto.randomUUID() } })).ok()).toBeTruthy();
      const page = await contexts[0].newPage();
      for (const size of [{ width: 1782, height: 996 }, { width: 1312, height: 825 }, { width: 1100, height: 700 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
        await page.setViewportSize(size); await page.goto(`/#/salas/${room}`);
        const tables = page.getByRole('article', { name: /Mesa de/ }); await expect(tables).toHaveCount(size.width > 1000 ? count : 1);
        for (const table of await tables.all()) {
          if (!await table.isVisible()) continue;
          for (const zone of ['.library-pile', '.zone-graveyard', '.zone-exile']) {
          const slot = table.locator(zone); const icon = slot.locator('.zone-emblem'); const number = slot.locator('.zone-count'); const label = slot.locator('.slot-label');
          await expect(icon).toBeVisible(); await expect(number).toBeVisible(); await expect(label).toBeVisible();
          const [box, i, n, l] = await Promise.all([slot.boundingBox(), icon.boundingBox(), number.boundingBox(), label.boundingBox()]);
          expect(i!.x).toBeGreaterThanOrEqual(box!.x); expect(i!.x + i!.width).toBeLessThanOrEqual(n!.x + 1);
          expect(n!.x + n!.width).toBeLessThanOrEqual(box!.x + box!.width + 1);
          expect(n!.x + n!.width / 2).toBeGreaterThan(box!.x + box!.width / 2);
          expect(l!.y).toBeGreaterThanOrEqual(i!.y + i!.height - 1);
          expect(l!.y + l!.height).toBeLessThanOrEqual(box!.y + box!.height + 1);
        }
        }
        await expect(page.locator('.table-toolbar')).toHaveCount(0);
        if (size.width > 1000) {
          const fields = (await page.locator('.desktop-fields').boundingBox())!;
          expect(Math.abs(fields.x + fields.width - size.width)).toBeLessThanOrEqual(1);
          for (const table of await tables.all()) {
            const button = (await table.locator('.field-focus').boundingBox())!;
            const seat = (await table.locator('.seat-name').boundingBox())!;
            const canvas = (await table.locator('.battlefield-scroll').boundingBox())!;
            expect(button.width).toBe(28);
            expect(button.height).toBe(28);
            expect(seat.y + seat.height).toBeLessThan(canvas.y);
          }
          await expect(page.getByRole('button', { name: 'Abrir crônica' })).toBeVisible();
          const dock = await page.locator('.own-dock').boundingBox();
          const turn = await page.getByRole('group', { name: 'Turno', exact: true }).boundingBox();
          const draw = await page.getByRole('navigation', { name: 'Ações rápidas' }).getByRole('button', { name: 'Comprar', exact: true }).boundingBox();
          expect(dock!.height).toBe(68);
          expect(turn!.height).toBe(draw!.height);
        }
        await page.screenshot({ path: testInfo.outputPath(`mesa-${count}-${size.width}.png`) });
        if (count === 4 && (size.width === 1312 || size.width === 390)) {
          if (size.width <= 1000) await page.getByRole('button', { name: 'Comandos', exact: true }).click();
          const actions = page.getByRole('navigation', { name: 'Ações rápidas' });
          await expect(actions.getByRole('button', { name: 'Desvirar', exact: true })).toBeVisible();
          await actions.getByRole('button', { name: 'Ações', exact: true }).click();
          const menu = page.getByRole('dialog', { name: 'Ações do jogo' });
          expect((await menu.boundingBox())!.width).toBeLessThanOrEqual(420);
          await expect(menu.getByRole('link', { name: 'Lobby', exact: true })).toHaveAttribute('href', '/#/salas');
          await expect(menu.locator('.panel-result')).toHaveCount(0);
          await page.screenshot({ path: testInfo.outputPath(`acoes-${size.width}.png`), animations: 'disabled' });
          await expect(menu.getByLabel('Ordem de turnos')).toBeVisible();
          expect(await menu.getByRole('region', { name: 'Turno', exact: true }).evaluate(node => node.parentElement?.firstElementChild === node)).toBe(true);
          await expect(menu.getByRole('button', { name: 'Finalizar', exact: true }).locator('svg')).toBeVisible();
          const lobbyBox = await menu.getByRole('link', { name: 'Lobby', exact: true }).boundingBox();
          const finishBox = await menu.getByRole('button', { name: 'Finalizar', exact: true }).boundingBox();
          expect(lobbyBox!.y).toBe(finishBox!.y);
          expect(lobbyBox!.x + lobbyBox!.width).toBeLessThanOrEqual(finishBox!.x);
          await menu.getByRole('button', { name: 'Finalizar', exact: true }).click();
          await expect(page.getByRole('dialog', { name: 'Finalizar partida?' })).toBeVisible();
          await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
          await menu.getByRole('button', { name: 'Fechar ações' }).click();
          if (size.width <= 1000) await page.getByRole('button', { name: 'Comandos', exact: true }).click();
          await page.getByRole('button', { name: 'Abrir crônica', exact: true }).click();
          await expect(page.locator('#log-panel-content')).toBeVisible();
          if (size.width > 1000) await page.getByRole('button', { name: 'Fechar crônica', exact: true }).click();
        }
      }
    } finally { for (const context of contexts) await context.close(); }
  });
}
