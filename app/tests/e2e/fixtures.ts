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
    const directory = mkdtempSync(join(tmpdir(), 'mtg4fun-browser-'));
    let server: ChildProcess | undefined;
    try {
      const executable = join(directory, 'mtg4fun');
      const database = join(directory, 'contas.db');
      execFileSync('go', ['build', '-o', executable, './cmd/mtg4fun'], { cwd: join(root, 'api') });
      execFileSync(executable, ['create-user', '--db', database, '--login', 'amigo', '--name', 'Amigo da mesa', '--password', 'senha-do-navegador']);
      server = spawn(executable, ['serve', '--db', database, '--addr', '127.0.0.1:0', '--web', join(root, 'app/dist')], { env: { ...process.env, COOKIE_SECURE: 'false' }, stdio: ['ignore', 'ignore', 'pipe'] });
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
      rmSync(directory, { recursive: true, force: true });
    }
  }, { scope: 'worker' }],
  baseURL: async ({ appURL }, use) => { await use(appURL); },
});

export { expect };
