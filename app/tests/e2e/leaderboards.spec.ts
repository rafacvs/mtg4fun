import { test, expect, roomBody, confirmHands } from './fixtures';

test('leaderboard usa partidas reais, mantém navegação e adapta o pódio ao celular', async ({ page, browser, baseURL }, info) => {
  test.setTimeout(90_000);
  const others = [await browser.newContext({ baseURL }), await browser.newContext({ baseURL })];
  const requests = [page.request, ...others.map(context => context.request)];
  try {
    for (const [index, login] of ['amigo', 'segundo', 'amigo3'].entries()) {
      expect((await requests[index].post('/api/session', { data: { login, password: 'senha-do-navegador' } })).ok()).toBe(true);
    }
    await page.goto('/#/leaderboards');
    await expect(page.getByRole('heading', { name: 'A coroa está sem dono' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Top 1 mais omisso' })).toBeVisible();
    await expect(page.locator('.leaderboard-omission')).toContainText('agiotagem');
    for (let winner = 0; winner < 3; winner++) {
      const loser = (winner + 1) % 3;
      const api = requests[winner], rival = requests[loser];
      const created = await api.post('/api/rooms', { data: roomBody() });
      expect(created.ok()).toBe(true);
      const roomId = (await created.json()).room.id;
      expect((await rival.post(`/api/rooms/${roomId}/participants`, { data: {} })).ok()).toBe(true);
      for (const request of [api, rival]) {
        const upload = await request.post('/api/decks', { multipart: { file: { name: 'zoeira.cod', mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck><zone name="main"><card number="20" name="Island"/></zone></cockatrice_deck>') } } });
        expect(upload.ok()).toBe(true);
        const { deck } = await upload.json();
        expect((await request.put(`/api/rooms/${roomId}/participants/me/ready`, { data: { deckId: deck.id } })).ok()).toBe(true);
      }
      expect((await api.post(`/api/rooms/${roomId}/start`, { data: {} })).ok()).toBe(true);
      await confirmHands(roomId, api, rival);
      const act = async (request: typeof api, data: object) => {
        const response = await request.post(`/api/rooms/${roomId}/match/actions`, { data: { intentId: crypto.randomUUID(), ...data } });
        expect(response.ok(), await response.text()).toBe(true);
      };
      await act(api, { kind: 'draw', count: 2 });
      await act(rival, { kind: 'turn', direction: 'next' });
      const { match } = await (await rival.get(`/api/rooms/${roomId}/match`)).json();
      await act(rival, { kind: 'counter', target: 'player', playerId: match.viewerId, subject: 'life', operation: 'set', value: 0 });
      await act(api, { kind: 'finish' });
    }
    await page.reload();
    await expect(page.locator('.leaderboard-podium-card')).toHaveCount(3);
    await expect(page.locator('.leaderboard-table tbody tr')).toHaveCount(3);
    await expect(page.locator('.leaderboard-log time')).toHaveCount(3);
    await expect(page.locator('.leaderboard-award').filter({ has: page.getByRole('heading', { name: 'Saco de pancadas', exact: true }) })).toContainText('40 de vida');
    await expect(page.locator('.leaderboard-award').filter({ has: page.getByRole('heading', { name: 'Só mais uma cartinha', exact: true }) })).toContainText('2 cartas');
    await page.getByRole('button', { name: 'Este mês', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Este mês', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.leaderboard-podium-card')).toHaveCount(3);
    await page.getByRole('button', { name: 'Esta semana', exact: true }).click();
    await expect(page.locator('.leaderboard-podium-card')).toHaveCount(3);
    await page.getByRole('button', { name: 'Desde sempre', exact: true }).click();
    await expect(page.locator('.leaderboard-podium-card')).toHaveCount(3);
    await page.getByRole('button', { name: 'Provocar o grupo' }).click();
    await expect(page.getByRole('status')).toContainText(/Provocação copiada|agiotagem segue Top 1/);
    await page.getByText('Como contamos os vexames?', { exact: true }).click();
    await expect(page.getByText(/Dano soma reduções de vida/)).toBeVisible();
    const widths = info.project.name === 'desktop' ? [1440, 1101, 1024, 820] : [320, 390, 740];
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Leaderboard', exact: true })).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      const cards = await page.locator('.leaderboard-podium-card').evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y }; }));
      if (width <= 760) expect(new Set(cards.map(card => Math.round(card.x))).size).toBe(1);
      await page.screenshot({ path: info.outputPath(`leaderboard-${width}.png`), fullPage: true });
    }
    await page.getByRole('link', { name: 'Salas', exact: true }).click();
    await expect(page.locator('.leaderboard-screen')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.goBack();
    await expect(page.locator('.leaderboard-podium-card')).toHaveCount(3);
    await page.reload();
    await expect(page.locator('.leaderboard-podium-card')).toHaveCount(3);
  } finally { await Promise.all(others.map(context => context.close())); }
});

test('leaderboard permite tentar novamente após falha de carregamento', async ({ page }) => {
  expect((await page.request.post('/api/session', { data: { login: 'amigo', password: 'senha-do-navegador' } })).ok()).toBe(true);
  await page.route('**/api/leaderboards?*', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Placar indisponível por um instante.' }) }));
  await page.goto('/#/leaderboards');
  await expect(page.getByRole('alert')).toContainText('Placar indisponível');
  await page.unroute('**/api/leaderboards?*');
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Troféus da zoeira' })).toBeVisible();
});
