import { test, expect, roomBody } from "./fixtures";
import { randomUUID } from "node:crypto";

test("preparação desktop acomoda mesa, faixa e painéis na altura disponível", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  test.skip(info.project.name !== "desktop", "Composição desktop");
  await page.request.post("/api/session", {
    data: { login: "amigo", password: "senha-do-navegador" },
  });
  const { room } = await (
    await page.request.post("/api/rooms", { data: roomBody({ seats: 4 }) })
  ).json();
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1280, height: 720 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(`/#/salas/${room.id}`);
    await expect(
      page.getByRole("button", { name: /^Rolar D20$/ }),
    ).toBeVisible();
    await expect(page.locator(".preparation-empty-seat")).toHaveCount(3);
    await expect(
      page
        .getByRole("region", { name: "Jogadores à mesa" })
        .getByRole("button", { name: /^Rolar D20$/ }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "Registro da mesa" })
        .getByRole("button"),
    ).toHaveCount(0);
    const bounds = await page.evaluate(() => {
      const rect = (selector: string) =>
        document.querySelector(selector)!.getBoundingClientRect().toJSON();
      return {
        table: rect(".preparation-table"),
        header: rect(".preparation-heading"),
        start: rect(".preparation-start"),
        controls: rect(".preparation-controls"),
        register: rect(".dice-register"),
        rules: rect(".preparation-rules"),
        button: rect(".dice-roll-button"),
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    expect(bounds.header.top).toBeGreaterThan(bounds.table.top);
    expect(bounds.start.bottom).toBeLessThan(bounds.table.bottom);
    expect(bounds.register.top).toBeGreaterThan(bounds.controls.bottom);
    expect(bounds.rules.bottom).toBeLessThanOrEqual(viewport.height);
    expect(bounds.button.bottom).toBeLessThanOrEqual(viewport.height);
    expect(bounds.overflow).toBe(false);
    const previous = await page.locator(".dice-register li").count();
    for (let i = 0; i < 12; i++) {
      const response = await page.request.post(
        `/api/rooms/${room.id}/preparation/actions`,
        { data: { intentId: randomUUID(), kind: "roll" } },
      );
      expect(response.ok(), await response.text()).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 230));
    }
    await expect(page.locator(".dice-register li")).toHaveCount(previous + 12, {
      timeout: 20000,
    });
    const after = await page.evaluate(() => {
      const list =
        document.querySelector<HTMLOListElement>(".dice-register ol")!;
      return {
        rules: document
          .querySelector(".preparation-rules")!
          .getBoundingClientRect()
          .toJSON(),
        table: document
          .querySelector(".preparation-table")!
          .getBoundingClientRect()
          .toJSON(),
        button: document
          .querySelector(".dice-roll-button")!
          .getBoundingClientRect()
          .toJSON(),
        scrollable: list.scrollHeight > list.clientHeight,
        scrollTop: list.scrollTop,
      };
    });
    expect(after.rules.top).toBeCloseTo(bounds.rules.top, 0);
    expect(after.rules.bottom).toBeCloseTo(bounds.rules.bottom, 0);
    expect(after.table.height).toBeCloseTo(bounds.table.height, 0);
    expect(after.button.bottom).toBeCloseTo(bounds.button.bottom, 0);
    expect(after.scrollable).toBe(true);
    expect(after.scrollTop).toBeGreaterThan(0);
    await page.screenshot({
      path: info.outputPath(`preparacao-${viewport.width}.png`),
      fullPage: true,
    });
  }
});

