import type { Browser, Page } from '@playwright/test';
import { test, expect, roomBody } from './fixtures';

const password = 'senha-do-navegador';

// Três jogadores reais na mesma sala: quem desafia, quem é desafiado e quem só assiste.
async function table(browser: Browser, page: Page, baseURL: string, viewport: { width: number; height: number } | null, options: Parameters<Browser['newContext']>[0]) {
  const guests = await Promise.all([1, 2].map(async () => (await browser.newContext({ ...options, baseURL, viewport: viewport ?? undefined })).newPage()));
  const [guest, watcher] = guests;
  const logins = [[page, 'amigo'], [guest, 'segundo'], [watcher, 'amigo3']] as const;
  for (const [client, login] of logins) expect((await client.request.post('/api/session', { data: { login, password } })).ok()).toBe(true);
  const { room } = await (await page.request.post('/api/rooms', { data: roomBody({ seats: 3 }) })).json();
  for (const client of [guest, watcher]) expect((await client.request.post(`/api/rooms/${room.id}/participants`, { data: {} })).ok()).toBe(true);
  return { room, guest, watcher, close: () => Promise.all(guests.map(client => client.context().close())) };
}

const rollButton = (page: Page) => page.getByRole('button', { name: /^Rolar D20$/ });

async function enter(page: Page, roomId: number) {
  await page.goto(`/#/salas/${roomId}`);
  await expect(rollButton(page)).toBeVisible();
}

// Rolagem de outro jogador pela API real; o gesto do botão é coberto em preparation-dice.spec.ts.
async function throwDie(page: Page, path: string, intent: number) {
  const response = await page.request.post(`${path}/preparation/actions`, { data: { kind: 'roll', intentId: `00000000-0000-4000-8000-${String(intent).padStart(12, '0')}` } });
  expect(response.ok(), await response.text()).toBe(true);
}

test('emoji cai na tela de todos e respeita o cooldown', async ({ page, browser, baseURL }, info) => {
  const { room, guest, watcher, close } = await table(browser, page, baseURL!, page.viewportSize(), { hasTouch: info.project.use.hasTouch, isMobile: info.project.use.isMobile });
  try {
    await Promise.all([enter(page, room.id), enter(guest, room.id), enter(watcher, room.id)]);
    await page.getByRole('button', { name: 'Reagir com emoji' }).click();
    const fire = page.getByRole('button', { name: 'Enviar 🔥' });
    await page.screenshot({ path: info.outputPath('bandeja.png') });
    await fire.click();
    for (const viewer of [page, guest, watcher]) {
      await expect(viewer.locator('.emoji-drop', { hasText: '🔥' })).toBeVisible();
      await expect(viewer.locator('.emoji-drop small')).toHaveText('Amigo da mesa');
    }
    await watcher.screenshot({ path: info.outputPath('emoji-caindo.png') });
    // A queda começa no topo e desce pela tela.
    const drop = guest.locator('.emoji-drop').first();
    const start = (await drop.boundingBox())!.y;
    await guest.waitForTimeout(500);
    expect((await drop.boundingBox())!.y).toBeGreaterThan(start + 20);
    await expect(fire).toBeDisabled();
    await expect(page.locator('.emoji-drop')).toHaveCount(1);
    await expect(fire).toBeEnabled({ timeout: 4000 });
    await fire.click();
    await expect(guest.locator('.emoji-drop')).not.toHaveCount(0);
    // Termina a queda e sai da tela.
    await expect(guest.locator('.emoji-drop')).toHaveCount(0, { timeout: 8000 });
  } finally { await close(); }
});

