import { test as base, expect } from '@playwright/test';
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
      const environment = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('DB_'))), ...Object.fromEntries(Object.entries(database).filter(([key]) => key.startsWith('DB_'))), COOKIE_SECURE: 'false' };
      execFileSync('go', ['build', '-o', executable, './cmd/mtg4fun'], { cwd: join(root, 'api') });
      execFileSync(executable, ['create-user', '--login', 'amigo', '--name', 'Amigo da mesa', '--password', 'senha-do-navegador'], { env: environment });
      server = spawn(executable, ['serve', '--addr', '127.0.0.1:0', '--web', join(root, 'app/dist')], { env: environment, stdio: ['ignore', 'ignore', 'pipe'] });
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

export { expect };