test("d20 sincroniza, confirma a ordem e abre a partida", async ({
  page,
  browser,
  baseURL,
}, info) => {
  test.setTimeout(120_000);
  const other = await browser.newContext({ baseURL });
  try {
    await page.request.post("/api/session", {
      data: { login: "amigo", password: "senha-do-navegador" },
    });
    await other.request.post("/api/session", {
      data: { login: "segundo", password: "senha-do-navegador" },
    });
    const requests = [page.request, other.request];
    const decks = [];
    for (const request of requests) {
      const response = await request.post("/api/decks", {
        multipart: {
          file: {
            name: "dice.cod",
            mimeType: "application/xml",
            buffer: Buffer.from(
              '<cockatrice_deck><deckname>Deck dos dados</deckname><zone name="main"><card number="10" name="Island"/></zone></cockatrice_deck>',
            ),
          },
        },
      });
      expect(response.ok(), await response.text()).toBe(true);
      decks.push((await response.json()).deck.id);
    }
    const created = await page.request.post("/api/rooms", {
      data: roomBody({ seats: 2, deckId: decks[0] }),
    });
    const { room } = await created.json();
    const path = `/api/rooms/${room.id}`;
    expect(
      (await other.request.post(path + "/participants", { data: {} })).ok(),
    ).toBe(true);
    await page.goto(`/#/salas/${room.id}`);
    await expect(
      page.getByRole("button", { name: /^Rolar D20$/ }),
    ).toBeVisible();
    await page.screenshot({
      path: info.outputPath("preparacao.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: /^Rolar D20$/ }).click();
    await expect(page.locator(".dice-register li")).toHaveCount(1, {
      timeout: 15000,
    });
    const actionRequest = () =>
      page.waitForRequest(
        (r) =>
          r.url().endsWith("/preparation/actions") && r.method() === "POST",
        { timeout: 15000 },
      );
    const throwButton = page.locator(".dice-roll-button");
    await throwButton.scrollIntoViewIfNeeded();
    const box = (await throwButton.boundingBox())!;
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    // Toque real no celular: um toque longo não gera click no Chromium.
    const client = info.project.use.hasTouch
      ? await page.context().newCDPSession(page)
      : null;
    const press = async () => {
      if (!client) {
        await page.mouse.move(point.x, point.y);
        await page.mouse.down();
      } else
        await client.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [point],
        });
    };
    const release = async () => {
      if (!client) await page.mouse.up();
      else
        await client.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
    };
    const background = () =>
      throwButton.evaluate((el) => getComputedStyle(el).backgroundColor);
    // Cada nível dura pouco: a espera acompanha o botão quadro a quadro.
    const waitForLevel = (level: number) =>
      page.waitForFunction(
        (wanted) =>
          document
            .querySelector(".dice-roll-button")
            ?.getAttribute("aria-label")
            ?.startsWith(`Força ${wanted} `),
        level,
        { polling: "raf", timeout: 8000 },
      );
    const idleBackground = await background();

    // Até 1 segundo é o lançamento normal, igual a um clique.
    await press();
    await new Promise((resolve) => setTimeout(resolve, 500));
    await expect(
      page.getByRole("button", { name: /^Rolar D20$/ }),
    ).toBeVisible();
    expect(await background()).toBe(idleBackground);
    const normal = actionRequest();
    await release();
    expect((await normal).postDataJSON().power).toBeUndefined();
    await expect(page.locator(".dice-register li")).toHaveCount(2, {
      timeout: 15000,
    });

    // Força 1 a 8 cai na mesa, conta no registro e muda a cor do botão.
    await press();
    await waitForLevel(1);
    await expect
      .poll(async () => {
        const [red, green, blue] = (await background())
          .match(/[\d.]+/g)!
          .map(Number);
        return green > red && green > blue;
      })
      .toBe(true);
    await waitForLevel(5);
    const onTable = actionRequest();
    await release();
    const onTablePower = (await onTable).postDataJSON().power;
    expect(onTablePower).toBeGreaterThanOrEqual(5);
    expect(onTablePower).toBeLessThanOrEqual(8);
    await expect(page.locator(".dice-register li")).toHaveCount(3, {
      timeout: 15000,
    });

    // Sair do botão cancela o lançamento (mouse).
    if (!client) {
      let sent = false;
      const watch = (r: { url(): string }) => {
        if (r.url().endsWith("/preparation/actions")) sent = true;
      };
      page.on("request", watch);
      await press();
      await page.mouse.move(point.x, point.y - box.height * 3);
      await page.mouse.up();
      await page.waitForTimeout(300);
      page.off("request", watch);
      expect(sent).toBe(false);
    }

    // Forças 9 e 10 caem para fora: todos veem o dado, o registro não muda.
    await press();
    await waitForLevel(10);
    const lost = actionRequest();
    await release();
    expect((await lost).postDataJSON().power).toBeGreaterThanOrEqual(9);
    await expect
      .poll(async () => {
        const state = await (
          await other.request.get(path + "/preparation")
        ).json();
        return state.rolls.length;
      })
      .toBe(4);
    await page.waitForTimeout(2500);
    await expect(page.locator(".dice-register li")).toHaveCount(3);
    await page.reload();
    await expect(page.locator(".dice-register li")).toHaveCount(3, {
      timeout: 15000,
    });
    for (let i = 0; i < 2; i++)
      expect(
        (
          await requests[i].put(path + "/participants/me/ready", {
            data: { deckId: decks[i] },
          })
        ).ok(),
      ).toBe(true);
    expect(
      (
        await other.request.post(path + "/preparation/start", { data: {} })
      ).status(),
    ).toBe(403);
    await page
      .getByRole("button", { name: "Iniciar partida", exact: false })
      .click();
    await expect(
      page.getByRole("region", { name: "Quem começa?" }),
    ).toBeVisible();
    // Na etapa que vale só existe o clique: segurar não carrega nem muda a força.
    const orderButton = page.getByRole("button", {
      name: "Rolar D20",
      exact: true,
    });
    const orderRoll = actionRequest();
    if (client) await orderButton.tap();
    else {
      const orderBox = (await orderButton.boundingBox())!;
      await page.mouse.move(
        orderBox.x + orderBox.width / 2,
        orderBox.y + orderBox.height / 2,
      );
      await page.mouse.down();
      await new Promise((resolve) => setTimeout(resolve, 2600));
      await expect(orderButton).toBeVisible();
      await expect(page.locator(".dice-roll-button.is-charging")).toHaveCount(0);
      await page.mouse.up();
    }
    expect((await orderRoll).postDataJSON().power).toBeUndefined();
    await expect(page.getByRole("button", { name: /^Confirmar / })).toBeEnabled(
      { timeout: 15000 },
    );
    await expect(page.locator(".own-roll strong")).toHaveText("Amigo da mesa");
    await page.screenshot({
      path: info.outputPath("ordem.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: /^Confirmar / }).click();
    await expect(
      page.getByRole("button", { name: "Confirmou", exact: true }),
    ).toBeDisabled();
    const state = await (await other.request.get(path + "/preparation")).json();
    const first = state.rolls.at(-1);
    let roll;
    for (let i = 0; i < 20; i++) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      const intentId = randomUUID();
      const data = { kind: "roll", intentId };
      const response = await other.request.post(path + "/preparation/actions", {
        data,
      });
      expect(response.ok(), await response.text()).toBe(true);
      expect(
        (
          await other.request.post(path + "/preparation/actions", { data })
        ).ok(),
      ).toBe(true);
      const updated = await (
        await other.request.get(path + "/preparation")
      ).json();
      expect(
        updated.rolls.filter((r: { id: string }) => r.id === intentId),
      ).toHaveLength(1);
      roll = updated.rolls.at(-1);
      const confirm = await other.request.post(path + "/preparation/actions", {
        data: { kind: "confirm", intentId: randomUUID(), rollId: roll.id },
      });
      if (roll.value === first.value) {
        expect(confirm.status()).toBe(409);
        continue;
      }
      expect(confirm.ok(), await confirm.text()).toBe(true);
      break;
    }
    const game = await (await page.request.get(path + "/match")).json();
    expect(game.match.turnOrder).toHaveLength(2);
    expect(game.match.turnOrder[0].roll).toBeGreaterThan(
      game.match.turnOrder[1].roll,
    );
    await expect(page.locator(".own-dock")).toBeVisible({ timeout: 20000 });
    await page.screenshot({
      path: info.outputPath("partida-iniciada.png"),
      fullPage: true,
    });
  } finally {
    await other.close();
  }
});

test("a carga vai e volta entre verde e vermelho, cada vez mais rápido", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "Gesto de mouse no desktop");
  test.setTimeout(60000);
  await page.request.post("/api/session", {
    data: { login: "amigo", password: "senha-do-navegador" },
  });
  const { room } = await (
    await page.request.post("/api/rooms", { data: roomBody({ seats: 2 }) })
  ).json();
  await page.goto(`/#/salas/${room.id}`);
  const button = page.locator(".dice-roll-button");
  await expect(button).toBeVisible();
  const box = (await button.boundingBox())!;
  await page.evaluate(() => {
    const element = document.querySelector(".dice-roll-button")!;
    const samples: { t: number; label: string; color: string }[] = [];
    (window as unknown as { chargeSamples: typeof samples }).chargeSamples =
      samples;
    const frame = () => {
      samples.push({
        t: performance.now(),
        label: element.getAttribute("aria-label") ?? "",
        color: getComputedStyle(element).backgroundColor,
      });
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(8000);
  const samples = await page.evaluate(
    () =>
      (
        window as unknown as {
          chargeSamples: { t: number; label: string; color: string }[];
        }
      ).chargeSamples,
  );
  const charging = samples.filter(({ label }) => label.startsWith("Força"));
  const levelOf = (label: string) => Number(label.match(/Força (\d+)/)![1]);
  const turns: number[] = [];
  let seeking = 10;
  for (const sample of charging)
    if (levelOf(sample.label) === seeking) {
      turns.push(sample.t);
      seeking = seeking === 10 ? 1 : 10;
    }
  // Pelo menos três viradas: subiu, voltou e subiu de novo, sempre mais rápido.
  expect(turns.length).toBeGreaterThanOrEqual(3);
  const sweeps = turns.slice(1).map((t, index) => t - turns[index]);
  expect(sweeps[1]).toBeLessThan(sweeps[0]);
  const channels = samples.map(({ color }) =>
    color.match(/[\d.]+/g)!.map(Number),
  );
  expect(channels.some(([r, g]) => g > 200 && g > r)).toBe(true);
  expect(channels.some(([r, g]) => r > 170 && g < 40)).toBe(true);
  // Soltar no meio da carga lança com a força que estava no botão.
  await page.mouse.up();
});

test("segurar o botão muda o lançamento que aparece na mesa", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "Medição no canvas do desktop");
  test.setTimeout(150000);
  await page.request.post("/api/session", {
    data: { login: "amigo", password: "senha-do-navegador" },
  });
  const { room } = await (
    await page.request.post("/api/rooms", { data: roomBody({ seats: 2 }) })
  ).json();
  await page.goto(`/#/salas/${room.id}`);
  const button = page.locator(".dice-roll-button");
  await expect(button).toBeVisible();
  const box = (await button.boundingBox())!;

  const HOP_PIXELS = 16;
  /** Lança pelo botão real e mede o dado desenhado no canvas até ele parar. */
  const measure = async (power: number) => {
    await page.waitForFunction(() => {
      const canvas = document.querySelector<HTMLCanvasElement>(
        ".dice-surface canvas",
      )!;
      const { data } = canvas
        .getContext("2d")!
        .getImageData(0, 0, canvas.width, canvas.height);
      return !data.some((value, index) => index % 4 === 3 && value > 0);
    }, undefined, { timeout: 15000 });
    await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>(
        ".dice-surface canvas",
      )!;
      const context = canvas.getContext("2d")!;
      const count = () => document.querySelectorAll(".dice-register li").length;
      const before = count();
      const samples: { t: number; x: number; y: number; top: number }[] = [];
      const run = window as unknown as {
        diceSamples: typeof samples;
        diceDone: boolean;
      };
      run.diceSamples = samples;
      run.diceDone = false;
      const frame = () => {
        const { data, width, height } = context.getImageData(
          0,
          0,
          canvas.width,
          canvas.height,
        );
        // Só o corpo do dado é opaco: sombra, rastro e impacto são translúcidos.
        let total = 0,
          sumX = 0,
          sumY = 0,
          top = height;
        for (let y = 0; y < height; y += 2)
          for (let x = 0; x < width; x += 2)
            if (data[(y * width + x) * 4 + 3] > 250) {
              total++;
              sumX += x;
              sumY += y;
              top = Math.min(top, y);
            }
        if (total)
          samples.push({
            t: performance.now(),
            x: sumX / total,
            y: sumY / total,
            top,
          });
        if (count() > before || (samples.length > 3 && !total)) {
          run.diceDone = true;
          return;
        }
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    const request = page.waitForRequest(
      (r) => r.url().endsWith("/preparation/actions") && r.method() === "POST",
      { timeout: 15000 },
    );
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    if (power)
      await page.waitForFunction(
        (level) =>
          document
            .querySelector(".dice-roll-button")
            ?.getAttribute("aria-label")
            ?.startsWith(`Força ${level} `),
        power,
        { polling: "raf", timeout: 8000 },
      );
    await page.mouse.up();
    expect((await request).postDataJSON().power).toBe(power || undefined);
    if (power === 8) {
      await page.waitForTimeout(1150);
      await page.screenshot({ path: info.outputPath("tiro-forca-8.png") });
    }
    await page.waitForFunction(
      () => (window as unknown as { diceDone: boolean }).diceDone,
      undefined,
      { timeout: 15000 },
    );
    const samples = await page.evaluate(
      () =>
        (
          window as unknown as {
            diceSamples: { t: number; x: number; y: number; top: number }[];
          }
        ).diceSamples,
    );
    let path = 0,
      burst = 0;
    for (let i = 1; i < samples.length; i++) {
      const step = Math.hypot(
        samples[i].x - samples[i - 1].x,
        samples[i].y - samples[i - 1].y,
      );
      path += step;
      if (samples[i].t - samples[0].t <= 500) burst += step;
    }
    const seconds = (samples.at(-1)!.t - samples[0].t) / 1000;
    // Um pulo aparece na tela como subida seguida de descida do dado.
    let hops = 0,
      valley = samples[0].y,
      peak = samples[0].y,
      rising = false;
    for (const { y } of samples) {
      if (rising) {
        peak = Math.min(peak, y);
        if (y > peak + HOP_PIXELS) {
          hops++;
          rising = false;
          valley = y;
        }
      } else {
        valley = Math.max(valley, y);
        if (y < valley - HOP_PIXELS) {
          rising = true;
          peak = y;
        }
      }
    }
    const top = Math.min(...samples.map((sample) => sample.top));
    return { path, burst, seconds, hops, top };
  };

  const click = await measure(0);
  const weakest = await measure(1);
  const shot = await measure(8);
  const lost = await measure(10);
  console.log(JSON.stringify({ click, weakest, shot, lost }));

  // Força 1 mal sai do lugar; o tiro corre muito mais, dispara no primeiro meio
  // segundo e continua ricocheteando por mais tempo.
  expect(weakest.path).toBeLessThan(click.path * 0.6);
  expect(weakest.seconds).toBeLessThan(click.seconds);
  expect(shot.path).toBeGreaterThan(click.path * 4);
  expect(shot.burst).toBeGreaterThan(click.burst * 2);
  expect(shot.seconds).toBeGreaterThan(click.seconds * 1.8);
  expect(lost.burst).toBeGreaterThan(click.burst * 1.5);
  // O clique já pula à vista; o tiro pula mais e mais alto, sem sair do canvas.
  expect(click.hops).toBeGreaterThanOrEqual(2);
  expect(shot.hops).toBeGreaterThan(click.hops);
  expect(shot.top).toBeLessThan(click.top);
  expect(shot.top).toBeGreaterThan(0);
  expect(click.top).toBeGreaterThan(0);
  await expect(page.locator(".dice-register li")).toHaveCount(3);
});

test("confirmação com quatro jogadores mantém mesa, ordem e registro na tela", async ({
  page,
  browser,
  baseURL,
}, info) => {
  test.skip(info.project.name !== "desktop", "Composição desktop");
  test.setTimeout(90000);
  const contexts = await Promise.all(
    [0, 1, 2].map(() => browser.newContext({ baseURL })),
  );
  try {
    const requests = [
      page.request,
      ...contexts.map((context) => context.request),
    ];
    const logins = ["amigo", "segundo", "amigo3", "amigo4"];
    const deckIds: number[] = [];
    for (const [index, request] of requests.entries()) {
      await request.post("/api/session", {
        data: { login: logins[index], password: "senha-do-navegador" },
      });
      const response = await request.post("/api/decks", {
        multipart: {
          file: {
            name: "ordem.cod",
            mimeType: "application/xml",
            buffer: Buffer.from(
              '<cockatrice_deck><deckname>Deck da confirmação</deckname><zone name="main"><card number="10" name="Island"/></zone></cockatrice_deck>',
            ),
          },
        },
      });
      expect(response.ok()).toBe(true);
      deckIds.push((await response.json()).deck.id);
    }
    const { room } = await (
      await page.request.post("/api/rooms", {
        data: roomBody({ seats: 4, deckId: deckIds[0] }),
      })
    ).json();
    const path = `/api/rooms/${room.id}`;
    for (const [index, request] of requests.entries()) {
      if (index)
        expect(
          (await request.post(path + "/participants", { data: {} })).ok(),
        ).toBe(true);
      expect(
        (
          await request.put(path + "/participants/me/ready", {
            data: { deckId: deckIds[index] },
          })
        ).ok(),
      ).toBe(true);
    }
    expect(
      (await page.request.post(path + "/preparation/start", { data: {} })).ok(),
    ).toBe(true);
    await page.goto(`/#/salas/${room.id}`);
    await expect(page.locator(".order-seat")).toHaveCount(4);
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 1280, height: 720 },
    ]) {
      await page.setViewportSize(viewport);
      const bounds = await page.evaluate(() => {
        const rect = (selector: string) =>
          document.querySelector(selector)!.getBoundingClientRect().toJSON();
        return {
          table: rect(".order-table"),
          ranking: rect(".order-ranking"),
          sidebar: rect(".order-sidebar"),
          footer: rect(".order-table footer"),
          button: rect(".order-result .dice-roll-button"),
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      expect(bounds.ranking.bottom).toBeLessThanOrEqual(viewport.height);
      expect(bounds.sidebar.bottom).toBeLessThanOrEqual(viewport.height);
      expect(bounds.footer.bottom).toBeLessThan(bounds.table.bottom);
      expect(bounds.ranking.top).toBeGreaterThan(bounds.table.bottom);
      expect(bounds.button.bottom).toBeLessThanOrEqual(viewport.height);
      expect(bounds.overflow).toBe(false);
      await page.screenshot({
        path: info.outputPath(`confirmacao-${viewport.width}.png`),
        fullPage: true,
      });
    }
    await expect(
      page.locator(".order-preparation .preparation-panel-corners > img"),
    ).toHaveCount(12);
    const values = new Set<number>();
    let highestValue = 0;
    let leaderName = "";
    for (const [index, request] of requests.entries()) {
      for (let attempt = 0; attempt < 40; attempt++) {
        const response = await request.post(path + "/preparation/actions", {
          data: { kind: "roll", intentId: randomUUID() },
        });
        expect(response.ok()).toBe(true);
        const state = await (await request.get(path + "/preparation")).json();
        const roll = state.rolls.at(-1);
        if (values.has(roll.value)) {
          await new Promise((resolve) => setTimeout(resolve, 250));
          continue;
        }
        await expect(
          page
            .locator(".order-seat")
            .nth(index)
            .getByRole("img", { name: `D20: ${roll.value}`, exact: true }),
        ).toBeVisible({ timeout: 15000 });
        if (roll.value > highestValue) {
          highestValue = roll.value;
          leaderName = roll.name;
        }
        await expect(page.locator(".own-roll strong")).toHaveText(leaderName);
        expect(
          (
            await request.post(path + "/preparation/actions", {
              data: {
                kind: "confirm",
                intentId: randomUUID(),
                rollId: roll.id,
              },
            })
          ).ok(),
        ).toBe(true);
        values.add(roll.value);
        break;
      }
    }
    await expect(page.locator(".order-result h3")).toContainText(
      "Você joga em",
    );
    await expect(page.locator(".own-roll strong")).toHaveText(/^[1-4]º$/);
    await expect(page.locator(".order-felt strong")).toContainText("começa");
    await expect(page.locator(".order-result-summary")).toContainText("Ordem:");
    await page.screenshot({
      path: info.outputPath("ordem-definida-4.png"),
      fullPage: true,
    });
    await expect(page.locator(".own-dock")).toBeVisible({ timeout: 20000 });
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
