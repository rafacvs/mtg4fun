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
    await expect(page.getByRole("button", { name: /^Rolar D20$/ })).toBeVisible();
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
    await expect(page.getByRole("button", { name: /^Rolar D20$/ })).toBeVisible();
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
