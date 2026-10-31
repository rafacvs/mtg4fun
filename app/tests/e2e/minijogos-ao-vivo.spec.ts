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

const rollButton = (page: Page) => page.getByRole('button', { name: /^Rolar d20$/ });

async function enter(page: Page, roomId: number) {
  await page.goto(`/#/salas/${roomId}`);
  await expect(rollButton(page)).toBeVisible();
}

// Rolagem de outro jogador pela API real; o gesto do botão é coberto em preparation-dice.spec.ts.
async function throwDie(page: Page, path: string, intent: number) {
  const response = await page.request.post(`${path}/preparation/actions`, { data: { kind: 'roll', intentId: `00000000-0000-4000-8000-${String(intent).padStart(12, '0')}` } });
  expect(response.ok(), await response.text()).toBe(true);
}

test('emoji cai na tela de todos, abre ao lado do botão e fica mais lento com o spam', async ({ page, browser, baseURL }, info) => {
  test.setTimeout(45_000);
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
    // A bandeja abre ao lado do botão, à esquerda dele no desktop, e não por cima.
    const toggle = (await page.getByRole('button', { name: 'Reagir com emoji' }).boundingBox())!;
    const tray = (await page.getByRole('group', { name: 'Escolha um emoji' }).boundingBox())!;
    if (info.project.name === 'desktop') expect(tray.x + tray.width).toBeLessThanOrEqual(toggle.x);
    else expect(tray.x).toBeGreaterThanOrEqual(toggle.x + toggle.width);
    expect(Math.abs(tray.y + tray.height / 2 - (toggle.y + toggle.height / 2))).toBeLessThan(3);
    expect(tray.x).toBeGreaterThanOrEqual(0);
    expect(tray.x + tray.width).toBeLessThanOrEqual(page.viewportSize()!.width);

    // Pode spamar: os primeiros cliques seguem fluidos e a espera vai crescendo.
    const sent = await page.evaluate(async () => {
      const button = [...document.querySelectorAll('button')].find(item => item.getAttribute('aria-label') === 'Enviar 🔥')!;
      const start = performance.now();
      const moments: number[] = [];
      let last = 0;
      // Clica o tempo todo; só conta o que o botão e a espera deixaram passar.
      const seen = new Set<Element>();
      const rain = document.querySelector('.emoji-rain')!;
      while (performance.now() - start < 3500) {
        button.click();
        for (const drop of rain.querySelectorAll('.emoji-drop')) if (!seen.has(drop)) { seen.add(drop); moments.push(performance.now() - start - last); last = performance.now() - start; }
        await new Promise(resolve => setTimeout(resolve, 30));
      }
      return moments;
    });
    expect(sent.length, `intervalos: ${sent.join(', ')}`).toBeGreaterThanOrEqual(5);
    const middle = Math.floor(sent.length / 2);
    const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
    expect(average(sent.slice(middle)), `intervalos: ${sent.join(', ')}`).toBeGreaterThan(average(sent.slice(1, middle)));
    await expect(page.getByRole('status').filter({ hasText: /Calma… \ds/ })).toBeVisible({ timeout: 6000 });
    await expect(fire).toBeDisabled();
    await expect(fire).toBeEnabled({ timeout: 4000 });
    // Os outros veem cair também.
    await expect(guest.locator('.emoji-drop').first()).toBeVisible();
    // Termina a queda e sai da tela.
    await expect(guest.locator('.emoji-drop')).toHaveCount(0, { timeout: 12_000 });
  } finally { await close(); }
});

async function invite(page: Page, guest: Page) {
  await page.getByRole('button', { name: 'Desafiar Segundo amigo para um X1' }).click();
  const menu = page.getByRole('dialog', { name: 'Desafiar Segundo amigo' });
  await expect(menu).toContainText('Quem perder fica marcado na mesa até a partida começar.');
  await menu.getByRole('button', { name: /Cara ou coroa/ }).click();
  const invitation = guest.getByRole('dialog', { name: 'Convite para um X1' });
  await expect(invitation).toContainText('Amigo da mesa te chamou pro x1 de cara ou coroa');
  await expect(page.getByRole('dialog', { name: 'Aguardando resposta do X1' })).toBeVisible();
  return invitation;
}

