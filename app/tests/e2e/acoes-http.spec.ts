import type { Match } from '../../src/features/rooms/roomsApi';
import { test, expect, closeQuickActions, openGameActions, openHand, openLibrary, openQuickActions, returnOpeningHandToLibrary, roomBody } from './fixtures';

// Resolve a non-loopback origin to the real test server. Chromium must expose
// the same restricted Web Crypto API as public HTTP, without mocking crypto.
test.use({ launchOptions: { args: ['--host-resolver-rules=MAP mtg4fun.test 127.0.0.1', '--no-proxy-server'] } });

for (const remoteHTTP of [false, true]) {
  test(`ações e reenvios com ${remoteHTTP ? 'HTTP remoto sem randomUUID' : 'randomUUID nativo'}`, async ({ page, context, browser, baseURL }) => {
    test.setTimeout(60_000);
    const opponent = await browser.newContext({ baseURL });
    try {
      let roomId = 0;
      const decks: { api: typeof page.request; id: number }[] = [];
      for (const [index, api] of [page.request, opponent.request].entries()) {
        expect((await api.post('/api/session', { data: { login: index ? 'segundo' : 'amigo', password: 'senha-do-navegador' } })).ok()).toBe(true);
        const uploaded = await api.post('/api/decks', { multipart: { file: { name: 'http.cod', mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck><zone name="main"><card number="20" name="Island"/></zone></cockatrice_deck>') } } });
        expect(uploaded.status()).toBe(201);
        const { deck } = await uploaded.json();
        if (!roomId) roomId = (await (await api.post('/api/rooms', { data: roomBody() })).json()).room.id;
        else expect((await api.post(`/api/rooms/${roomId}/participants`, { data: {} })).ok()).toBe(true);
        expect((await api.put(`/api/rooms/${roomId}/participants/me/ready`, { data: { deckId: deck.id } })).ok()).toBe(true);
        decks.push({ api, id: deck.id });
      }
      expect((await page.request.post(`/api/rooms/${roomId}/start`, { data: {} })).status()).toBe(201);
      for (const { api } of decks) await returnOpeningHandToLibrary(api, roomId);
      for (const { api, id } of decks) expect((await api.delete(`/api/decks/${id}`)).status()).toBe(204);

      const origin = new URL(baseURL!);
      if (remoteHTTP) {
        origin.hostname = 'mtg4fun.test';
        const cookies = await context.cookies(baseURL!);
        await context.addCookies(cookies.map(({ domain, path, ...cookie }) => ({ ...cookie, url: origin.origin })));
      }
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      const sent: { kind: string; intentId: string }[] = [];
      page.on('request', request => {
        if (request.method() === 'POST' && request.url().endsWith('/match/actions')) sent.push(request.postDataJSON());
      });
      await page.goto(`${origin.origin}/#/salas/${roomId}`);
      expect(await page.evaluate(() => window.isSecureContext)).toBe(!remoteHTTP);
      expect(await page.evaluate(() => typeof crypto.randomUUID)).toBe(remoteHTTP ? 'undefined' : 'function');
      const read = async (): Promise<Match> => (await (await page.request.get(`/api/rooms/${roomId}/match`)).json()).match;
      const own = (match: Match) => match.players.find(player => player.userId === match.viewerId)!;

      await openQuickActions(page);
      await page.getByRole('button', { name: 'Comprar', exact: true }).click();
      await closeQuickActions(page);
      await expect.poll(async () => own(await read()).handCount).toBe(1);
      const library = await openLibrary(page);
      await library.getByRole('button', { name: /^Embaralhar/ }).click();
      await expect(library.getByRole('status')).toHaveText('Grimório embaralhado.');
      expect((await read()).log.filter(entry => entry.kind === 'shuffle')).toHaveLength(1);
      await library.getByRole('button', { name: 'Olhar cartas', exact: true }).click();
      await library.getByLabel('Quantidade de cartas').fill('2');
      await library.getByRole('button', { name: 'Olhar 2 carta(s)', exact: true }).click();
      await expect(library.locator('.library-card')).toHaveCount(2);
      expect(own(await read()).consulted).toHaveLength(2);
      await library.getByRole('button', { name: /^(Fechar painel do grimório|Minimizar consulta)$/ }).click();

      // Drop the first attempt; the automatic retry must retain its action ID.
      let dropped = false;
      await page.route('**/match/actions', route => {
        if (route.request().postDataJSON().kind === 'roll' && !dropped) {
          dropped = true;
          return route.abort('failed');
        }
        return route.continue();
      });
      const actions = await openGameActions(page);
      await actions.getByRole('button', { name: 'Rolar dado', exact: true }).click();
      await actions.getByRole('button', { name: 'Rolar dado', exact: true }).click();
      await expect.poll(async () => (await read()).log.filter(entry => entry.kind === 'roll').length).toBe(1);
      const rolls = sent.filter(action => action.kind === 'roll');
      expect(rolls).toHaveLength(2);
      expect(rolls[0].intentId).toBe(rolls[1].intentId);
      const intentions = sent.filter((action, index) => index === 0 || action.intentId !== sent[index - 1].intentId);
      expect(intentions.map(action => action.kind)).toEqual(['draw', 'shuffle', 'consult', 'roll']);
      expect(new Set(intentions.map(action => action.intentId)).size).toBe(intentions.length);
      for (const { intentId } of sent) expect(intentId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(errors).toEqual([]);
      await page.reload();
      await openHand(page);
      await expect(page.getByRole('region', { name: 'Mão', exact: true }).getByRole('button', { name: 'Island', exact: true })).toHaveCount(1);
      expect(own(await read()).consulted).toHaveLength(2);
    } finally {
      await opponent.close();
    }
  });
}
