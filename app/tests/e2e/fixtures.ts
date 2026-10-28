import { test as base, expect, type APIRequestContext, type Page, type Locator } from '@playwright/test';
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

export const test = base.extend<{}, { appURL: string }>({
  appURL: [async ({}, use) => {
    if (process.env.E2E_BASE_URL) { await use(process.env.E2E_BASE_URL); return; }
    const directory = mkdtempSync(join(tmpdir(), 'mtg4fun-browser-'));
    let server: ChildProcess | undefined;
    let container: string | undefined;
    try {
      const executable = join(directory, 'mtg4fun');
      const database = JSON.parse(execFileSync('python3', [join(root, 'scripts/test-mysql.py')], { encoding: 'utf8', timeout: 420_000 })) as Record<string, string>;
      container = database.container;
      const environment = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('DB_'))), ...Object.fromEntries(Object.entries(database).filter(([key]) => key.startsWith('DB_'))), COOKIE_SECURE: 'false', IMAGE_CACHE: join(directory, 'images') };
      execFileSync('go', ['build', '-o', executable, './cmd/mtg4fun'], { cwd: join(root, 'api') });
      execFileSync(executable, ['migrate', 'up'], { env: environment });
      execFileSync(executable, ['create-user', '--login', 'amigo', '--name', 'Amigo da mesa', '--password', 'senha-do-navegador'], { env: environment });
      execFileSync(executable, ['create-user', '--login', 'homonimo', '--name', 'Amigo da mesa', '--password', 'senha-do-navegador'], { env: environment });
      execFileSync(executable, ['create-user', '--login', 'segundo', '--name', 'Segundo amigo', '--password', 'senha-do-navegador'], { env: environment });
      for (let index = 3; index <= 6; index += 1) {
        execFileSync(executable, ['create-user', '--login', `amigo${index}`, '--name', `Amigo ${index}`, '--password', 'senha-do-navegador'], { env: environment });
      }
      server = spawn(executable, ['serve', '--addr', '127.0.0.1:0', '--web', join(root, 'app/dist'), '--cards', join(root, 'api/tests/integration/testdata/cards.xml'), '--tokens', join(root, 'api/tests/integration/testdata/tokens.xml')], { env: environment, stdio: ['ignore', 'ignore', 'pipe'] });
      const address = await new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Servidor não iniciou')), 10_000);
        let output = '';
        server!.stderr!.on('data', chunk => {
          output += chunk.toString();
          const match = output.match(/HTTP ouvindo em (127\.0\.0\.1:\d+)/);
          if (match) { clearTimeout(timeout); resolve(`http://${match[1]}`); }
        });
        server!.once('error', error => { clearTimeout(timeout); reject(error); });
        server!.once('exit', code => { clearTimeout(timeout); reject(new Error(`Servidor encerrou (${code}): ${output}`)); });
      });
      await use(address);
    } finally {
      if (server && server.exitCode === null && server.signalCode === null) {
        const exited = once(server, 'exit');
        const timeout = setTimeout(() => server!.kill('SIGKILL'), 12_000);
        server.kill('SIGTERM');
        await exited;
        clearTimeout(timeout);
      }
      if (container) execFileSync('docker', ['rm', '-f', '-v', container]);
      rmSync(directory, { recursive: true, force: true });
    }
  }, { scope: 'worker', timeout: 420_000 }],
  baseURL: async ({ appURL }, use) => { await use(appURL); },
});

export function roomBody(overrides: Partial<{ name: string; format: string; seats: number; life: number; deckId: number }> = {}) {
  return { name: 'Mesa de teste', format: 'Commander', seats: 6, life: 40, ...overrides };
}

export { expect };

// The panels are controlled by their own tabs; compact screens show one at a time.
export async function openMatchRail(page: Page, panel = 'Jogadores') {
  await expect(page.locator('.own-dock')).toBeAttached();
  if ((page.viewportSize()?.width ?? 1280) > 1000 && panel === 'Registro') {
    const chronicle = page.getByRole('button', { name: 'Abrir crônica', exact: true });
    await expect(chronicle).toBeVisible();
    await chronicle.click();
    return;
  }
  if ((page.viewportSize()?.width ?? 1280) <= 1000 && !await page.locator('#match-rail').isVisible()) {
    await openQuickActions(page);
    await page.getByRole('button', { name: 'Informações', exact: true }).click();
  }
  const tab = page.getByRole('button', { name: panel, exact: true });
  await expect(tab).toBeVisible();
  if (await tab.getAttribute('aria-expanded') === 'false') await tab.click();
}

