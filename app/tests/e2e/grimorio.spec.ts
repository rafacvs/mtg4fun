import { test, expect } from './fixtures';
import type { Browser, BrowserContext, Locator, TestInfo } from '@playwright/test';

async function prepare(browser: Browser, baseURL: string | undefined, info: TestInfo) {
  const contexts: BrowserContext[] = [];
  let roomId = 0;
  try {
    for (const login of ['amigo', 'segundo']) {
      const context = await browser.newContext({
        baseURL,
        viewport: info.project.use.viewport,
        isMobile: info.project.use.isMobile,
        hasTouch: info.project.use.hasTouch,
      });
      contexts.push(context);
      const api = context.request;
      expect(
        (await api.post('/api/session', { data: { login, password: 'senha-do-navegador' } })).ok(),
      ).toBe(true);
      const uploaded = await api.post('/api/decks', {
        multipart: {
          file: {
            name: 'grimorio.cod',
            mimeType: 'application/xml',
            buffer: Buffer.from(
              '<cockatrice_deck version="1"><deckname>Grimório</deckname><zone name="main"><card number="1" name="Fire // Ice"/><card number="1" name="Island"/><card number="1" name="Urza\'s Saga"/></zone></cockatrice_deck>',
            ),
          },
        },
      });
      expect(uploaded.status()).toBe(201);
      const { deck } = await uploaded.json();
      if (!roomId) roomId = (await (await api.post('/api/rooms', { data: {} })).json()).room.id;
      else
        expect((await api.post(`/api/rooms/${roomId}/participants`, { data: {} })).ok()).toBe(true);
      expect(
        (
          await api.put(`/api/rooms/${roomId}/participants/me/ready`, { data: { deckId: deck.id } })
        ).ok(),
      ).toBe(true);
    }
    expect(
      (await contexts[0].request.post(`/api/rooms/${roomId}/start`, { data: {} })).status(),
    ).toBe(201);
    const own = await contexts[0].newPage();
    const opponent = await contexts[1].newPage();
    if (info.project.name === 'celular-horizontal') {
      await own.setViewportSize({ width: 844, height: 390 });
      await opponent.setViewportSize({ width: 844, height: 390 });
    }
    await own.goto(`/#/salas/${roomId}`);
    await opponent.goto(`/#/salas/${roomId}`);
    const activate = async (button: Locator) =>
      info.project.use.hasTouch ? button.tap() : button.click();
    const library = own.getByRole('dialog', { name: 'Grimório', exact: true });
    const open = () => activate(own.getByRole('button', { name: 'Grimório', exact: true }));
    const readOwn = async () => {
      const { match } = await (await contexts[0].request.get(`/api/rooms/${roomId}/match`)).json();
      return match.players.find((player: { userId: number }) => player.userId === match.viewerId);
    };
    return { contexts, own, opponent, library, activate, open, readOwn, roomId };
  } catch (reason) {
    await Promise.all(contexts.map((context) => context.close()));
    throw reason;
  }
}

test('embaralha diretamente e busca o comandante selecionando somente resultados', async ({
  browser,
  baseURL,
}, info) => {
  test.skip(info.project.name === 'celular', 'a partida bloqueia orientação vertical');
  const game = await prepare(browser, baseURL, info);
  const { own, opponent, library, activate, open, readOwn } = game;
  try {
    await activate(own.getByRole('button', { name: 'Abrir ações do grimório' }));
    await expect(library).toBeVisible();
    await own.screenshot({ path: info.outputPath('grimorio-menu.png') });
    await activate(library.getByRole('button', { name: /^Embaralhar/ }));
    await expect(library.getByRole('status')).toHaveText('Grimório embaralhado.');
    expect((await readOwn()).libraryCount).toBe(3);
    const log = own.getByRole('region', { name: 'Registro da partida' });
    await expect(log).toContainText('embaralhou o grimório');
    await expect(log).not.toContainText('consultou');
    await activate(own.getByRole('button', { name: 'Ações', exact: true }));
    await expect(library).toHaveCount(0);
    await activate(own.getByRole('button', { name: 'Embaralhar grimório', exact: true }));
    await expect(own.getByRole('dialog', { name: 'Ações do jogo' })).toHaveCount(0);
    await open();
    await activate(library.getByRole('button', { name: /^Buscar no grimório/ }));
    await library.getByLabel('Buscar no grimório').fill('Fire');
    await expect(library.locator('.library-card')).toHaveCount(1);
    await activate(library.getByRole('button', { name: 'Selecionar resultados', exact: true }));
    await expect(library.locator('.library-selection')).toContainText('1 selecionada');
    await library.getByLabel('Outros destinos').selectOption('command');
    await expect(library.locator('.library-card')).toHaveCount(0);
    expect((await readOwn()).command).toHaveLength(1);
    await activate(library.getByRole('button', { name: 'Devolver e embaralhar', exact: true }));
    await expect(library.getByRole('button', { name: /^Buscar no grimório/ })).toBeVisible();
    await activate(
      opponent
        .getByRole('navigation', { name: 'Foco da mesa' })
        .getByRole('button', { name: /Amigo da mesa/ }),
    );
    await expect(
      opponent
        .getByRole('article', { name: 'Mesa de Amigo da mesa', exact: true })
        .getByRole('region', { name: 'Comando', exact: true })
        .getByRole('button', { name: 'Fire // Ice', exact: true }),
    ).toBeVisible();
    expect((await readOwn()).libraryCount).toBe(2);
  } finally {
    await Promise.all(game.contexts.map((context) => context.close()));
  }
});