test('X1: convite, escolha em tempo real, lado travado e resultado para toda a mesa', async ({ page, browser, baseURL }, info) => {
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
        for (const axis of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(area[axis] - seat[axis]), `${axis} em ${width}px`).toBeLessThan(3);
      }
      await page.setViewportSize(original);
    }
    const invitation = await invite(page, guest);
    await expect(watcher.getByRole('dialog')).toHaveCount(0);
    await invitation.getByRole('button', { name: 'Aceitar' }).click();

    const own = page.getByRole('dialog', { name: 'X1 contra Segundo amigo' });
    const challenged = guest.getByRole('dialog', { name: 'X1 contra Amigo da mesa' });
    await expect(own).toBeVisible();
    await expect(challenged).toBeVisible();
    await expect(watcher.getByRole('dialog')).toHaveCount(0);
    const side = (dialog: typeof own, group: string, name: string) => dialog.getByRole('group', { name: group }).getByRole('button', { name, exact: true });

    // Cada um vê o que o outro escolheu antes de qualquer confirmação.
    await side(own, 'Escolha um lado', 'Cara').click();
    await expect(side(challenged, 'Lado de Amigo da mesa', 'Cara')).toHaveAttribute('aria-pressed', 'true');
    await expect(challenged).toContainText('escolheu Cara');
    // O mesmo lado bloqueia os dois até alguém trocar.
    await side(challenged, 'Escolha um lado', 'Cara').click();
    await expect(own.getByRole('alert')).toHaveText('Os dois querem Cara. Alguém vai ter que ceder.');
    await expect(challenged.getByRole('alert')).toHaveText('Os dois querem Cara. Alguém vai ter que ceder.');
    await expect(own.getByRole('button', { name: 'Escolham lados diferentes' })).toBeDisabled();
    await expect(watcher.locator('.duel-banner')).toHaveCount(0);

    await side(challenged, 'Escolha um lado', 'Coroa').click();
    await expect(own.getByRole('alert')).toHaveCount(0);
    await own.getByRole('button', { name: 'Confirmar Cara' }).click();
    // Quem confirmou fica com o lado; desconfirmar devolve a escolha.
    await expect(side(challenged, 'Escolha um lado', 'Cara')).toBeDisabled();
    await expect(challenged).toContainText('confirmou Cara');
    await own.getByRole('button', { name: 'Desconfirmar' }).click();
    await expect(side(challenged, 'Escolha um lado', 'Cara')).toBeEnabled();
    await own.getByRole('button', { name: 'Confirmar Cara' }).click();
    await challenged.getByRole('button', { name: 'Confirmar Coroa' }).click();

    // Só quem jogou vê a moeda cair; quem assiste recebe o anúncio.
    const banner = watcher.locator('.duel-banner');
    await expect(banner).toBeVisible();
    const text = await banner.innerText();
    const guestLost = /Segundo amigo perdeu pra uma moeda/i.test(text);
    expect(guestLost || /Amigo da mesa perdeu pra uma moeda/i.test(text)).toBe(true);
    await expect(banner).toContainText(guestLost ? 'Segundo amigo escolheu Coroa' : 'Amigo da mesa escolheu Cara');
    await expect(watcher.getByRole('dialog')).toHaveCount(0);
    for (const [viewer, name] of [[page, guestLost ? 'Venceu' : 'Perdeu'], [guest, guestLost ? 'Perdeu' : 'Venceu']] as const) {
      await expect(viewer.getByRole('region', { name: 'Sua escolha' }).locator('.duel-stamp')).toHaveText(name);
      await expect(viewer.locator('.duel-result-title')).toHaveText(/Deu (Cara|Coroa)!/);
    }
    // Depois volta para a mesa, com o anúncio, a marca e o registro.
    await expect(own).toHaveCount(0, { timeout: 8000 });
    await expect(page.locator('.duel-banner')).toBeVisible();
    const loser = guestLost ? 'Segundo amigo' : 'Amigo da mesa';
    const winner = guestLost ? 'Amigo da mesa' : 'Segundo amigo';
    await expect(watcher.locator('.preparation-duel-mark')).toHaveText('Perdeu no X1');
    await expect(watcher.locator('.dice-register-duel')).toContainText(`${loser} perdeu o x1 pra ${winner}`);
    // A marca continua para quem chega depois.
    await watcher.reload();
    await expect(watcher.locator('.preparation-duel-mark')).toHaveText('Perdeu no X1');
    await expect(watcher.locator('.dice-register-duel')).toHaveCount(1);
  } finally { await close(); }
});