test('X1 de cara ou coroa trava o lado confirmado e mostra o resultado a todos', async ({ page, browser, baseURL }, info) => {
  test.setTimeout(60_000);
  const { room, guest, watcher, close } = await table(browser, page, baseURL!, page.viewportSize(), { hasTouch: info.project.use.hasTouch, isMobile: info.project.use.isMobile });
  try {
    await Promise.all([enter(page, room.id), enter(guest, room.id), enter(watcher, room.id)]);
    // O alvo do clique é o assento do adversário, em toda largura que usa esse layout.
    const seatButton = page.getByRole('button', { name: 'Desafiar Segundo amigo para um X1' });
    if (info.project.name === 'desktop') {
      const original = page.viewportSize()!;
      for (const width of [original.width, 900]) {
        await page.setViewportSize({ width, height: original.height });
        const seat = (await seatButton.locator('..').boundingBox())!;
        const area = (await seatButton.boundingBox())!;
        expect(Math.abs(area.width - seat.width), `largura em ${width}px`).toBeLessThan(3);
        expect(Math.abs(area.height - seat.height), `altura em ${width}px`).toBeLessThan(3);
      }
      await page.setViewportSize(original);
    }
    await seatButton.click();
    await page.screenshot({ path: info.outputPath('desafio.png') });
    await page.getByRole('button', { name: 'Desafiar', exact: true }).click();

    const own = page.getByRole('dialog', { name: 'X1 contra Segundo amigo' });
    const challenged = guest.getByRole('dialog', { name: 'X1 contra Amigo da mesa' });
    await expect(own).toBeVisible();
    await expect(challenged).toBeVisible();
    await expect(challenged).toContainText('Amigo da mesa desafiou você');
    await expect(watcher.getByRole('dialog')).toHaveCount(0);

    // A escolha só é pública depois de confirmar.
    await challenged.getByRole('button', { name: 'Cara', exact: true }).click();
    await own.getByRole('button', { name: 'Cara', exact: true }).click();
    await own.getByRole('button', { name: 'Confirmar Cara' }).click();
    await expect(own).toContainText('Você confirmou Cara');
    await page.screenshot({ path: info.outputPath('x1-confirmado.png') });

    // Quem confirmou antes fica com o lado, mesmo que o outro tenha clicado primeiro.
    await expect(challenged.getByRole('button', { name: 'Cara', exact: true })).toBeDisabled();
    await expect(challenged).toContainText('já confirmou Cara');
    await expect(challenged.getByRole('button', { name: 'Confirmar', exact: true })).toBeDisabled();
    await guest.screenshot({ path: info.outputPath('x1-lado-travado.png') });

    // Desconfirmar devolve o lado ao adversário.
    await own.getByRole('button', { name: 'Desconfirmar' }).click();
    await expect(challenged.getByRole('button', { name: 'Cara', exact: true })).toBeEnabled();
    await own.getByRole('button', { name: 'Coroa', exact: true }).click();
    await own.getByRole('button', { name: 'Confirmar Coroa' }).click();
    await expect(challenged.getByRole('button', { name: 'Coroa', exact: true })).toBeDisabled();

    await challenged.getByRole('button', { name: 'Cara', exact: true }).click();
    await challenged.getByRole('button', { name: 'Confirmar Cara' }).click();
    for (const viewer of [page, guest, watcher]) {
      const result = viewer.locator('.coin-duel-notice.is-result');
      await expect(result).toBeVisible();
      const text = await result.innerText();
      expect(text).toMatch(/DEU (CARA|COROA)/i);
      // A moeda é aleatória, mas o vencedor tem de ser quem escolheu aquele lado.
      expect(text).toContain(/DEU CARA/i.test(text) ? 'Segundo amigo venceu' : 'Amigo da mesa venceu');
    }
    await watcher.screenshot({ path: info.outputPath('x1-resultado.png') });
    await expect(own).toHaveCount(0);
    await expect(challenged).toHaveCount(0);
    await expect(watcher.locator('.coin-duel-notice')).toHaveCount(0, { timeout: 8000 });

    // Recusar avisa quem desafiou e libera os dois.
    await page.getByRole('button', { name: 'Desafiar Segundo amigo para um X1' }).click();
    await page.getByRole('button', { name: 'Desafiar', exact: true }).click();
    await challenged.getByRole('button', { name: 'Recusar', exact: true }).click();
    await expect(page.locator('.coin-duel-notice')).toHaveText('Segundo amigo recusou o X1.');
    await expect(own).toHaveCount(0);
  } finally { await close(); }
});

test('confirmar o mesmo lado ao mesmo tempo não sorteia e pede para um trocar', async ({ page, browser, baseURL }, info) => {
  test.setTimeout(60_000);
  const { room, guest, watcher, close } = await table(browser, page, baseURL!, page.viewportSize(), { hasTouch: info.project.use.hasTouch, isMobile: info.project.use.isMobile });
  try {
    // Atraso real: a conexão com o servidor é verdadeira, só a entrega ao convidado espera,
    // como quando os dois clicam antes de saberem da confirmação do outro.
    let held: (string | Buffer)[] | null = null;
    let deliver: (message: string | Buffer) => void = () => {};
    await guest.routeWebSocket(/\/live$/, socket => {
      const server = socket.connectToServer();
      deliver = message => socket.send(message);
      server.onMessage(message => { if (held) held.push(message); else socket.send(message); });
      socket.onMessage(message => server.send(message));
    });
    await Promise.all([enter(page, room.id), enter(guest, room.id), enter(watcher, room.id)]);
    await page.getByRole('button', { name: 'Desafiar Segundo amigo para um X1' }).click();
    await page.getByRole('button', { name: 'Desafiar', exact: true }).click();
    const own = page.getByRole('dialog', { name: 'X1 contra Segundo amigo' });
    const challenged = guest.getByRole('dialog', { name: 'X1 contra Amigo da mesa' });
    await expect(challenged).toBeVisible();
    await own.getByRole('button', { name: 'Cara', exact: true }).click();
    await challenged.getByRole('button', { name: 'Cara', exact: true }).click();

    held = [];
    await own.getByRole('button', { name: 'Confirmar Cara' }).click();
    await expect(own).toContainText('Você confirmou Cara');
    // O convidado ainda não soube: segue com Cara selecionada, e o botão fica livre.
    await expect(challenged.getByRole('button', { name: /^Cara/ })).toBeEnabled();
    await challenged.getByRole('button', { name: 'Confirmar Cara' }).click();
    await expect(own.getByRole('alert')).toContainText('Os dois confirmaram Cara');
    const pending: (string | Buffer)[] = held ?? [];
    held = null;
    expect(pending.length).toBeGreaterThan(0);
    pending.forEach(message => deliver(message));
    await expect(challenged.getByRole('alert')).toContainText('Os dois confirmaram Cara');
    await guest.screenshot({ path: info.outputPath('x1-conflito.png') });
    await expect(watcher.locator('.coin-duel-notice')).toHaveCount(0);

    await challenged.getByRole('button', { name: 'Desconfirmar' }).click();
    await expect(own.getByRole('alert')).toHaveCount(0);
    await expect(challenged.getByRole('button', { name: 'Cara', exact: true })).toBeDisabled();
    await challenged.getByRole('button', { name: 'Coroa', exact: true }).click();
    await challenged.getByRole('button', { name: 'Confirmar Coroa' }).click();
    await expect(watcher.locator('.coin-duel-notice.is-result')).toBeVisible();
  } finally { await close(); }
});

