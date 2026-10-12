import { test, expect } from './fixtures';
import type { Browser, BrowserContext, Locator, Page, TestInfo } from '@playwright/test';

async function expectVerticalList(library: Locator) {
  const list = library.locator('.library-cards');
  const rows = list.locator('.library-card');
  const first = (await rows.first().boundingBox())!;
  let previous = first;
  for (let index = 1; index < (await rows.count()); index++) {
    const next = (await rows.nth(index).boundingBox())!;
    expect(Math.abs(next.x - first.x)).toBeLessThanOrEqual(1);
    expect(next.y).toBeGreaterThanOrEqual(previous.y + previous.height);
    previous = next;
  }
  expect(await list.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
}

async function dragCard(
  page: Page,
  source: Locator,
  target: Locator,
  touch: boolean,
  cancel = false,
) {
  const from = (await source.boundingBox())!;
  const to = (await target.boundingBox())!;
  const start = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
  const end = { x: to.x + to.width / 2, y: to.y + to.height / 2 };
  if (touch) {
    const session = await page.context().newCDPSession(page);
    try {
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
      for (let step = 1; step <= 8; step++) {
        await session.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [
            {
              x: start.x + ((end.x - start.x) * step) / 8,
              y: start.y + ((end.y - start.y) * step) / 8,
            },
          ],
        });
      }
      await expect(source.locator('..')).toHaveClass(/dragging/);
      await expect(target).toHaveClass(/drag-target/);
      await session.send('Input.dispatchTouchEvent', {
        type: cancel ? 'touchCancel' : 'touchEnd',
        touchPoints: [],
      });
    } finally {
      await session.detach();
    }
  } else {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 8 });
    await expect(source.locator('..')).toHaveClass(/dragging/);
    await expect(target).toHaveClass(/drag-target/);
    await page.mouse.up();
  }
}

async function prepare(browser: Browser, baseURL: string | undefined, info: TestInfo, islands = 1) {
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
              `<cockatrice_deck version="1"><deckname>Grimório</deckname><zone name="main"><card number="1" name="Fire // Ice"/><card number="${islands}" name="Island"/><card number="1" name="Urza's Saga"/></zone></cockatrice_deck>`,
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
    await expectVerticalList(library);
    const original = (await readOwn()).consulted as { id: string; name: string }[];
    const rows = library.locator('.library-card');
    await expect(
      library.getByRole('button', { name: /^(Antecipar|Adiar|Ampliar|Selecionar .*\/\/)/ }),
    ).toHaveCount(0);
    await activate(rows.nth(1).getByRole('button', { name: /^Ver imagem de / }));
    const preview = own.getByRole('dialog', { name: `Imagem de ${original[1].name}`, exact: true });
    await expect(preview).toBeVisible();
    await activate(preview.getByRole('button', { name: 'Fechar', exact: true }));
    await expect(library.locator('.library-selection')).toHaveCount(0);
    const handle = rows.nth(1).getByRole('button', { name: /^Reordenar / });
    const gripBox = (await handle.boundingBox())!;
    const imageBox = (await rows.nth(1).locator('.library-image').boundingBox())!;
    expect(gripBox.x + gripBox.width).toBeLessThanOrEqual(imageBox.x);
    if (info.project.use.hasTouch) {
      await dragCard(own, handle, rows.nth(0), true, true);
      expect((await readOwn()).consulted.map((card: { id: string }) => card.id)).toEqual(
        original.map((card) => card.id),
      );
      await expect(library.locator('.dragging, .drag-target')).toHaveCount(0);
    }
    await dragCard(own, handle, rows.nth(0), !!info.project.use.hasTouch);
    const reordered = [original[1].id, original[0].id, original[2].id];
    await expect
      .poll(async () => (await readOwn()).consulted.map((card: { id: string }) => card.id))
      .toEqual(reordered);
    await expect(library.locator('.library-selection')).toHaveCount(0);
    await expect(rows.nth(0)).toHaveAttribute('aria-disabled', 'false');
    await activate(rows.nth(0).locator('strong'));
    await expect(library.locator('.library-selection')).toBeVisible();
    await expect(rows.nth(0)).toHaveClass(/selected/);
    await activate(rows.nth(0).locator('strong'));
    await expect(library.locator('.library-selection')).toHaveCount(0);
    await activate(rows.nth(0).locator('strong'));
    await expect(library.locator('.library-selection')).toBeVisible();
    await rows.nth(0).focus();
    await rows.nth(0).press('Space');
    await expect(library.locator('.library-selection')).toHaveCount(0);
    await rows.nth(0).press('Enter');
    await expect(library.locator('.library-selection')).toBeVisible();
    await rows
      .nth(0)
      .getByRole('button', { name: /^Reordenar / })
      .press('ArrowDown');
    await expect
      .poll(async () => (await readOwn()).consulted.map((card: { id: string }) => card.id))
      .toEqual(original.map((card) => card.id));
    await expect(rows.nth(1)).toHaveAttribute('aria-disabled', 'false');
    await rows
      .nth(1)
      .getByRole('button', { name: /^Reordenar / })
      .press('ArrowUp');
    await expect
      .poll(async () => (await readOwn()).consulted.map((card: { id: string }) => card.id))
      .toEqual(reordered);
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

test('a alça rola a consulta para reordenar até uma carta inicialmente fora da tela', async ({
  browser,
  baseURL,
}, info) => {
  test.skip(info.project.name === 'celular', 'a partida bloqueia orientação vertical');
  const game = await prepare(browser, baseURL, info, 10);
  const { own, library, activate, open, readOwn } = game;
  const session = info.project.use.hasTouch ? await own.context().newCDPSession(own) : null;
  try {
    await open();
    await activate(library.getByRole('button', { name: /^Olhar cartas/ }));
    await library.getByLabel('Quantidade de cartas').fill('12');
    await activate(library.getByRole('button', { name: 'Olhar 12 carta(s)', exact: true }));
    const original = (await readOwn()).consulted as { id: string }[];
    const rows = library.locator('.library-card');
    await expect(rows).toHaveCount(12);
    await expectVerticalList(library);
    const list = library.locator('.library-cards');
    const bounds = (await list.boundingBox())!;
    const grip = (await rows.first().locator('.library-drag-handle').boundingBox())!;
    const start = { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 };
    const edge = { x: start.x, y: bounds.y + bounds.height - 10 };
    expect((await rows.last().boundingBox())!.y).toBeGreaterThan(bounds.y + bounds.height);
    if (session) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [edge] });
    } else {
      await own.mouse.move(start.x, start.y);
      await own.mouse.down();
      await own.mouse.move(edge.x, edge.y, { steps: 8 });
    }
    await expect
      .poll(
        async () => {
          const last = (await rows.last().boundingBox())!;
          return last.y + last.height;
        },
        { timeout: 8000 },
      )
      .toBeLessThanOrEqual(bounds.y + bounds.height);
    const last = (await rows.last().boundingBox())!;
    const end = { x: last.x + last.width / 2, y: last.y + last.height / 2 };
    if (session) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [end] });
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await own.mouse.move(end.x, end.y);
      await own.mouse.up();
    }
    await expect
      .poll(async () => (await readOwn()).consulted.map((card: { id: string }) => card.id))
      .toEqual([...original.slice(1).map((card) => card.id), original[0].id]);
    await expect(library.locator('.library-selection')).toHaveCount(0);
    await expect(library.locator('.dragging, .drag-target')).toHaveCount(0);
  } finally {
    await session?.detach();
    await Promise.all(game.contexts.map((context) => context.close()));
  }
});

