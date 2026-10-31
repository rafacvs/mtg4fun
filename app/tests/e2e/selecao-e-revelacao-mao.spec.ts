import { test, expect, roomBody, returnOpeningHandToLibrary } from './fixtures';
import type { Match } from '../../src/features/rooms/roomsApi';
import type { Browser, Page } from '@playwright/test';

const deckFile = (name: string) => ({ file: { name: 'deck.cod', mimeType: 'application/xml', buffer: Buffer.from(`<cockatrice_deck><zone name="main"><card number="8" name="${name}"/></zone></cockatrice_deck>`) } });

async function joinedPage(browser: Browser, baseURL: string, login: string) {
  const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  expect((await page.request.post('/api/session', { data: { login, password: 'senha-do-navegador' } })).ok()).toBeTruthy();
  return page;
}

async function startMatch(page: Page, others: Page[]) {
  const { room } = await (await page.request.post('/api/rooms', { data: roomBody({ seats: 1 + others.length }) })).json();
  for (const other of others) expect((await other.request.post(`/api/rooms/${room.id}/participants`, { data: {} })).ok()).toBeTruthy();
  for (const player of [page, ...others]) {
    const { deck } = await (await player.request.post('/api/decks', { multipart: deckFile('Island') })).json();
    expect((await player.request.put(`/api/rooms/${room.id}/participants/me/ready`, { data: { deckId: deck.id } })).ok()).toBeTruthy();
  }
  expect((await page.request.post(`/api/rooms/${room.id}/start`, { data: {} })).ok()).toBeTruthy();
  for (const player of [page, ...others]) await returnOpeningHandToLibrary(player.request, room.id);
  const act = async (action: object): Promise<Match> => {
    const response = await page.request.post(`/api/rooms/${room.id}/match/actions`, { data: { intentId: crypto.randomUUID(), ...action } });
    expect(response.ok()).toBeTruthy();
    return (await response.json()).match;
  };
  return { roomId: room.id as number, act };
}

test('botão direito seleciona uma carta do campo e o esquerdo inspeciona', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  test.setTimeout(60_000);
  expect((await page.request.post('/api/session', { data: { login: 'amigo', password: 'senha-do-navegador' } })).ok()).toBeTruthy();
  const { roomId, act } = await startMatch(page, []);
  const drawn = await act({ kind: 'draw', count: 2 });
  const cards = drawn.players[0].hand!.slice(-2);
  await act({ kind: 'move', cardIds: cards.map(card => card.id), to: 'battlefield' });
  for (const [index, card] of cards.entries()) await act({ kind: 'position', cardId: card.id, x: index + 1, row: 0 });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/#/salas/${roomId}`);
  const field = page.getByRole('article', { name: 'Mesa de Amigo da mesa' });
  const first = field.locator(`.playing-card[data-card-id="${cards[0].id}"]`);
  const second = field.locator(`.playing-card[data-card-id="${cards[1].id}"]`);
  const bar = page.getByRole('toolbar', { name: 'Ações da seleção' });
  const inspector = page.getByRole('dialog', { name: /Imagem de/ });

  await first.click({ button: 'right' });
  await expect(first).toHaveClass(/is-selected/);
  await expect(bar).toContainText('1 carta');
  await expect(inspector).toHaveCount(0);
  await second.click({ button: 'right' });
  await expect(bar).toContainText('2 cartas');
  await second.click({ button: 'right' });
  await expect(second).not.toHaveClass(/is-selected/);
  await expect(bar).toContainText('1 carta');
  await first.click({ button: 'right' });
  await expect(first).not.toHaveClass(/is-selected/);
  await expect(bar).toHaveCount(0);

  await first.click({ modifiers: ['Shift'] });
  await expect(bar).toContainText('1 carta');
  await page.keyboard.press('Escape');
  await expect(bar).toHaveCount(0);

  // Área com uma carta só também abre o menu, pelos dois gestos.
  const box = (await first.boundingBox())!;
  const start = { x: box.x - 6, y: box.y + 4 };
  expect(await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('[data-battlefield-canvas]') && !document.elementFromPoint(x, y)?.closest('.playing-card'), start)).toBe(true);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(box.x + 10, box.y + 10, { steps: 4 });
  await page.mouse.up({ button: 'right' });
  await expect(first).toHaveClass(/is-selected/);
  await expect(bar).toContainText('1 carta');
  await page.keyboard.press('Escape');
  await expect(bar).toHaveCount(0);

  await first.click();
  await expect(inspector).toBeVisible();
  await expect(bar).toHaveCount(0);
  await inspector.getByRole('button', { name: 'Fechar', exact: true }).click();
  await expect(bar).toHaveCount(0);
  await first.click({ button: 'right' });
  await expect(bar).toContainText('1 carta');
  await expect(first).toHaveClass(/is-selected/);
});