test('reordena, recolhe e retoma a consulta, devolvendo ao topo e ao fundo', async ({
  browser,
  baseURL,
}, info) => {
  test.skip(info.project.name === 'celular', 'a partida bloqueia orientação vertical');
  const game = await prepare(browser, baseURL, info);
  const { own, opponent, library, activate, open, readOwn } = game;
  try {
    await open();
    await activate(library.getByRole('button', { name: /^Olhar cartas/ }));
    await library.getByLabel('Quantidade de cartas').fill('3');
    await activate(library.getByRole('button', { name: 'Olhar 3 carta(s)', exact: true }));
    await expect(library.locator('.library-card')).toHaveCount(3);
    await expect(library).toContainText('Só você vê estas cartas');
    const original = (await readOwn()).consulted as { id: string; name: string }[];
    const rows = library.locator('.library-card');
    if (info.project.use.hasTouch)
      await activate(rows.nth(1).getByRole('button', { name: /^Antecipar / }));
    else await rows.nth(1).dragTo(rows.nth(0));
    const reordered = [original[1].id, original[0].id, original[2].id];
    await expect
      .poll(async () => (await readOwn()).consulted.map((card: { id: string }) => card.id))
      .toEqual(reordered);
    await activate(
      library.getByRole('button', { name: `Selecionar ${original[1].name}`, exact: true }),
    );
    await expect(library.locator('.library-selection')).toBeVisible();
    await own.screenshot({ path: info.outputPath('grimorio-consulta.png') });
    const box = (await library.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(own.viewportSize()!.height);
    const footer = (await library.locator('.library-finish').boundingBox())!;
    expect(footer.y + footer.height).toBeLessThanOrEqual(box.y + box.height);
    await activate(library.getByRole('button', { name: 'Fechar painel do grimório' }));
    await expect(own.getByText('Consulta em andamento')).toBeVisible();
    await expect(opponent.getByRole('region', { name: 'Registro da partida' })).toContainText(
      'consultou o grimório',
    );
    for (const card of original)
      await expect(opponent.locator('body')).not.toContainText(card.name);
    await own.reload();
    await open();
    await expect(library.locator('.library-card')).toHaveCount(3);
    await library.getByLabel('Destino das restantes').selectOption('bottom');
    await activate(library.getByRole('button', { name: 'Devolver sem embaralhar', exact: true }));
    await expect(library.getByRole('button', { name: /^Olhar cartas/ })).toBeVisible();
    await activate(library.getByRole('button', { name: /^Olhar cartas/ }));
    await library.getByLabel('De onde').selectOption('bottom');
    await library.getByLabel('Quantidade de cartas').fill('3');
    await activate(library.getByRole('button', { name: 'Olhar 3 carta(s)', exact: true }));
    await expect
      .poll(async () => (await readOwn()).consulted.map((card: { id: string }) => card.id))
      .toEqual(reordered);
    await library.getByLabel('Destino das restantes').selectOption('top');
    await activate(library.getByRole('button', { name: 'Devolver sem embaralhar', exact: true }));
    await expect(own.getByRole('region', { name: 'Registro da partida' })).not.toContainText(
      'embaralhou',
    );
    await expect(own.getByText('Consulta em andamento')).toHaveCount(0);
  } finally {
    await Promise.all(game.contexts.map((context) => context.close()));
  }
});

test('revela apenas a seleção e finaliza cartas públicas sem expor a mão', async ({
  browser,
  baseURL,
}, info) => {
  test.skip(info.project.name === 'celular', 'a partida bloqueia orientação vertical');
  const game = await prepare(browser, baseURL, info);
  const { own, opponent, library, activate, open, readOwn } = game;
  try {
    await open();
    await activate(library.getByRole('button', { name: /^Buscar no grimório/ }));
    await library.getByLabel('Buscar no grimório').fill('Fire');
    await activate(library.getByRole('button', { name: 'Selecionar Fire // Ice', exact: true }));
    await activate(library.getByRole('button', { name: 'Revelar seleção', exact: true }));
    await activate(
      opponent
        .getByRole('navigation', { name: 'Foco da mesa' })
        .getByRole('button', { name: /Amigo da mesa/ }),
    );
    const publicArea = opponent.getByRole('region', {
      name: 'Cartas reveladas de Amigo da mesa',
      exact: true,
    });
    await expect(
      publicArea.getByRole('button', { name: 'Fire // Ice', exact: true }),
    ).toBeVisible();
    await expect(publicArea.getByRole('button')).toHaveCount(1);
    await expect(library).toContainText('1 carta(s) visível(is) para todos');
    await library.getByLabel('Buscar no grimório').fill('');
    await expect(library.locator('.library-card')).toHaveCount(3);
    await library.getByLabel('Buscar no grimório').fill('Fire');
    await activate(library.getByRole('button', { name: 'Selecionar Fire // Ice', exact: true }));
    await activate(library.getByRole('button', { name: 'Colocar 1 na mão', exact: true }));
    await expect(publicArea).toHaveCount(0);
    expect((await readOwn()).hand[0].name).toBe('Fire // Ice');
    await activate(library.getByRole('button', { name: 'Devolver sem embaralhar', exact: true }));
    await activate(library.getByRole('button', { name: /^Revelar cartas/ }));
    await library.getByLabel('Quantidade de cartas').fill('2');
    await activate(library.getByRole('button', { name: 'Revelar 2 carta(s)', exact: true }));
    await expect(publicArea.getByRole('button')).toHaveCount(2);
    await expect(library.getByRole('heading', { name: 'Cartas reveladas' })).toBeVisible();
    await library.getByLabel('Destino das restantes').selectOption('bottom');
    await activate(library.getByRole('button', { name: 'Devolver sem embaralhar', exact: true }));
    await expect(publicArea).toHaveCount(0);
    expect((await readOwn()).libraryCount).toBe(2);
    await activate(library.getByRole('button', { name: /^Comprar cartas/ }));
    await library.getByLabel('Quantidade de cartas').fill('1');
    await activate(library.getByRole('button', { name: 'Comprar 1 carta(s)', exact: true }));
    await expect.poll(async () => (await readOwn()).handCount).toBe(2);
  } finally {
    await Promise.all(game.contexts.map((context) => context.close()));
  }
});

test('recupera a confirmação perdida no painel sem aplicar a consulta duas vezes', async ({
  browser,
  baseURL,
}, info) => {
  test.skip(info.project.name === 'celular', 'a partida bloqueia orientação vertical');
  const game = await prepare(browser, baseURL, info);
  const { own, library, activate, open, readOwn } = game;
  try {
    let lost = 0;
    await own.route('**/match/actions', async (route) => {
      if (lost < 2) {
        lost++;
        const response = await route.fetch();
        expect(response.ok()).toBe(true);
        await route.abort();
      } else await route.continue();
    });
    await open();
    await activate(library.getByRole('button', { name: /^Olhar cartas/ }));
    await library.getByLabel('De onde').selectOption('bottom');
    await library.getByLabel('Quantidade de cartas').fill('2');
    await activate(library.getByRole('button', { name: 'Olhar 2 carta(s)', exact: true }));
    const retry = library.getByRole('button', { name: 'Tentar novamente', exact: true });
    await expect(retry).toBeVisible();
    await activate(retry);
    await expect(library.getByRole('alert')).toHaveCount(0);
    await expect(library.locator('.library-card')).toHaveCount(2);
    expect((await readOwn()).libraryCount).toBe(1);
    await expect(library.getByLabel('Destino das restantes')).toHaveValue('bottom');
    const { match } = await (
      await game.contexts[0].request.get(`/api/rooms/${game.roomId}/match`)
    ).json();
    expect(match.log.filter((entry: { kind: string }) => entry.kind === 'consult')).toHaveLength(1);
    await activate(library.getByRole('button', { name: 'Devolver sem embaralhar', exact: true }));
    await expect.poll(async () => (await readOwn()).libraryCount).toBe(3);
  } finally {
    await Promise.all(game.contexts.map((context) => context.close()));
  }
});