export async function closeMatchRail(page: Page) {
  if ((page.viewportSize()?.width ?? 1280) > 1000) {
    const chronicle = page.getByRole('button', { name: 'Fechar crônica', exact: true });
    if (await chronicle.isVisible()) await chronicle.click();
    return;
  }
  if ((page.viewportSize()?.width ?? 1280) <= 1000) {
    const close = page.getByRole('button', { name: 'Fechar informações', exact: true });
    if (await close.isVisible()) await close.click();
    return;
  }
  for (const label of ['Prévia', 'Jogadores', 'Registro']) {
    const tab = page.getByRole('button', { name: label, exact: true });
    if (await tab.getAttribute('aria-expanded') === 'true') await tab.click();
  }
}

export async function openHand(page: Page) {
  await expect(page.locator('.own-dock')).toBeAttached();
  await expect(page.getByRole('region', { name: 'Mão', exact: true })).toBeVisible();
}

export async function closeHand(page: Page) {
  // The hand is deliberately persistent; there is no hidden dock to reopen.
  await expect(page.getByRole('region', { name: 'Mão', exact: true })).toBeVisible();
}

export async function openQuickActions(page: Page) {
  await expect(page.locator('.own-dock')).toBeAttached();
  if ((page.viewportSize()?.width ?? 1280) > 1000) {
    await expect(page.getByRole('button', { name: 'Comandos', exact: true })).toHaveCount(0);
    return;
  }
  const toggle = page.getByRole('navigation', { name: 'Controles da mesa', exact: true }).getByRole('button', { name: 'Comandos', exact: true });
  await expect(toggle).toBeVisible();
  if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
}

export async function closeQuickActions(page: Page) {
  if ((page.viewportSize()?.width ?? 1280) > 1000) return;
  const toggle = page.getByRole('navigation', { name: 'Controles da mesa', exact: true }).getByRole('button', { name: 'Comandos', exact: true });
  if (await toggle.isVisible() && await toggle.getAttribute('aria-expanded') === 'true') await page.getByRole('button', { name: 'Fechar comandos', exact: true }).click();
}

export async function returnOpeningHandToLibrary(request: APIRequestContext, roomId: number) {
  const { match } = await (await request.get(`/api/rooms/${roomId}/match`)).json();
  const player = match.players.find((item: { userId: number }) => item.userId === match.viewerId);
  const ids = (player.hand ?? []).map((card: { id: string }) => card.id);
  if (ids.length === 0) return;
  const result = await request.post(`/api/rooms/${roomId}/match/actions`, {
    data: { intentId: crypto.randomUUID(), kind: 'move', cardIds: ids, to: 'library', libraryPlacement: 'bottom' },
  });
  expect(result.ok(), await result.text()).toBe(true);
}

export async function openLibrary(page: Page) {
  const library = page.getByRole('dialog', { name: 'Grimório', exact: true });
  if (!await library.isVisible()) {
    const pile = page.getByRole('button', { name: 'Abrir ações do grimório', exact: true });
    if (await pile.isVisible()) await pile.click();
    else { await openQuickActions(page); await page.getByRole('button', { name: 'Grimório', exact: true }).click(); }
  }
  await expect(library).toBeVisible();
  return library;
}

export async function openGameActions(page: Page) {
  const actions = page.getByRole('dialog', { name: 'Ações do jogo', exact: true });
  if (!await actions.isVisible()) { await openQuickActions(page); await page.getByRole('button', { name: 'Ações', exact: true }).click(); }
  await expect(actions).toBeVisible();
  return actions;
}

export async function selectFieldArea(page: Page, field: Locator) {
  const area = await field.locator('[data-battlefield-canvas]').evaluate(canvas => {
    const cards = [...canvas.querySelectorAll<HTMLElement>('.playing-card')].map(card => card.getBoundingClientRect());
    const left = Math.min(...cards.map(card => card.left));
    const right = Math.max(...cards.map(card => card.right));
    const top = Math.min(...cards.map(card => card.top));
    const bottom = Math.max(...cards.map(card => card.bottom));
    const candidates = [
      { x: left - 4, y: top + 4, endX: right + 4, endY: bottom + 4 },
      { x: right + 4, y: top + 4, endX: left - 4, endY: bottom + 4 },
      { x: left - 4, y: bottom + 4, endX: right + 4, endY: top - 4 },
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
}

// A normal click opens the card inspection directly.
export async function inspectCard(page: Page, card: Locator) {
  await card.click();
  await expect(page.locator('.card-preview[role="dialog"]')).toBeVisible();
}