test('cartas da mão vão ao campo ou são reveladas só para os escolhidos', async ({ browser, baseURL }, info) => {
  test.skip(info.project.name !== 'desktop');
  test.setTimeout(120_000);
  const owner = await joinedPage(browser, baseURL!, 'amigo');
  const chosen = await joinedPage(browser, baseURL!, 'segundo');
  const outsider = await joinedPage(browser, baseURL!, 'amigo3');
  const { roomId, act } = await startMatch(owner, [chosen, outsider]);
  const drawn = await act({ kind: 'draw', count: 3 });
  const hand = drawn.players.find(player => player.userId === drawn.viewerId)!.hand!;
  for (const page of [owner, chosen, outsider]) await page.goto(`/#/salas/${roomId}`);

  const handZone = owner.getByRole('region', { name: 'Mão', exact: true });
  const card = (index: number) => handZone.locator(`.playing-card[data-card-id="${hand[index].id}"]`);
  const bar = owner.getByRole('toolbar', { name: 'Ações da seleção na mão' });
  await card(0).click({ button: 'right' });
  await expect(bar).toContainText('1 carta');
  await expect(bar.getByRole('button', { name: 'Campo', exact: true })).toBeVisible();
  await card(1).click({ modifiers: ['Shift'] });
  await expect(bar).toContainText('2 cartas');
  await card(1).click({ button: 'right' });
  await expect(bar).toContainText('1 carta');

  await bar.getByRole('button', { name: 'Revelar para jogadores' }).click();
  const panel = owner.getByRole('dialog', { name: 'Revelar para jogadores' });
  await expect(panel.getByRole('checkbox')).toHaveCount(2);
  await expect(panel).not.toContainText('Amigo da mesa');
  await expect(panel.getByRole('button', { name: 'Ocultar de todos' })).toBeDisabled();
  await panel.getByRole('checkbox', { name: 'Segundo amigo' }).check();
  await owner.screenshot({ path: info.outputPath('painel-revelar.png') });
  await panel.getByRole('button', { name: 'Revelar', exact: true }).click();
  await expect(panel).toHaveCount(0);
  await expect(card(0).getByText('Revelada')).toBeVisible();

  const revealedFrom = (page: Page) => page.getByRole('region', { name: 'Cartas reveladas de Amigo da mesa' });
  await expect(revealedFrom(chosen).locator(`[data-card-id="${hand[0].id}"]`)).toBeVisible({ timeout: 10_000 });
  await expect(revealedFrom(chosen)).toContainText('Reveladas · Para você');
  await chosen.screenshot({ path: info.outputPath('quem-recebeu.png') });
  const shown = (await revealedFrom(chosen).locator(`[data-card-id="${hand[0].id}"]`).boundingBox())!;
  expect(await chosen.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('.table-revealed .playing-card'), { x: shown.x + shown.width / 2, y: shown.y + shown.height - 4 })).toBe(true);

  // A outra pessoa continua na partida atualizada, sem receber a carta.
  await expect.poll(async () => {
    const { match } = await (await outsider.request.get(`/api/rooms/${roomId}/match`)).json();
    return (match as Match).log.at(-1)?.kind;
  }, { timeout: 10_000 }).toBe('reveal_cards_to');
  await outsider.waitForTimeout(1500);
  await expect(revealedFrom(outsider)).toHaveCount(0);
  await expect(outsider.locator(`[data-card-id="${hand[0].id}"]`)).toHaveCount(0);

  // Reabrir mostra quem vê; desmarcar todos oculta.
  await bar.getByRole('button', { name: 'Revelar para jogadores' }).click();
  await expect(panel.getByRole('checkbox', { name: 'Segundo amigo' })).toBeChecked();
  await panel.getByRole('checkbox', { name: 'Segundo amigo' }).uncheck();
  await panel.getByRole('button', { name: 'Ocultar de todos' }).click();
  await expect(revealedFrom(chosen)).toHaveCount(0, { timeout: 10_000 });

  await bar.getByRole('button', { name: 'Campo', exact: true }).click();
  await expect(bar).toHaveCount(0);
  await expect(owner.getByRole('article', { name: 'Mesa de Amigo da mesa' }).locator(`.playing-card[data-card-id="${hand[0].id}"]`)).toBeVisible();
  await expect(handZone.locator('.playing-card')).toHaveCount(2);

  // Trocar de lugar começa uma seleção nova, sem misturar mão e campo.
  await owner.getByRole('article', { name: 'Mesa de Amigo da mesa' }).locator(`.playing-card[data-card-id="${hand[0].id}"]`).click({ button: 'right' });
  await expect(owner.getByRole('toolbar', { name: 'Ações da seleção', exact: true })).toContainText('1 carta');
  await card(1).click({ button: 'right' });
  await expect(bar).toContainText('1 carta');
  await expect(owner.getByRole('toolbar', { name: 'Ações da seleção', exact: true })).toHaveCount(0);
  for (const page of [owner, chosen, outsider]) await page.context().close();
});

