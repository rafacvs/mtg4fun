import { test, expect, selectFieldArea, openHand, openQuickActions, closeQuickActions, roomBody } from './fixtures';
import type { Page } from '@playwright/test';

test('arrasta cartas para fileiras, sobrepõe e reposiciona cada uma independentemente', async ({ page }, testInfo) => {
  test.setTimeout(45_000);
  const api = page.context().request;
  expect((await api.post('/api/session', { data: { login: 'amigo', password: 'senha-do-navegador' } })).ok()).toBe(true);
  const uploaded = await api.post('/api/decks', { multipart: { file: { name: 'posicoes.cod', mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck version="1"><deckname>Posições</deckname><zone name="main"><card number="4" name="Island"/></zone></cockatrice_deck>') } } });
  expect(uploaded.status()).toBe(201);
  const { deck } = await uploaded.json();
  const created = await api.post('/api/rooms', { data: roomBody() });
  const { room } = await created.json();
  expect((await api.put(`/api/rooms/${room.id}/participants/me/ready`, { data: { deckId: deck.id } })).ok()).toBe(true);
  expect((await api.post(`/api/rooms/${room.id}/start`, { data: {} })).status()).toBe(201);

  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto(`/#/salas/${room.id}`);
  await expect(page.locator('.own-dock')).toBeAttached();
  await openHand(page);
  await openQuickActions(page);
  const hand = page.getByRole('region', { name: 'Mão', exact: true });
  const field = page.getByRole('region', { name: 'Campo', exact: true });
  const quickActions = page.getByRole('navigation', { name: 'Ações rápidas', exact: true });
  for (const name of ['Selecionar cartas', 'Grimório']) {
    await expect(quickActions.getByRole('button', { name, exact: true })).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'Ações', exact: true }).click();
  const menu = page.getByRole('dialog', { name: 'Ações do jogo', exact: true });
  for (const name of ['Rolar dado']) {
    await expect(menu.getByRole('button', { name, exact: true })).toBeVisible();
  }
  for (const name of [/^Passar turno$/, /^Selecionar cartas$/, /^Limpar seleção/, /^Desvirar todas$/, /^Grimório$/, /^Comprar cartas$/]) {
    await expect(menu.getByRole('button', { name })).toHaveCount(0);
  }
  await page.screenshot({ path: testInfo.outputPath('comandos-dentro-de-acoes.png'), fullPage: true });
  await page.getByRole('button', { name: 'Fechar ações', exact: true }).click();
  await openQuickActions(page);
  await page.getByRole('button', { name: 'Comprar', exact: true }).click();
  await page.getByRole('button', { name: 'Comprar', exact: true }).click();
  await closeQuickActions(page);
  const cards = hand.getByRole('button', { name: 'Island', exact: true });
  await expect(cards).toHaveCount(2);
  const beginOrganizing = async () => {
    const toggle = hand.locator('.hand-organize');
    if (await toggle.getAttribute('aria-pressed') !== 'true') await toggle.tap();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  };
  const fieldBox = (await field.boundingBox())!;
  if (testInfo.project.use.hasTouch) {
    await beginOrganizing();
    await dragWithTouch(page, (await cards.nth(0).boundingBox())!, { x: fieldBox.x + 60, y: fieldBox.y + 50 });
  } else await cards.nth(0).dragTo(field, { targetPosition: { x: 60, y: 50 }, steps: 8 });
  const fieldCards = field.getByRole('button', { name: 'Island', exact: true });
  await expect(fieldCards).toHaveCount(1);
  await expect.poll(async () => (await (await api.get(`/api/rooms/${room.id}/match`)).json()).match.log.at(-1)?.kind).toBe('move');
  const confirmed = (await (await api.get(`/api/rooms/${room.id}/match`)).json()).match;
  const placed = confirmed.players.find((player: { userId: number }) => player.userId === confirmed.viewerId).battlefield[0];
  await expect(field.locator(`[data-pos-x="${placed.positionX}"][data-row="${placed.row}"]`)).toHaveCount(1);
  let base = await fieldCards.nth(0).boundingBox();
  if (testInfo.project.use.hasTouch) {
    await beginOrganizing();
    await dragWithTouch(page, (await cards.nth(0).boundingBox())!, { x: base!.x + base!.width / 2, y: base!.y + base!.height / 2 });
  }
  else await cards.nth(0).dragTo(fieldCards.nth(0), { targetPosition: { x: base!.width / 2, y: base!.height / 2 }, steps: 8 });
  await expect(fieldCards).toHaveCount(2);
  await expect(field.locator('[data-stack-size="2"]')).toHaveCount(2);
  const baseAfterPosition = await fieldCards.nth(0).boundingBox();
  let stacked = await fieldCards.nth(1).boundingBox();
  // Both cards remain visibly offset and overlapping at the context's card size.
  expect(stacked!.x - baseAfterPosition!.x).toBeGreaterThan(2);
  expect(stacked!.x - baseAfterPosition!.x).toBeLessThan(baseAfterPosition!.width / 2);
  expect(stacked!.y - baseAfterPosition!.y).toBeGreaterThan(2);
  expect(stacked!.y - baseAfterPosition!.y).toBeLessThan(baseAfterPosition!.height / 2);
  if (!testInfo.project.use.hasTouch) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await selectFieldArea(page, field);
    await expect(field.locator('.playing-card.is-selected')).toHaveCount(2);
    const beforeStackMove = (await fieldCards.nth(0).boundingBox())!;
    stacked = await fieldCards.nth(1).boundingBox();
    await page.mouse.move(stacked!.x + stacked!.width / 2, stacked!.y + stacked!.height / 2);
    await page.mouse.down();
    await page.mouse.move(stacked!.x + 100, stacked!.y + stacked!.height / 2, { steps: 8 });
    await page.mouse.up();
    await expect(field.locator('.playing-card.is-selected')).toHaveCount(0);
    await expect(async () => {
      const lower = (await fieldCards.nth(0).boundingBox())!;
      const upper = (await fieldCards.nth(1).boundingBox())!;
      expect(upper.x - lower.x).toBeGreaterThanOrEqual(8);
      expect(upper.y - lower.y).toBeGreaterThanOrEqual(8);
      expect(Math.abs(lower.x - beforeStackMove.x)).toBeGreaterThan(2);
    }).toPass();
    base = await fieldCards.nth(0).boundingBox();
    stacked = await fieldCards.nth(1).boundingBox();
  }
  if (testInfo.project.use.hasTouch) {
    // Two full rows need vertical room. Rotation is now supported without losing the stack.
    await page.setViewportSize({ width: 390, height: 844 });
    await fieldCards.nth(1).scrollIntoViewIfNeeded();
    base = await fieldCards.nth(0).boundingBox();
    stacked = await fieldCards.nth(1).boundingBox();
  }
  const target = { x: base!.x + 8, y: base!.y + base!.height + 45 };
  if (testInfo.project.use.hasTouch) await dragWithTouch(page, stacked!, target);
  else {
    await page.mouse.move(stacked!.x + stacked!.width / 2, stacked!.y + stacked!.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 8 });
    await page.mouse.up();
  }
  await expect(fieldCards).toHaveCount(2);
  await expect(async () => {
    const stayed = await fieldCards.nth(0).boundingBox();
    const moved = await fieldCards.nth(1).boundingBox();
    expect(Math.abs(stayed!.x - base!.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(stayed!.y - base!.y)).toBeLessThanOrEqual(2);
    expect(Math.hypot(moved!.x - stacked!.x, moved!.y - stacked!.y)).toBeGreaterThan(2);
    const gap = moved!.y - (stayed!.y + stayed!.height);
    const cardWidth = await field.evaluate(node => Number.parseFloat(getComputedStyle(node).getPropertyValue('--card-width')));
    const expectedGap = cardWidth * 10 / 72;
    expect(gap).toBeGreaterThanOrEqual(expectedGap - 2);
    expect(gap).toBeLessThanOrEqual(expectedGap + 2);
  }).toPass();
  if (testInfo.project.use.hasTouch) return;
  await selectFieldArea(page, field);
  await expect(field.locator('.playing-card.is-selected')).toHaveCount(2);
  const beforeGroup = await Promise.all([fieldCards.nth(0).boundingBox(), fieldCards.nth(1).boundingBox()]);
  const groupTarget = { x: beforeGroup[1]!.x + 130, y: beforeGroup[1]!.y + 4 };
  if (testInfo.project.use.hasTouch) await dragWithTouch(page, beforeGroup[1]!, groupTarget);
  else {
    await page.mouse.move(beforeGroup[1]!.x + beforeGroup[1]!.width / 2, beforeGroup[1]!.y + beforeGroup[1]!.height / 2);
    await page.mouse.down();
    await page.mouse.move(groupTarget.x, groupTarget.y, { steps: 8 });
    await page.mouse.up();
  }
  await expect(field.locator('.playing-card.is-selected')).toHaveCount(0);
  await expect(async () => {
    const afterGroup = await Promise.all([fieldCards.nth(0).boundingBox(), fieldCards.nth(1).boundingBox()]);
    expect(Math.abs((afterGroup[1]!.x - afterGroup[0]!.x) - (beforeGroup[1]!.x - beforeGroup[0]!.x))).toBeLessThanOrEqual(2);
    expect(Math.abs((afterGroup[1]!.y - afterGroup[0]!.y) - (beforeGroup[1]!.y - beforeGroup[0]!.y))).toBeLessThanOrEqual(2);
  }).toPass();
  const beforeIndividual = (await (await api.get(`/api/rooms/${room.id}/match`)).json()).match.players[0].battlefield;
  const firstAfterGroup = (await fieldCards.nth(0).boundingBox())!;
  const individualTarget = { x: firstAfterGroup.x + 100, y: firstAfterGroup.y + firstAfterGroup.height / 2 };
  if (testInfo.project.use.hasTouch) await dragWithTouch(page, firstAfterGroup, individualTarget);
  else {
    await page.mouse.move(firstAfterGroup.x + firstAfterGroup.width / 2, firstAfterGroup.y + firstAfterGroup.height / 2);
    await page.mouse.down();
    await page.mouse.move(individualTarget.x, individualTarget.y, { steps: 8 });
    await page.mouse.up();
  }
  await expect(async () => {
    const after = (await (await api.get(`/api/rooms/${room.id}/match`)).json()).match.players[0].battlefield;
    expect(after[0].positionX).not.toBe(beforeIndividual[0].positionX);
    expect(after[1].positionX).toBe(beforeIndividual[1].positionX);
    expect(after[1].row).toBe(beforeIndividual[1].row);
    await expect(field.locator(`[data-pos-x="${after[0].positionX}"][data-row="${after[0].row}"]`)).toHaveCount(1);
  }).toPass();
  if (!testInfo.project.use.hasTouch) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole('combobox', { name: 'Densidade', exact: true }).selectOption('compact');
    expect((await api.post(`/api/rooms/${room.id}/match/actions`, { data: { intentId: crypto.randomUUID(), kind: 'set_tapped', cardIds: [beforeIndividual[0].id], tapped: true } })).ok()).toBe(true);
    await expect(field.locator('.is-tapped')).toHaveCount(1);
    const area = await page.evaluate(() => {
      const canvas = document.querySelector<HTMLElement>('[data-battlefield-canvas]')!;
      const cards = [...canvas.querySelectorAll<HTMLElement>('.playing-card')].map(card => card.getBoundingClientRect());
      const left = Math.min(...cards.map(card => card.left));
      const right = Math.max(...cards.map(card => card.right));
      const top = Math.min(...cards.map(card => card.top));
      const bottom = Math.max(...cards.map(card => card.bottom));
      const candidates = [
        { x: left - 3, y: top - 3, endX: right + 3, endY: bottom + 3 },
        { x: right + 3, y: top - 3, endX: left - 3, endY: bottom + 3 },
        { x: left - 3, y: bottom + 3, endX: right + 3, endY: top - 3 },
        { x: right + 3, y: bottom + 3, endX: left - 3, endY: top - 3 },
      ];
      return candidates.find(candidate => {
        const target = document.elementFromPoint(candidate.x, candidate.y);
        return target !== null && canvas.contains(target) && target.closest('.playing-card') === null;
      }) ?? null;
    });
    expect(area).not.toBeNull();
    await page.mouse.move(area!.x, area!.y);
    await page.mouse.down();
    await page.mouse.move(area!.endX, area!.endY, { steps: 8 });
    await page.mouse.up();
    await expect(field.locator('.playing-card.is-selected')).toHaveCount(2);
    await page.screenshot({ path: testInfo.outputPath('retangulo-selecao.png'), fullPage: true });
    await page.keyboard.press('Escape');
    await expect(field.locator('.is-selected')).toHaveCount(0);

  }
  await page.screenshot({ path: testInfo.outputPath('selecao-atual.png'), fullPage: true });
});

async function dragWithTouch(page: Page, source: { x: number; y: number; width: number; height: number }, target: { x: number; y: number }) {
  const session = await page.context().newCDPSession(page);
  const start = { x: source.x + source.width / 2, y: source.y + source.height / 2, id: 1 };
  expect(await page.evaluate(point => Boolean(document.elementFromPoint(point.x, point.y)?.closest('.playing-card')), start), 'origem do gesto deve ser uma carta visível').toBe(true);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
  for (let step = 1; step <= 8; step += 1) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + (target.x - start.x) * step / 8, y: start.y + (target.y - start.y) * step / 8, id: 1 }] });
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await session.detach();
}
