import type { Locator } from '@playwright/test';
import { test, expect, openMatchRail } from './fixtures';

async function expectLifeBesideName(table: Locator, life: number) {
  const name = table.getByRole('heading', { name: /Amigo da mesa/ });
  const lifeLabel = table.getByLabel(`Vida: ${life}`, { exact: true });
  const identity = table.getByRole('button', { name: 'Abrir jogador Amigo da mesa', exact: true });
  const focus = table.getByRole('button', { name: 'Ampliar mesa de Amigo da mesa', exact: true });
  await expect(lifeLabel).toBeVisible();
  const [nameBox, lifeBox, identityBox, focusBox] = await Promise.all([name.boundingBox(), lifeLabel.boundingBox(), identity.boundingBox(), focus.boundingBox()]);
  expect(nameBox && lifeBox && identityBox && focusBox).toBeTruthy();
  expect(lifeBox!.x).toBeGreaterThanOrEqual(nameBox!.x + nameBox!.width - 1);
  expect(lifeBox!.x - (nameBox!.x + nameBox!.width)).toBeLessThanOrEqual(20);
  expect(Math.abs((lifeBox!.y + lifeBox!.height / 2) - (nameBox!.y + nameBox!.height / 2))).toBeLessThan(14);
  expect(lifeBox!.x).toBeGreaterThanOrEqual(identityBox!.x);
  expect(lifeBox!.x + lifeBox!.width).toBeLessThanOrEqual(identityBox!.x + identityBox!.width + 1);
  expect(focusBox!.x).toBeGreaterThanOrEqual(identityBox!.x + identityBox!.width - 1);
  expect(lifeBox!.x + lifeBox!.width).toBeLessThanOrEqual(focusBox!.x + 1);
}