test('no celular o modo de seleção abre o menu da mão, dentro da tela', async ({ page }, info) => {
  test.skip(info.project.name === 'desktop');
  test.setTimeout(60_000);
  expect((await page.request.post('/api/session', { data: { login: 'amigo', password: 'senha-do-navegador' } })).ok()).toBeTruthy();
  const { roomId, act } = await startMatch(page, []);
  const drawn = await act({ kind: 'draw', count: 2 });
  const hand = drawn.players[0].hand!;
  await page.goto(`/#/salas/${roomId}`);
  await page.getByRole('button', { name: 'Comandos', exact: true }).click();
  await page.getByRole('button', { name: 'Selecionar cartas' }).click();
  await page.locator(`.zone-hand .playing-card[data-card-id="${hand[0].id}"]`).tap();
  const bar = page.getByRole('toolbar', { name: 'Ações da seleção na mão' });
  await expect(bar).toContainText('1 carta');
  await page.screenshot({ path: info.outputPath('mao-celular.png') });
  const box = (await bar.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  await bar.getByRole('button', { name: 'Campo', exact: true }).tap();
  await expect(bar).toHaveCount(0);
  await expect.poll(async () => {
    const { match } = await (await page.request.get(`/api/rooms/${roomId}/match`)).json();
    return (match as Match).players[0].battlefield?.some(card => card.id === hand[0].id);
  }).toBe(true);
});

test('toda a área amarela do botão de turno avança e só a esquerda corrige', async ({ browser, baseURL }, info) => {
  test.skip(info.project.name !== 'desktop');
  test.setTimeout(60_000);
  const page = await joinedPage(browser, baseURL!, 'amigo');
  const other = await joinedPage(browser, baseURL!, 'segundo');
  const { roomId } = await startMatch(page, [other]);
  await page.goto(`/#/salas/${roomId}`);
  const current = async () => {
    const { match } = await (await page.request.get(`/api/rooms/${roomId}/match`)).json();
    return (match as Match).currentTurn.userId;
  };
  const control = page.getByRole('group', { name: 'Turno', exact: true });
  const correct = control.getByRole('button', { name: 'Corrigir turno' });
  const advance = control.getByRole('button', { name: 'Passar turno' });
  const start = await current();
  const whole = (await control.boundingBox())!;
  const left = (await correct.boundingBox())!;
  const right = (await advance.boundingBox())!;
  expect(right.width).toBeGreaterThan(left.width * 3);
  expect(left.width + right.width).toBeGreaterThanOrEqual(whole.width - 3);
  await control.getByText('Turno', { exact: true }).click();
  await expect.poll(current).not.toBe(start);
  await expect(advance).toBeEnabled();
  await correct.click();
  await expect.poll(current).toBe(start);
  await expect(advance).toBeEnabled();
  await page.mouse.click(right.x + right.width - 6, right.y + right.height / 2);
  await expect.poll(current).not.toBe(start);
  await page.screenshot({ path: info.outputPath('botao-turno.png'), clip: { x: whole.x - 120, y: whole.y - 16, width: whole.width + 160, height: whole.height + 32 } });
  for (const player of [page, other]) await player.context().close();
});

