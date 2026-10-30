import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Room } from "./roomsApi";
import type { useDecks } from "../decks/useDecks";
import { deckApi } from "../decks/deckApi";
import { usePreparationDice } from "./usePreparationDice";
import { preparationDiceApi } from "./preparationDiceApi";
import { createPortal } from "react-dom";
import { DiceTable, type DiceTableHandle } from "./dice/DiceTable";
import "./preparation-dice.css";
import { useDiceThrowGesture } from "./useDiceThrowGesture";

const colors = [
  "#6cb4f5",
  "#f27bb0",
  "#b49af7",
  "#4fd1b0",
  "#e07a3e",
  "#c9d16a",
];

export function PreparationDice({
  room,
  userId,
  decks,
  preparation,
  match,
}: {
  room: Room;
  userId: number;
  decks: ReturnType<typeof useDecks>;
  preparation: ReactNode;
  match: ReactNode;
}) {
  const [landed, setLanded] = useState<Set<string>>(new Set());
  const [opened, setOpened] = useState(false);
  const { state, pending, error, send } = usePreparationDice(
    room.id,
    room.status === "started" && opened,
  );
  const [targets, setTargets] = useState<{
    arena: Element;
    controls: Element;
  } | null>(null);
  const [shared, setShared] = useState<
    { playerId: number; name: string; image?: string }[]
  >([]);
  const canvas = useRef<DiceTableHandle>(null);
  const surface = useRef<HTMLDivElement>(null);
  const seen = useRef(new Set<string>());
  const initialized = useRef(false);
  const [geometry, setGeometry] = useState({
    cx: 400,
    cy: 260,
    radius: 280,
    tilt: 0.4,
  });
  const rolls = state.rolls || [];
  const confirmed = state.confirmed || {};
  const deciding = room.status === "determining_order";
  const finished = room.status === "started";
  const own = rolls
    .filter((r) => r.playerId === userId && r.phase === "determining_order")
    .at(-1);
  const rolling = !!own && !landed.has(own.id);
  const order = room.participants
    .map((p) => ({
      ...p,
      roll: rolls
        .filter((r) => r.playerId === p.id && r.phase === "determining_order")
        .at(-1),
    }))
    .sort((a, b) => (b.roll?.value || 0) - (a.roll?.value || 0));
  const allConfirmed =
    Object.keys(confirmed).length === room.participants.length;
  useEffect(() => {
    if (deciding || finished) return;
    const attach = () => {
      const arena = document.querySelector(
        ".preparation-arena, .mobile-preparation-table",
      );
      const controls = document.querySelector(
        ".preparation-sidebar, .mobile-preparation",
      );
      if (arena && controls)
        setTargets((old) =>
          old?.arena === arena && old.controls === controls
            ? old
            : { arena, controls },
        );
    };
    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [deciding, finished]);

  useEffect(() => {
    void preparationDiceApi
      .decks(room.id)
      .then((d) => setShared(d.decks))
      .catch(() => {});
  }, [room.id, room.status]);
  useEffect(() => {
    if (!surface.current) return;
    const element = surface.current;
    const felt = element.parentElement?.querySelector(
      ".preparation-oval, .order-felt, .mobile-preparation-oval",
    );
    const resize = () => {
      const w = element.clientWidth,
        h = element.clientHeight;
      const origin = element.getBoundingClientRect();
      const bounds = felt?.getBoundingClientRect();
      setGeometry({
        cx: bounds ? bounds.left + bounds.width / 2 - origin.left : w / 2,
        cy: bounds ? bounds.top + bounds.height / 2 - origin.top : h * 0.52,
        radius: bounds ? bounds.width / 2 : w * 0.33,
        tilt: bounds ? Math.min(0.8, bounds.height / bounds.width) : 0.4,
      });
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    if (felt) observer.observe(felt);
    return () => observer.disconnect();
  }, [deciding, finished, targets]);
  useEffect(() => {
    if (!canvas.current) return;
    for (const roll of rolls) {
      if (seen.current.has(roll.id)) continue;
      seen.current.add(roll.id);
      if (!initialized.current && Date.now() - roll.at > 8000) {
        setLanded((old) => new Set(old).add(roll.id));
        continue;
      }
      const index = room.participants.findIndex((p) => p.id === roll.playerId);
      const others = room.participants.filter((p) => p.id !== userId);
      const position = others.findIndex((p) => p.id === roll.playerId);
      canvas.current.toss({
        value: roll.value,
        fallOff: roll.fallOff,
        seed: roll.seed,
        color: colors[index % 6],
        label: roll.name,
        fromAngle:
          roll.playerId === userId
            ? 0
            : [Math.PI, -Math.PI / 2, Math.PI / 2, 2.2, -2.2][position],
        onLand: () => setLanded((old) => new Set(old).add(roll.id)),
      });
    }
    if (state.rolls !== null && rolls.length) initialized.current = true;
  }, [state, room.participants, userId]);
  useEffect(() => {
    if (!finished) return;
    if (!initialized.current || !rolls.length) {
      setOpened(true);
      return;
    }
    if (!allConfirmed) return;
    const timer = setTimeout(() => setOpened(true), 4500);
    return () => clearTimeout(timer);
  }, [finished, allConfirmed, rolls.length]);
  const action = (kind: "roll" | "confirm") => send(kind, own?.id);
  const throwGesture = useDiceThrowGesture(
    (fallOff) => void send("roll", own?.id, fallOff),
  );
  const diceSurface = (
    <div className="dice-surface" ref={surface}>
      <DiceTable ref={canvas} table={geometry} dieRadius={23} />
    </div>
  );
  const log = (
    <section className="dice-register" aria-label="Registro da mesa">
      <p className="eyebrow">REGISTRO DA MESA</p>
      <h3>
        Dados rolados{" "}
        <small>{deciding || finished ? "Valendo" : "Brincadeira"}</small>
      </h3>
      <ol aria-live="polite">
        {rolls
          .filter((r) => landed.has(r.id))
          .slice(-30)
          .reverse()
          .map((r) => (
            <li
              key={r.id}
              className={r.phase === "determining_order" ? "is-counting" : ""}
            >
              <span>
                <b>{r.name}</b> rolou um d20
                {confirmed[r.playerId] === r.id ? " · confirmou" : ""}
                <small>
                  {r.phase === "preparing" ? "Brincadeira" : "Valendo"}
                  {r.value === 20 ? " · 20 natural!" : ""}
                </small>
              </span>
              <strong
                style={{
                  color:
                    colors[
                      room.participants.findIndex((p) => p.id === r.playerId) %
                        6
                    ],
                }}
              >
                {r.value}
              </strong>
            </li>
          ))}
      </ol>
      {!deciding && !finished && (
        <>
          <button
            disabled={pending}
            {...throwGesture.handlers}
            className="secondary dice-roll-button"
            title="Segure por 3 segundos e solte para jogar para fora da mesa"
          >
            {throwGesture.charged ? "Solte para cair da mesa" : "⬡ Rolar d20"}
          </button>
          <small>
            Pode rolar quantos quiser. Só pra brincar, não vale nada.
          </small>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
  if (finished && opened) return match;
  if (!deciding && !finished)
    return (
      <>
        {preparation}
        {targets && createPortal(diceSurface, targets.arena)}
        {targets && createPortal(log, targets.controls)}
      </>
    );
  return (
    <section
      className="room-preparation order-preparation"
      aria-label="Quem começa?"
    >
      <div className="order-main">
        <section className="order-table">
          <header>
            <p className="eyebrow">
              {finished ? "ORDEM DEFINIDA" : "QUEM COMEÇA?"}
            </p>
            <h2>{finished ? `${order[0]?.name} começa` : "À mesa"}</h2>
            <span>
              {room.format} · {room.life} de vida · {room.participants.length}{" "}
              jogadores
            </span>
          </header>
          <div className="order-arena">
            <div className="order-felt">
              <span>✧</span>
              {finished && <strong>{order[0]?.name} começa</strong>}
            </div>
            {diceSurface}
            {room.participants.map((p, index) => {
              const others = room.participants.filter((p) => p.id !== userId);
              const pos =
                p.id === userId
                  ? "own"
                  : `other-${others.findIndex((v) => v.id === p.id)}`;
              const roll = order.find((v) => v.id === p.id)?.roll;
              const deck = shared.find((d) => d.playerId === p.id);
              const ownDeck = decks.decks.find((d) => d.id === p.deckId);
              const image = deck?.image || ownDeck?.commander;
              return (
                <article
                  className={`order-seat ${pos}`}
                  style={{ borderColor: colors[index % 6] }}
                  key={p.id}
                >
                  {image && <img alt="" src={deckApi.imageURL(image)} />}
                  <div>
                    <b>
                      {p.name}
                      {p.id === userId ? " · você" : ""}
                    </b>
                    <small>
                      {deck?.name || ownDeck?.name || "Deck escolhido"}
                    </small>
                    <span>
                      {confirmed[p.id]
                        ? finished
                          ? `${order.findIndex((v) => v.id === p.id) + 1}º a jogar`
                          : "✓ Confirmou"
                        : roll
                          ? "Pode rolar de novo"
                          : "Ainda não rolou"}
                    </span>
                  </div>
                  {roll && landed.has(roll.id) && <strong>{roll.value}</strong>}
                </article>
              );
            })}
          </div>
          <footer>
            {Object.keys(confirmed).length}/{room.participants.length}{" "}
            confirmaram ·{" "}
            {finished
              ? "Todos confirmaram. Abrindo a mesa…"
              : "Cada jogador rola e confirma seu resultado."}
          </footer>
        </section>
        <section className="order-ranking">
          <p className="eyebrow">ORDEM DOS TURNOS</p>
          <ol>
            {order.map((p, i) => (
              <li key={p.id} className={allConfirmed ? "" : "provisional"}>
                <strong>{i + 1}º</strong>
                <span>
                  {p.name}
                  <small>{confirmed[p.id] ? "Confirmado" : "Provisório"}</small>
                </span>
                <b>{p.roll && landed.has(p.roll.id) ? p.roll.value : "—"}</b>
              </li>
            ))}
          </ol>
        </section>
      </div>
      <aside className="order-sidebar">
        <section className="dice-register">
          <p className="eyebrow">
            {finished ? "ORDEM DEFINIDA" : "SUA ROLAGEM"}
          </p>
          <h3>
            {finished
              ? `Você joga em ${order.findIndex((p) => p.id === userId) + 1}º`
              : "Quem começa?"}
          </h3>
          <div className="own-roll" role="status">
            {rolling ? "Rolando na mesa…" : own ? own.value : "Role seu d20"}
          </div>
          {!finished && (
            <>
              <button
                disabled={pending || rolling || !!confirmed[userId]}
                {...throwGesture.handlers}
                className="dice-roll-button"
              >
                {throwGesture.charged
                  ? "Solte para cair da mesa"
                  : own
                    ? "Rolar de novo"
                    : "Rolar d20"}
              </button>
              <button
                className="secondary"
                disabled={pending || rolling || !own || !!confirmed[userId]}
                onClick={() => void action("confirm")}
              >
                {confirmed[userId]
                  ? "Confirmou"
                  : `Confirmar ${own?.value || ""}`}
              </button>
            </>
          )}
          {error && <p role="alert">{error}</p>}
        </section>
        {log}
      </aside>
    </section>
  );
}