test('vida, marcadores e modificador de carta pelo painel com mouse ou toque', async ({ page, browser, baseURL }, info) => {

  test.setTimeout(60_000);
  const api = page.request;
  expect((await api.post('/api/session', { data: { login: 'amigo', password: 'senha-do-navegador' } })).ok()).toBe(true);
  const upload = await api.post('/api/decks', { multipart: { file: { name: 'contadores.cod', mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck version="1"><deckname>Contadores</deckname><zone name="main"><card number="2" name="Island"/></zone></cockatrice_deck>') } } });
  expect(upload.status()).toBe(201);
  const { deck } = await upload.json();
  const { room } = await (await api.post('/api/rooms', { data: {} })).json();
  expect((await api.put(`/api/rooms/${room.id}/participants/me/ready`, { data: { deckId: deck.id } })).ok()).toBe(true);
  const observer = await browser.newContext({ baseURL, viewport: info.project.use.viewport, isMobile: info.project.use.isMobile, hasTouch: info.project.use.hasTouch });
  try {
    expect((await observer.request.post('/api/session', { data: { login: 'segundo', password: 'senha-do-navegador' } })).ok()).toBe(true);
    const otherDeck = await observer.request.post('/api/decks', { multipart: { file: { name: 'outro.cod', mimeType: 'application/xml', buffer: Buffer.from('<cockatrice_deck version="1"><deckname>Outro</deckname><zone name="main"><card number="2" name="Island"/></zone></cockatrice_deck>') } } });
    expect(otherDeck.status()).toBe(201);
    const otherDeckID = (await otherDeck.json()).deck.id;
    expect((await observer.request.post(`/api/rooms/${room.id}/participants`, { data: {} })).ok()).toBe(true);
    expect((await observer.request.put(`/api/rooms/${room.id}/participants/me/ready`, { data: { deckId: otherDeckID } })).ok()).toBe(true);
    expect((await api.post(`/api/rooms/${room.id}/start`, { data: {} })).status()).toBe(201);
    expect((await api.delete(`/api/decks/${deck.id}`)).status()).toBe(204);
    expect((await observer.request.delete(`/api/decks/${otherDeckID}`)).status()).toBe(204);
    expect((await api.post(`/api/rooms/${room.id}/match/actions`, { data: { intentId: crypto.randomUUID(), kind: 'draw', count: 1 } })).ok()).toBe(true);
    await page.goto(`/#/salas/${room.id}`);
    const activate = async (locator: Locator) => {
      if (info.project.use.hasTouch) await locator.tap(); else await locator.click();
    };
    const press = (name: string) => activate(page.getByRole('button', { name, exact: true }));
    const lifeLog = async () => {
      const body = await (await api.get(`/api/rooms/${room.id}/match`)).json();
      return (body.match.log as { kind: string; result?: string }[]).filter(entry => entry.kind === 'counter' && entry.result?.startsWith('vida =')).map(entry => entry.result);
    };
    const expectLifeLog = async (results: string[]) => {
      await expect.poll(lifeLog).toEqual(results);
      await page.waitForTimeout(350);
      expect(await lifeLog()).toEqual(results);
    };
    const table = page.getByRole('article', { name: 'Mesa de Amigo da mesa', exact: true });
    await expectLifeBesideName(table, 40);
    const viewport = page.viewportSize();
    await page.setViewportSize({ width: 320, height: 568 });
    await expectLifeBesideName(table, 40);
    expect(await table.getByRole('heading', { name: /Amigo da mesa/ }).evaluate(node => {
      const life = node.parentElement?.querySelector('[aria-label^="Vida:"]');
      if (!(life instanceof HTMLElement)) return false;
      const original = node.innerHTML;
      node.textContent = 'Jogador com um nome muito longo para caber neste campo estreito';
      const nameBox = node.getBoundingClientRect();
      const lifeBox = life.getBoundingClientRect();
      const fits = getComputedStyle(node).textOverflow === 'ellipsis'
        && node.scrollWidth > node.clientWidth + 1
        && lifeBox.left >= nameBox.right - 1
        && lifeBox.left - nameBox.right <= 20
        && lifeBox.left >= 0
        && lifeBox.right <= window.innerWidth
        && lifeBox.width > 12;
      node.innerHTML = original;
      return fits;
    })).toBe(true);
    if (viewport) await page.setViewportSize(viewport);
    await table.getByRole('button', { name: 'Abrir jogador Amigo da mesa', exact: true }).click();
    const panel = page.getByRole('dialog', { name: 'Jogador Amigo da mesa' });
    await expect(panel.getByRole('button', { name: 'Vida', exact: true })).toHaveCount(0);
    await expect(panel.getByText('Vida', { exact: true })).toBeVisible();
    const life = panel.getByRole('textbox', { name: 'Vida', exact: true });
    await expect(life).toBeVisible();
    for (const control of [panel.getByRole('button', { name: 'Diminuir vida', exact: true }), panel.getByRole('button', { name: 'Aumentar vida', exact: true }), life]) {
      const box = await control.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    await life.fill('9');
    await page.waitForTimeout(1_300);
    await expect(life).toBeFocused();
    await expect(life).toHaveValue('9');
    await expect(table.getByLabel('Vida: 40', { exact: true })).toBeVisible();
    expect(await lifeLog()).toEqual([]);
    for (const invalid of ['-', '+', '1.5', '']) {
      await life.fill(invalid);
      await life.blur();
      await expect(life).toHaveValue('40');
    }
    await page.waitForTimeout(400);
    expect(await lifeLog()).toEqual([]);
    await life.fill('0');
    await life.press('Enter');
    await life.blur();
    await expect(table.getByLabel('Vida: 0', { exact: true })).toBeVisible();
    await expectLifeLog(['vida = 0']);
    await life.fill('0');
    await life.press('Enter');
    await life.blur();
    await expectLifeLog(['vida = 0']);
    await life.fill('-5');
    await life.blur();
    await expect(table.getByLabel('Vida: -5', { exact: true })).toBeVisible();
    await expectLifeLog(['vida = 0', 'vida = -5']);
    await activate(panel.getByRole('button', { name: 'Diminuir vida', exact: true }));
    await expect(table.getByLabel('Vida: -6', { exact: true })).toBeVisible();
    await expectLifeLog(['vida = 0', 'vida = -5', 'vida = -6']);
    await activate(panel.getByRole('button', { name: 'Aumentar vida', exact: true }));
    await expect(table.getByLabel('Vida: -5', { exact: true })).toBeVisible();
    await expectLifeLog(['vida = 0', 'vida = -5', 'vida = -6', 'vida = -5']);
    await life.fill('16');
    await press('Marcadores');
    const addRed = panel.getByRole('button', { name: 'Aumentar marcador vermelho', exact: true });
    await activate(addRed);
    await activate(addRed);
    await expect(table.getByLabel('marcador vermelho')).toHaveText('2');
    await expectLifeLog(['vida = 0', 'vida = -5', 'vida = -6', 'vida = -5', 'vida = 16']);
    await expect(table.getByLabel('Vida: 16', { exact: true })).toBeVisible();
    await press('Voltar');
    await expect(panel.getByRole('button', { name: 'Vida', exact: true })).toHaveCount(0);
    const restored = panel.getByRole('textbox', { name: 'Vida', exact: true });
    await expect(restored).toBeEnabled();
    await expect(restored).toHaveValue('16');
    await press('Fechar jogador');
    await press('Island');
    const preview = page.getByRole('dialog', { name: 'Imagem de Island' });
    await preview.getByRole('button', { name: 'Ajustes', exact: true }).click();
    await preview.getByLabel('Poder', { exact: true }).fill('-1');
    await preview.getByLabel('Poder', { exact: true }).press('Enter');
    await expect(page.getByRole('region', { name: 'Mão', exact: true }).getByText('-1/+0', { exact: true })).toBeVisible();
    const toughnessAmount = preview.getByLabel('Resistência', { exact: true });
    await toughnessAmount.fill('4');
    await toughnessAmount.press('Enter');
    await page.waitForTimeout(1_300);
    await expect(toughnessAmount).toBeFocused();
    await expect(page.getByRole('region', { name: 'Mão', exact: true }).getByText('-1/+4', { exact: true })).toBeVisible();
    const otherPage = await observer.newPage();
    await otherPage.goto(`/#/salas/${room.id}`);
    await openMatchRail(otherPage);
    const focus = otherPage.getByRole('navigation', { name: 'Foco da mesa' }).getByRole('button', { name: /^Ver campo de Amigo da mesa$/ });
    if (info.project.use.hasTouch) await focus.tap(); else await focus.click();
    const otherTable = otherPage.getByRole('article', { name: 'Mesa de Amigo da mesa' });
    await expect(otherTable.getByLabel('Vida: 16', { exact: true })).toBeVisible();
    await expect(otherTable.getByLabel('marcador vermelho')).toHaveText('2');
    await otherTable.getByRole('button', { name: 'Abrir jogador Amigo da mesa', exact: true }).click();
    const readOnly = otherPage.getByRole('dialog', { name: 'Jogador Amigo da mesa' });
    await expect(readOnly.getByText('Somente leitura')).toBeVisible();
    await expect(readOnly.getByText('16', { exact: true })).toBeVisible();
    await expect(readOnly.getByRole('textbox', { name: 'Vida', exact: true })).toHaveCount(0);
    await expect(readOnly.getByRole('spinbutton')).toHaveCount(0);
    await expect(readOnly.getByRole('button', { name: 'Diminuir vida', exact: true })).toHaveCount(0);
    await expect(readOnly.getByRole('button', { name: 'Aumentar vida', exact: true })).toHaveCount(0);
    await expect(readOnly.getByRole('button', { name: 'Vida', exact: true })).toHaveCount(0);
    await expect(readOnly.getByLabel('marcador vermelho')).toHaveText('2');
    await readOnly.getByRole('button', { name: 'Fechar jogador' }).click();
    const view = (await (await api.get(`/api/rooms/${room.id}/match`)).json()).match;
    const own = view.players.find((player: { userId: number }) => player.userId === view.viewerId);
    expect((await observer.request.post(`/api/rooms/${room.id}/match/actions`, { data: { intentId: crypto.randomUUID(), kind: 'counter', target: 'card', cardId: own.hand[0].id, subject: 'power', operation: 'set', value: 99 } })).status()).toBe(409);
    await otherPage.getByRole('button', { name: 'Ações', exact: true }).click();
    const otherPanel = otherPage.getByRole('dialog', { name: 'Ações do jogo' });
    await expect(otherPanel.getByRole('button', { name: 'Vida', exact: true })).toHaveCount(0);
    await expect(otherPanel.getByRole('button', { name: 'Marcadores', exact: true })).toHaveCount(0);
    await expect(otherPage.getByText('-1/+4', { exact: true })).toHaveCount(0);
    await page.reload();
    await expect(table.getByLabel('Vida: 16', { exact: true })).toBeVisible();
    await expect(table.getByLabel('marcador vermelho')).toHaveText('2');
    await expect(page.getByRole('region', { name: 'Mão', exact: true }).getByText('-1/+4', { exact: true })).toBeVisible();
  } finally { await observer.close(); }
});
