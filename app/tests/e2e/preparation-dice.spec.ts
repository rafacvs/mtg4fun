import { test, expect, roomBody } from "./fixtures";
import { randomUUID } from "node:crypto";

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
    await expect(page.getByRole("button", { name: /Rolar d20/ })).toBeVisible();
    await page.screenshot({
      path: info.outputPath("preparacao.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: /Rolar d20/ }).click();
    await expect(page.locator(".dice-register li")).toHaveCount(1, {
      timeout: 15000,
    });
    const before = await (
      await other.request.get(path + "/preparation")
    ).json();
    expect(before.rolls).toHaveLength(1);
    await page.reload();
    await expect(page.locator(".dice-register li")).toHaveCount(1, {
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
    await page.getByRole("button", { name: "Rolar d20", exact: true }).click();
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
