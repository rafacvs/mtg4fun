import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from "react";
import type { Room } from "./roomsApi";
import type { useDecks } from "../decks/useDecks";
import { deckApi } from "../decks/deckApi";
import { usePreparationDice } from "./usePreparationDice";
import { preparationDiceApi } from "./preparationDiceApi";
import { createPortal } from "react-dom";
import { DiceTable, type DiceTableHandle } from "./dice/DiceTable";
import "./preparation-dice.css";
import { DiceRollBadge } from "./DiceRollBadge";
import d20Icon from "../../assets/theme/d20.svg";
import panelCorner from "../../assets/theme/corner-v2.svg";
import { useDiceThrowGesture } from "./useDiceThrowGesture";
import {
  MAX_POWER,
  powerColor,
  powerTextColor,
} from "./diceThrowPower";

const colors = [
  "#6cb4f5",
  "#f27bb0",
  "#b49af7",
  "#4fd1b0",
  "#e07a3e",
  "#c9d16a",
];

function PanelCorners() {
  return (
    <span className="preparation-panel-corners" aria-hidden="true">
      {[0, 1, 2, 3].map((corner) => (
        <img key={corner} src={panelCorner} alt="" />
      ))}
    </span>
  );
}

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
    action: Element;
  } | null>(null);
  const [shared, setShared] = useState<
    { playerId: number; name: string; image?: string }[]
  >([]);
  const canvas = useRef<DiceTableHandle>(null);
  const surface = useRef<HTMLDivElement>(null);
  const seen = useRef(new Set<string>());
  const logList = useRef<HTMLOListElement>(null);
  const followLog = useRef(true);
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
  const landedOrder = order.filter((p) => p.roll && landed.has(p.roll.id));
  const leaders = landedOrder.filter(
    (p) => p.roll?.value === landedOrder[0]?.roll?.value,
  );
  const ownPosition = order.findIndex((p) => p.id === userId) + 1;
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
      const action = document.querySelector(".preparation-dice-action");
      if (arena && controls && action)
        setTargets((old) =>
          old?.arena === arena &&
          old.controls === controls &&
          old.action === action
            ? old
            : { arena, controls, action },
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
        power: roll.power,
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
  const action = (kind: "roll" | "confirm" | "unconfirm") =>
    send(kind, own?.id);
  useEffect(() => {
    const list = logList.current;
    if (list && followLog.current) list.scrollTop = list.scrollHeight;
  }, [landed, deciding]);
  const throwGesture = useDiceThrowGesture(
    (power) => void send("roll", own?.id, power),
  );
  const throwPower = throwGesture.power;
  const diceSurface = (
    <div className="dice-surface" ref={surface}>
      <DiceTable ref={canvas} table={geometry} dieRadius={23} />
    </div>
  );
  const throwButton = (
    <button
      disabled={pending}
      {...throwGesture.handlers}
      className={`secondary dice-roll-button ${throwPower ? "is-charging" : ""}`}
      style={
        throwPower
          ? ({
              "--dice-charge-color": powerColor(throwPower),
              "--dice-charge-text": powerTextColor(throwPower),
            } as CSSProperties)
          : undefined
      }
      aria-label={
        throwPower
          ? `Força ${throwPower} de ${MAX_POWER}`
          : undefined
      }
      title="Segure por mais de 1 segundo para aumentar a força."
    >
      <span
        className="dice-roll-icon"
        style={{
          maskImage: `url("${d20Icon}")`,
          WebkitMaskImage: `url("${d20Icon}")`,
        }}
        aria-hidden="true"
      />{" "}
      Rolar D20
    </button>
  );
  const log = (
    <section className="dice-register" aria-label="Registro da mesa">
      <PanelCorners />
      <header className="dice-register-heading">
        <div>
          <p className="eyebrow">REGISTRO DA MESA</p>
          <h3>Dados rolados</h3>
        </div>
        {(deciding || finished) && (
          <span className="dice-register-phase">Valendo</span>
        )}
      </header>
      <ol
        ref={logList}
        aria-live="polite"
        aria-label="Histórico das rolagens"
        tabIndex={0}
        onScroll={(event) => {
          const list = event.currentTarget;
          followLog.current =
            list.scrollHeight - list.clientHeight - list.scrollTop < 24;
        }}
      >
        {rolls
          .filter((r) => landed.has(r.id))
          .map((r) => (
            <li
              key={r.id}
              className={r.phase === "determining_order" ? "is-counting" : ""}
              style={
                {
                  "--player-color":
                    colors[
                      room.participants.findIndex(
                        (player) => player.id === r.playerId,
                      ) % 6
                    ],
                } as CSSProperties
              }
            >
              <span className="dice-player-shield" aria-hidden="true">
                {r.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="dice-register-copy">
                <span>
                  <b>{r.name}</b>{" "}
                  {confirmed[r.playerId] === r.id ? (
                    <>
                      confirmou <em>vale</em>
                    </>
                  ) : (
                    <>
                      rolou
                      {rolls
                        .slice(0, rolls.indexOf(r))
                        .some(
                          (previous) =>
                            previous.playerId === r.playerId &&
                            previous.phase === r.phase,
                        )
                        ? " de novo"
                        : ""}
                    </>
                  )}
                </span>
                <small>
                  {r.phase === "determining_order"
                    ? confirmed[r.playerId] === r.id
                      ? "Valendo · resultado final · "
                      : "Valendo · "
                    : ""}
                  {new Date(r.at).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {r.value === 20 ? " · 20 natural!" : ""}
                </small>
              </span>
              <DiceRollBadge value={r.value} />
            </li>
          ))}
      </ol>
      {(deciding || finished) && (
        <p className="dice-register-note">
          As rolagens valendo ficam marcadas em dourado. Todos veem cada
          rolagem, inclusive as que foram refeitas.
        </p>
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
        {targets && createPortal(throwButton, targets.action)}
      </>
    );
  return (
    <section
      className="room-preparation order-preparation"
      aria-label="Quem começa?"
    >
      <div className="order-main">
        <section className="order-table">
          <PanelCorners />
          <header className="order-heading">
            <div>
              <p className="eyebrow">
                {finished ? "ORDEM DEFINIDA" : "QUEM COMEÇA?"}
              </p>
              <h2>{finished ? `${order[0]?.name} começa` : "À mesa"}</h2>
            </div>
            <div className="preparation-room-facts">
              <span>♟ {room.format}</span>
              <span>♥ {room.life} de vida</span>
              <span>
                ⬟ {room.participants.length}/{room.seats} jogadores
              </span>
            </div>
          </header>
          <div className="order-arena">
            <div className="order-felt">
              <span aria-hidden="true">{finished ? "♛" : "✧"}</span>
              {finished && (
                <>
                  <strong>{order[0]?.name} começa</strong>
                  <small>
                    Tirou {order[0]?.roll?.value} · a ordem segue o resultado
                  </small>
                </>
              )}
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
                  className={`order-seat ${pos} ${finished && order[0]?.id === p.id ? "is-first" : ""}`}
                  style={
                    { "--player-color": colors[index % 6] } as CSSProperties
                  }
                  key={p.id}
                >
                  <span
                    className="dice-player-shield order-seat-shield"
                    aria-hidden="true"
                  >
                    {p.name.slice(0, 1).toUpperCase()}
                  </span>
                  <img
                    alt=""
                    src={image ? deckApi.imageURL(image) : "/library-back.png"}
                    onError={(event) => {
                      event.currentTarget.src = "/library-back.png";
                    }}
                  />
                  <div className="order-seat-copy">
                    <b>
                      {p.name}
                      {p.id === userId && <em> · você</em>}
                    </b>
                    <small>
                      {deck?.name || ownDeck?.name || "Deck escolhido"}
                    </small>
                    <span
                      className={`order-seat-status ${confirmed[p.id] ? "is-confirmed" : ""}`}
                    >
                      {confirmed[p.id]
                        ? finished
                          ? `${order.findIndex((v) => v.id === p.id) + 1}º a jogar`
                          : "✓ Confirmou"
                        : roll
                          ? "Pode rolar de novo"
                          : "Ainda não rolou"}
                    </span>
                  </div>
                  {roll && landed.has(roll.id) && (
                    <DiceRollBadge value={roll.value} />
                  )}
                </article>
              );
            })}
          </div>
          <footer>
            <div className="order-confirmation-shields" aria-hidden="true">
              {room.participants.map((p, index) => (
                <span
                  key={p.id}
                  className="dice-player-shield"
                  style={
                    { "--player-color": colors[index % 6] } as CSSProperties
                  }
                />
              ))}
            </div>
            <p role="status">
              <b>
                {Object.keys(confirmed).length}/{room.participants.length}{" "}
                confirmaram
              </b>{" "}
              ·{" "}
              {finished
                ? "Todos confirmaram. Abrindo a mesa…"
                : "Cada jogador rola e confirma seu resultado."}
            </p>
          </footer>
        </section>
        <section className="order-ranking">
          <header className="order-ranking-heading">
            <p className="eyebrow">ORDEM DOS TURNOS</p>
            <small>
              {allConfirmed
                ? "Definida · todos confirmaram"
                : "Provisória · aguardando confirmações"}
            </small>
          </header>
          <ol>
            {order.map((p, i) => (
              <li
                key={p.id}
                className={`${allConfirmed ? "" : "provisional"} ${allConfirmed && i === 0 ? "is-first" : ""}`}
                style={
                  {
                    "--player-color":
                      colors[
                        room.participants.findIndex(
                          (player) => player.id === p.id,
                        ) % 6
                      ],
                  } as CSSProperties
                }
              >
                <strong>{i + 1}º</strong>
                <span className="dice-player-shield" aria-hidden="true">
                  {p.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="order-ranking-copy">
                  <b>
                    {p.name}
                    {p.id === userId ? " · você" : ""}
                  </b>
                  <small>
                    {allConfirmed && i === 0
                      ? "começa"
                      : confirmed[p.id]
                        ? "confirmado"
                        : "provisório"}
                  </small>
                </span>
                {p.roll && landed.has(p.roll.id) ? (
                  <DiceRollBadge value={p.roll.value} />
                ) : (
                  <b>—</b>
                )}
              </li>
            ))}
          </ol>
        </section>
      </div>
      <aside className="order-sidebar">
        <section className="dice-register order-result">
          <PanelCorners />
          <header className="dice-register-heading">
            <div>
              <p className="eyebrow">
                {finished ? "ORDEM DEFINIDA" : "SUA ROLAGEM"}
              </p>
              <h3>
                {finished ? `Você joga em ${ownPosition}º` : "Quem começa?"}
              </h3>
            </div>
            {finished && (
              <span className="dice-register-phase">Todos confirmaram</span>
            )}
          </header>
          <div
            className={`own-roll ${finished ? "is-final" : "is-leader"}`}
            role="status"
          >
            <strong>
              {finished
                ? `${ownPosition}º`
                : leaders.length
                  ? leaders.map((p) => p.name).join(" / ")
                  : "Aguardando rolagens"}
            </strong>
            {finished ? (
              <small>A jogar · tirou {own?.value}</small>
            ) : leaders.length > 0 ? (
              <small>
                {leaders.length > 1 ? "Empate" : "Maior rolagem"} · tirou{" "}
                {leaders[0].roll?.value}
              </small>
            ) : null}
          </div>
          {finished && (
            <div className="order-result-summary">
              <p>Ordem: {order.map((p) => p.name).join(" → ")}.</p>
              <div className="order-result-progress" aria-hidden="true">
                <span />
              </div>
              <small>Abrindo a mesa…</small>
            </div>
          )}
          {!finished && (
            <>
              <button
                disabled={pending || rolling || !!confirmed[userId]}
                onClick={() => void action("roll")}
                className="dice-roll-button"
              >
                <span
                  className="dice-roll-icon"
                  style={{
                    maskImage: `url("${d20Icon}")`,
                    WebkitMaskImage: `url("${d20Icon}")`,
                  }}
                  aria-hidden="true"
                />{" "}
                Rolar D20
              </button>
              <button
                className="secondary"
                disabled={pending || rolling || !own}
                onClick={() =>
                  void action(confirmed[userId] ? "unconfirm" : "confirm")
                }
              >
                {confirmed[userId]
                  ? "Desconfirmar"
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
