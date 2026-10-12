import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

test('arrasta cartas para fileiras, sobrepõe e reposiciona cada uma independentemente', async ({ page }, testInfo) => {
  test.setTimeout(45_000);
  const api = page.context().request;
  expect((await api.post('/api/session', { data: { login: 'amigo', password: 'senha-do-navegador' } })).ok()).toBe(true);
  const uploaded = await api.post('/api/decks', { multipart: { file: { name: 'posicoes.cod', mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck version="1"><deckname>Posições</deckname><zone name="main"><card number="4" name="Island"/></zone></cockatrice_deck>') } } });
  expect(uploaded.status()).toBe(201);
  const { deck } = await uploaded.json();
  const created = await api.post('/api/rooms', { data: {} });
  const { room } = await created.json();
  expect((await api.put(`/api/rooms/${room.id}/participants/me/ready`, { data: { deckId: deck.id } })).ok()).toBe(true);
  expect((await api.post(`/api/rooms/${room.id}/start`, { data: {} })).status()).toBe(201);

  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto(`/#/salas/${room.id}`);
  const hand = page.getByRole('region', { name: 'Mão', exact: true });
  const field = page.getByRole('region', { name: 'Campo', exact: true });
  await page.getByRole('button', { name: 'Ações', exact: true }).click();
  await page.getByRole('button', { name: 'Comprar cartas', exact: true }).click();
  await page.getByRole('button', { name: 'Comprar cartas', exact: true }).click();
  await page.getByRole('button', { name: 'Comprar cartas', exact: true }).click();
  await page.getByRole('button', { name: 'Fechar ações', exact: true }).click();
  const cards = hand.getByRole('button', { name: 'Island', exact: true });
  await expect(cards).toHaveCount(2);
  await cards.nth(0).dragTo(field, { steps: 8 });
  const fieldCards = field.getByRole('button', { name: 'Island', exact: true });
  await expect(fieldCards).toHaveCount(1);
  const base = await fieldCards.nth(0).boundingBox();
  if (testInfo.project.use.hasTouch) await dragWithTouch(page, (await cards.nth(0).boundingBox())!, { x: base!.x + base!.width / 2, y: base!.y + base!.height / 2 });
  else await cards.nth(0).dragTo(fieldCards.nth(0), { targetPosition: { x: base!.width / 2, y: base!.height / 2 }, steps: 8 });
  await expect(fieldCards).toHaveCount(2);
  const stacked = await fieldCards.nth(1).boundingBox();
  expect(stacked!.x - base!.x).toBeGreaterThanOrEqual(8);
  expect(stacked!.x - base!.x).toBeLessThanOrEqual(24);
  expect(stacked!.y - base!.y).toBeGreaterThanOrEqual(8);
  expect(stacked!.y - base!.y).toBeLessThanOrEqual(24);
  const target = { x: base!.x + 8, y: base!.y + base!.height + 10 };
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
    expect(gap).toBeGreaterThanOrEqual(2);
    expect(gap).toBeLessThanOrEqual(4);
  }).toPass();

  await page.getByRole('button', { name: 'Selecionar cartas', exact: true }).click();
  if (testInfo.project.use.hasTouch) {
    await tapWithTouch(page, (await fieldCards.nth(0).boundingBox())!);
    await tapWithTouch(page, (await fieldCards.nth(1).boundingBox())!);
  } else {
    await fieldCards.nth(0).click();
    await fieldCards.nth(1).click();
  }
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
  const otherBeforeIndividualMove = await fieldCards.nth(1).boundingBox();
  const firstAfterGroup = await fieldCards.nth(0).boundingBox();
  if (testInfo.project.use.hasTouch) await dragWithTouch(page, firstAfterGroup!, { x: firstAfterGroup!.x + 80, y: firstAfterGroup!.y + firstAfterGroup!.height + 12 });
  else await fieldCards.nth(0).dragTo(field, { targetPosition: { x: firstAfterGroup!.x - (await field.boundingBox())!.x + 80, y: firstAfterGroup!.y - (await field.boundingBox())!.y + firstAfterGroup!.height + 12 }, steps: 8 });
  await expect(async () => {
    const otherAfterIndividualMove = await fieldCards.nth(1).boundingBox();
    expect(Math.abs(otherAfterIndividualMove!.x - otherBeforeIndividualMove!.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(otherAfterIndividualMove!.y - otherBeforeIndividualMove!.y)).toBeLessThanOrEqual(2);
  }).toPass();
  if (!testInfo.project.use.hasTouch) {
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
    await page.getByRole('button', { name: /Limpar seleção/ }).click();
  }
});

async function dragWithTouch(page: Page, source: { x: number; y: number; width: number; height: number }, target: { x: number; y: number }) {
  const session = await page.context().newCDPSession(page);
  const start = { x: source.x + source.width / 2, y: source.y + source.height / 2, id: 1 };
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
  for (let step = 1; step <= 8; step += 1) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + (target.x - start.x) * step / 8, y: start.y + (target.y - start.y) * step / 8, id: 1 }] });
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await session.detach();
}

async function tapWithTouch(page: Page, target: { x: number; y: number; width: number; height: number }) {
  const session = await page.context().newCDPSession(page);
  const touch = { x: target.x + target.width / 2, y: target.y + target.height / 2, id: 1 };
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await session.detach();
}