test('X1: recusar e arregar marcam quem saiu; cancelar antes da resposta não marca', async ({ page, browser, baseURL }, info) => {
  test.setTimeout(60_000);
  const { room, guest, watcher, close } = await table(browser, page, baseURL!, page.viewportSize(), { hasTouch: info.project.use.hasTouch, isMobile: info.project.use.isMobile });
  try {
    await Promise.all([enter(page, room.id), enter(guest, room.id), enter(watcher, room.id)]);
    await invite(page, guest);
    await page.getByRole('dialog', { name: 'Aguardando resposta do X1' }).getByRole('button', { name: 'Cancelar' }).click();
    await expect(guest.getByRole('dialog')).toHaveCount(0);
    await expect(watcher.locator('.preparation-duel-mark')).toHaveCount(0);
    await expect(guest.locator('.coin-duel-notice')).toHaveText('Amigo da mesa cancelou o X1.');

    await (await invite(page, guest)).getByRole('button', { name: 'Recusar' }).click();
    await expect(watcher.locator('.preparation-duel-mark')).toHaveText('Recusou o X1');
    await expect(watcher.locator('.duel-banner')).toContainText('Segundo amigo recusou o X1.');
    await expect(watcher.locator('.dice-register-duel')).toContainText('Segundo amigo recusou o x1 de Amigo da mesa');

    await (await invite(page, guest)).getByRole('button', { name: 'Aceitar' }).click();
    await page.getByRole('dialog', { name: 'X1 contra Segundo amigo' }).getByRole('button', { name: 'Arregar (conta como derrota)' }).click();
    await expect(guest.getByRole('dialog')).toHaveCount(0);
    await expect(watcher.locator('.duel-banner')).toContainText('Amigo da mesa arregou.');
    await expect(watcher.locator('.preparation-duel-mark')).toHaveCount(2);
    await expect(watcher.locator('.dice-register-duel').last()).toContainText('Amigo da mesa arregou o x1 contra Segundo amigo');
  } finally { await close(); }
});

test('o dado acompanha o tamanho da mesa', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'A medida depende do layout de desktop.');
  test.setTimeout(45_000);
  expect((await page.request.post('/api/session', { data: { login: 'amigo', password } })).ok()).toBe(true);
  const { room } = await (await page.request.post('/api/rooms', { data: roomBody({ seats: 2 }) })).json();
  const path = `/api/rooms/${room.id}`;
  // O número do dado é desenhado em proporção ao raio; é o que o motor pede ao canvas.
  await page.addInitScript(() => {
    const original = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'font')!;
    const sizes: number[] = [];
    (window as unknown as { dieFonts: number[] }).dieFonts = sizes;
    Object.defineProperty(CanvasRenderingContext2D.prototype, 'font', {
      get() { return original.get!.call(this); },
      set(value: string) { const size = /^700 ([\d.]+)px Cinzel/.exec(value); if (size) sizes.push(Number(size[1])); original.set!.call(this, value); },
    });
  });
  async function dieFont(width: number, intent: number) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/#/salas/${room.id}`);
    await page.reload();
    await expect(rollButton(page)).toBeVisible();
    await page.waitForTimeout(400);
    const count = await page.locator('.dice-register li').count();
    await throwDie(page, path, intent);
    await expect(page.locator('.dice-register li')).toHaveCount(count + 1, { timeout: 12_000 });
    return page.evaluate(() => {
      const sizes = [...(window as unknown as { dieFonts: number[] }).dieFonts].sort((a, b) => a - b);
      return sizes[Math.floor(sizes.length / 2)];
    });
  }
  const wide = await dieFont(1600, 21);
  const narrow = await dieFont(860, 22);
  expect(wide).toBeGreaterThan(0);
  expect(narrow / wide, `fonte de ${narrow} px contra ${wide} px`).toBeLessThan(0.7);
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
