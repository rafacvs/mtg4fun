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
  test.setTimeout(90_000);
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
    const throwButton = page.getByRole("button", { name: /^Rolar D20$/ });
    await throwButton.hover();
    await page.mouse.down();
    await expect(
      page.getByRole("button", { name: "Solte para cair da mesa" }),
    ).toBeVisible({ timeout: 5000 });
    const thrown = page.waitForRequest(
      (r) => r.url().endsWith("/preparation/actions") && r.method() === "POST",
    );
    await page.mouse.up();
    expect((await thrown).postDataJSON().fallOff).toBe(true);
    await expect(page.locator(".dice-register li")).toHaveCount(2, {
      timeout: 15000,
    });
    const before = await (
      await other.request.get(path + "/preparation")
    ).json();
    expect(before.rolls).toHaveLength(2);
    await page.reload();
    await expect(page.locator(".dice-register li")).toHaveCount(2, {
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
    await page.getByRole("button", { name: "Rolar D20", exact: true }).click();
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