test('revela apenas a seleção e preserva exposição ao mover e devolver', async ({
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
    await activate(
      library.locator('.library-card strong').getByText('Fire // Ice', { exact: true }),
    );
    const selectedRow = library.locator('.library-card.selected');
    await expect(selectedRow).toBeVisible();
    const rowBox = (await selectedRow.boundingBox())!;
    const markBox = (await selectedRow.locator('.library-selected-mark').boundingBox())!;
    expect(
      Math.abs(markBox.y + markBox.height / 2 - (rowBox.y + rowBox.height / 2)),
    ).toBeLessThanOrEqual(1);
    expect(rowBox.x + rowBox.width - (markBox.x + markBox.width)).toBeGreaterThanOrEqual(16);
    await own.screenshot({ path: info.outputPath('grimorio-selecao-centralizada.png') });
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
    await expectVerticalList(library);
    await library.getByLabel('Buscar no grimório').fill('Fire');
    await activate(
      library.locator('.library-card strong').getByText('Fire // Ice', { exact: true }),
    );
    await activate(library.getByRole('button', { name: 'Colocar 1 na mão', exact: true }));
    await expect(publicArea.getByRole('button')).toHaveCount(1);
    expect((await readOwn()).hand[0].name).toBe('Fire // Ice');
    await activate(library.getByRole('button', { name: 'Devolver sem embaralhar', exact: true }));
    await activate(library.getByRole('button', { name: /^Revelar cartas/ }));
    await library.getByLabel('Quantidade de cartas').fill('2');
    await activate(library.getByRole('button', { name: 'Revelar 2 carta(s)', exact: true }));
    await expect(publicArea.getByRole('button')).toHaveCount(3);
    await expect(library.getByRole('heading', { name: 'Cartas reveladas' })).toBeVisible();
    await expectVerticalList(library);
    await own.screenshot({ path: info.outputPath('grimorio-revelacao-vertical.png') });
    await library.getByLabel('Destino das restantes').selectOption('bottom');
    await activate(library.getByRole('button', { name: 'Devolver sem embaralhar', exact: true }));
    await expect(publicArea.getByRole('button')).toHaveCount(3);
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