test('dados chegam pelo WebSocket, sem polling e sem enxurrada ao voltar', async ({ page, browser, baseURL }, info) => {
  test.setTimeout(60_000);
  const { room, guest, watcher, close } = await table(browser, page, baseURL!, page.viewportSize(), { hasTouch: info.project.use.hasTouch, isMobile: info.project.use.isMobile });
  const path = `/api/rooms/${room.id}`;
  try {
    // Só a visibilidade é simulada: o navegador sem interface não oculta abas sozinho.
    await guest.addInitScript(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (window as unknown as { hiddenTab?: boolean }).hiddenTab ? 'hidden' : 'visible' });
    });
    let polled = 0;
    guest.on('request', request => { if (request.method() === 'GET' && request.url().endsWith('/preparation')) polled += 1; });
    await Promise.all([enter(page, room.id), enter(guest, room.id), enter(watcher, room.id)]);

    // Ao vivo, a rolagem anima e entra no registro só quando o dado para.
    const register = (viewer: Page) => viewer.locator('.dice-register li');
    if (info.project.name !== 'desktop') await expect(guest.locator('.dice-surface')).toBeAttached();
    const countAt = Date.now();
    await throwDie(page, path, 1);
    await expect(register(guest)).toHaveCount(1, { timeout: 12_000 });
    expect(Date.now() - countAt, 'uma rolagem ao vivo passa pela animação').toBeGreaterThan(1000);
    await guest.waitForTimeout(2000);
    expect(polled, 'sem consultas periódicas').toBe(0);

    // Aba oculta: os dados entram direto no registro, nada fica guardado no motor.
    await guest.evaluate(() => { (window as unknown as { hiddenTab?: boolean }).hiddenTab = true; });
    for (const intent of [2, 3, 4]) await throwDie(page, path, intent);
    await expect(register(guest)).toHaveCount(4, { timeout: 800 });
    await guest.evaluate(() => { (window as unknown as { hiddenTab?: boolean }).hiddenTab = false; });

    // Navegador fechado: ao voltar, o histórico já está lá, sem nenhum dado no ar.
    await watcher.close();
    const context = await browser.newContext({ baseURL: baseURL!, viewport: page.viewportSize() ?? undefined, hasTouch: info.project.use.hasTouch, isMobile: info.project.use.isMobile });
    const back = await context.newPage();
    try {
      expect((await back.request.post('/api/session', { data: { login: 'amigo3', password } })).ok()).toBe(true);
      // Espaçadas, por causa do limite de cinco rolagens por segundo.
      await page.waitForTimeout(1100);
      for (const intent of [5, 6, 7, 8, 9]) { await throwDie(page, path, intent); await page.waitForTimeout(300); }
      await back.goto(`/#/salas/${room.id}`);
      await expect(register(back)).toHaveCount(9, { timeout: 2000 });
      // Sem animação, ninguém muda no canvas: um dado voando apareceria aqui.
      const painted = await back.locator('.dice-surface canvas').evaluate((canvas: HTMLCanvasElement) => {
        const context = canvas.getContext('2d');
        if (!context || !canvas.width || !canvas.height) return 0;
        return context.getImageData(0, 0, canvas.width, canvas.height).data.reduce((sum, value, index) => sum + (index % 4 === 3 ? value : 0), 0);
      });
      expect(painted).toBe(0);
    } finally { await context.close(); }
  } finally { await close(); }
});
