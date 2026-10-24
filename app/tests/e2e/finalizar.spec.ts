import { test, expect, openQuickActions, roomBody } from './fixtures';
import type { Match } from '../../src/features/rooms/roomsApi';

for (const count of [1, 3]) {
  test(`finalizar com confirmação e metade da sala (${count} jogadores)`, async ({ page, browser, baseURL }, info) => {

    test.setTimeout(60_000);
    const contexts = [];
    const pages = [page];
    try {
      for (let index = 1; index < count; index++) {
        const context = await browser.newContext({ baseURL, viewport: info.project.use.viewport, isMobile: info.project.use.isMobile, hasTouch: info.project.use.hasTouch });
        contexts.push(context);
        pages.push(await context.newPage());
      }
      let roomId = 0;
      for (const [index, current] of pages.entries()) {
        const api = current.request;
        expect((await api.post('/api/session', { data: { login: ['amigo', 'segundo', 'amigo3'][index], password: 'senha-do-navegador' } })).ok()).toBe(true);
        const upload = await api.post('/api/decks', { multipart: { file: { name: 'finalizar.cod', mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck><zone name="main"><card number="6" name="Island"/></zone></cockatrice_deck>') } } });
        expect(upload.status()).toBe(201);
        const { deck } = await upload.json();
        if (!roomId) roomId = (await (await api.post('/api/rooms', { data: roomBody() })).json()).room.id;
        else expect((await api.post(`/api/rooms/${roomId}/participants`, { data: {} })).ok()).toBe(true);
        expect((await api.put(`/api/rooms/${roomId}/participants/me/ready`, { data: { deckId: deck.id } })).ok()).toBe(true);
      }
      expect((await page.request.post(`/api/rooms/${roomId}/start`, { data: {} })).status()).toBe(201);
      const read = async (): Promise<Match> => (await (await page.request.get(`/api/rooms/${roomId}/match`)).json()).match;
      await Promise.all(pages.map(current => current.goto(`/#/salas/${roomId}`)));
      const proposer = pages.at(-1)!;
      const button = proposer.getByRole('button', { name: /^Finalizar/ });
      const modal = proposer.getByRole('dialog', { name: 'Finalizar partida?', exact: true });
      await expect(button).toBeVisible();
      const finishBox = await button.boundingBox();
      expect(finishBox!.x).toBeGreaterThanOrEqual(0);
      expect(finishBox!.x + finishBox!.width).toBeLessThanOrEqual(info.project.use.viewport!.width);
      const backs = page.locator('.library-stack img');
      if (info.project.name === 'desktop' && count > 2) await page.getByRole('button', { name: 'Ampliar mesa de Amigo da mesa', exact: true }).click();
      await expect.poll(() => backs.first().evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
      const image = await backs.nth(2).boundingBox();
      expect(image!.height / image!.width).toBeGreaterThan(1.3);
      await page.screenshot({ path: info.outputPath('grimorio-e-finalizar.png'), fullPage: true });
      await button.click();
      await expect(modal).toBeVisible();
      await expect(modal.getByRole('button', { name: 'Cancelar', exact: true })).toBeFocused();
      await modal.getByRole('button', { name: 'Cancelar', exact: true }).click();
      expect((await read()).finishVotes).toHaveLength(0);
      await button.click();
      await proposer.keyboard.press('Escape');
      await expect(modal).toHaveCount(0);
      expect((await read()).finished).toBe(false);
      await button.click();
      await modal.getByRole('button', { name: 'Concordar e finalizar', exact: true }).click();
      if (count === 3) {
        await expect(button).toHaveText('Finalizar (1/2)');
        await expect(page.getByRole('status').filter({ hasText: 'Encerramento solicitado' })).toBeVisible();
        await proposer.reload();
        await expect(button).toHaveText('Finalizar (1/2)');
        await button.click();
        await expect(modal).toContainText('Você já concordou');
        await modal.getByRole('button', { name: 'Voltar à partida', exact: true }).click();
        // Disconnection does not shrink the threshold or undo the saved vote.
        await proposer.close();
        const pending = await read();
        expect(pending.finishRequired).toBe(2);
        expect(pending.finishVotes).toHaveLength(1);
        await openQuickActions(page);
        await page.getByRole('button', { name: 'Comprar', exact: true }).click();
        await expect.poll(async () => (await read()).players.find(p => p.userId === pending.viewerId)!.handCount).toBe(1);
        await expect(page.getByText('Uma carta comprada.', { exact: true })).toHaveCount(0);
        await page.getByRole('button', { name: /^Finalizar/ }).click();
        const confirmation = page.getByRole('dialog', { name: 'Finalizar partida?', exact: true });
        await confirmation.getByRole('button', { name: 'Concordar e finalizar', exact: true }).click();
      }
      for (const current of pages.filter(current => !current.isClosed())) {
        await expect(current).toHaveURL(/\/#\/salas$/);
        await expect(current.getByRole('heading', { name: 'Lobby', exact: true })).toBeVisible();
        await expect(current.getByRole('heading', { name: `Sala #${roomId}`, exact: true })).toHaveCount(0);
      }
      expect((await read()).finished).toBe(true);
      await page.goto(`/#/salas/${roomId}`);
      await expect(page).toHaveURL(/\/#\/salas$/);
    } finally { await Promise.all(contexts.map(context => context.close())); }
  });
}
