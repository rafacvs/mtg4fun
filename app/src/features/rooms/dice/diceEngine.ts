/**
 * diceEngine.ts — dados d20 em 3D com física, desenhados num <canvas> 2D.
 *
 * Sem dependências. Não usa three.js: a geometria (icosaedro), a rotação
 * (quatérnios), a física (gravidade, quique, atrito, parede circular e
 * colisão entre dados) e a projeção em perspectiva são feitas à mão.
 *
 * Sistema de coordenadas (plano da mesa, em px):
 *   x → direita, y → em direção a quem olha (para baixo na tela), z → para cima.
 *   O centro do feltro é (0, 0). A mesa é um círculo de raio `table.radius`
 *   que a câmera vê inclinada: um círculo vira uma elipse com altura
 *   radius * tilt (tilt = seno do ângulo de elevação da câmera).
 */

export type Vec3 = [number, number, number];
type Quat = [number, number, number, number];

export interface TableConfig {
  /** centro do feltro, em px, relativo ao canvas */
  cx: number;
  cy: number;
  /** raio do feltro no plano da mesa (= raio horizontal da elipse na tela) */
  radius: number;
  /** achatamento da perspectiva: raio vertical da elipse / raio horizontal (ex.: 0.4) */
  tilt: number;
}

export interface EngineOptions {
  table: TableConfig;
  /** raio do dado em px (circunraio do icosaedro). Padrão 28 */
  dieRadius?: number;
  /** ms que o dado fica parado na mesa antes de começar a sumir. Padrão 3600 */
  restMs?: number;
  /** ms do fade-out. Padrão 800 */
  fadeMs?: number;
  /** limite de dados simultâneos (os mais antigos saem). Padrão 40 */
  maxDice?: number;
  /** fonte dos números das faces e da etiqueta */
  numberFont?: string;
  labelFont?: string;
  /** cor das arestas e da etiqueta */
  gold?: string;
  /** mostra a etiqueta "nome valor" quando o dado para. Padrão true */
  showBadge?: boolean;
}

export interface TossOptions {
  fallOff?: boolean;
  /** força do lançamento, 1–10; sem força é o lançamento normal (equivale a 4) */
  power?: number;
  /** cor do dado (#RRGGBB) — normalmente a cor do jogador */
  color: string;
  /** texto da etiqueta quando o dado para (ex.: nome do jogador) */
  label?: string;
  /**
   * De onde o dado é jogado: ângulo em radianos ao redor da mesa.
   * 0 = lado de quem olha (embaixo), π/2 = direita, π = fundo, -π/2 = esquerda.
   */
  fromAngle?: number;
  /**
   * Resultado forçado (1–20). Use em multiplayer: o servidor sorteia o número
   * e todos os clientes animam o dado parando nessa face. Sem isso, o
   * resultado é o que a física der.
   */
  value?: number;
  /** semente do arremesso (mesma semente = mesmo arremesso em todos os clientes) */
  seed?: number;
  /** chamado uma vez quando o dado para, com o número da face de cima */
  onLand?: (value: number) => void;
}

export interface DiceEngine {
  /** joga um dado; devolve o id dele */
  toss(o: TossOptions): string;
  /** remove todos os dados da mesa */
  clear(): void;
  /** troca a geometria da mesa (ex.: no resize) */
  setTable(t: TableConfig): void;
  /** para o loop e solta os observers */
  destroy(): void;
  /** quantos dados estão na mesa */
  count(): number;
  /** avança a simulação manualmente (testes); dt em segundos */
  step(dt: number): void;
  /** posição e velocidade atuais dos dados (testes) */
  snapshot(): { id: string; p: Vec3; v: Vec3; st: string }[];
}

// ---------------------------------------------------------------- matemática
const nrm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const crs = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const qmul = (a: Quat, b: Quat): Quat => [
  a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
  a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
  a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
  a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
];
const qn = (q: Quat): Quat => {
  const l = Math.hypot(q[0], q[1], q[2], q[3]);
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
};
const qrot = (q: Quat, v: Vec3): Vec3 => {
  const t = qmul(qmul(q, [0, v[0], v[1], v[2]]), [q[0], -q[1], -q[2], -q[3]]);
  return [t[1], t[2], t[3]];
};
const qax = (ax: Vec3, an: number): Quat => {
  const s = Math.sin(an / 2);
  return [Math.cos(an / 2), ax[0] * s, ax[1] * s, ax[2] * s];
};

/** gerador pseudoaleatório com semente (mulberry32) */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- icosaedro (d20)
const PHI = (1 + Math.sqrt(5)) / 2;
const RAW: Vec3[] = [
  [0, 1, PHI],
  [0, -1, PHI],
  [0, 1, -PHI],
  [0, -1, -PHI],
  [1, PHI, 0],
  [-1, PHI, 0],
  [1, -PHI, 0],
  [-1, -PHI, 0],
  [PHI, 0, 1],
  [-PHI, 0, 1],
  [PHI, 0, -1],
  [-PHI, 0, -1],
];
interface Face {
  v: [number, number, number];
  n: Vec3;
  num: number;
  opp: number;
}
const FACES: Face[] = (() => {
  const out: Face[] = [];
  const edge = (a: Vec3, b: Vec3) =>
    Math.abs(Math.hypot(...sub(a, b)) - 2) < 1e-6; // aresta do icosaedro bruto = 2
  for (let i = 0; i < 12; i++)
    for (let j = i + 1; j < 12; j++)
      for (let k = j + 1; k < 12; k++) {
        if (!(
          edge(RAW[i], RAW[j]) &&
          edge(RAW[j], RAW[k]) &&
          edge(RAW[i], RAW[k])
        ))
          continue;
        const c: Vec3 = [
          (RAW[i][0] + RAW[j][0] + RAW[k][0]) / 3,
          (RAW[i][1] + RAW[j][1] + RAW[k][1]) / 3,
          (RAW[i][2] + RAW[j][2] + RAW[k][2]) / 3,
        ];
        const n = crs(sub(RAW[j], RAW[i]), sub(RAW[k], RAW[i]));
        out.push({
          v: dot(n, c) > 0 ? [i, j, k] : [i, k, j],
          n: nrm(c),
          num: 0,
          opp: -1,
        }); // vértices em ordem anti-horária vista de fora
      }
  out.forEach((f, i) => {
    f.opp = out.findIndex((g) => dot(g.n, f.n) < -0.999);
    void i;
  });
  let next = 1;
  out.forEach((f) => {
    if (f.num) return;
    f.num = next;
    out[f.opp].num = 21 - next;
    next++;
  }); // faces opostas somam 21, como num d20 de verdade
  return out;
})();
const VERTS: Vec3[] = RAW.map(nrm);

// ---------------------------------------------------------------- força
const NORMAL_FORCE = 4;
const MAX_AIM_DEVIATION = Math.PI / 6;
/**
 * Um nível por linha (força 1–10). Fraco é um dado largado na frente do próprio
 * jogador, com pulinhos; forte sai rápido e para cima e fica saltando pelo feltro
 * e ricocheteando na parede. speed em px/s para uma mesa de raio 294;
 * lift é a velocidade para cima; height é a altura de saída; bounce é o quanto da
 * queda volta em cada quique; drag é o atrito no feltro; rim é o quanto da
 * velocidade sobra ao bater no aro; deflect é o desvio máximo do ricochete, em
 * radianos.
 */
const FORCES = [
  { speed: 60, lift: 300, height: 40, bounce: 0.5, drag: 1.9, rim: 0.7, deflect: 0 },
  { speed: 100, lift: 380, height: 45, bounce: 0.54, drag: 1.9, rim: 0.7, deflect: 0 },
  { speed: 150, lift: 460, height: 50, bounce: 0.58, drag: 1.9, rim: 0.7, deflect: 0 },
  { speed: 210, lift: 540, height: 55, bounce: 0.62, drag: 1.9, rim: 0.72, deflect: 0.1 },
  { speed: 420, lift: 600, height: 55, bounce: 0.66, drag: 1.7, rim: 0.75, deflect: 0.2 },
  { speed: 1500, lift: 680, height: 55, bounce: 0.7, drag: 1.2, rim: 0.78, deflect: 0.4 },
  { speed: 2500, lift: 760, height: 50, bounce: 0.72, drag: 0.9, rim: 0.82, deflect: 0.5 },
  { speed: 3800, lift: 840, height: 45, bounce: 0.74, drag: 0.7, rim: 0.85, deflect: 0.6 },
  { speed: 5200, lift: 840, height: 40, bounce: 0.74, drag: 0.7, rim: 0.85, deflect: 0.6 },
  { speed: 6400, lift: 840, height: 40, bounce: 0.74, drag: 0.7, rim: 0.85, deflect: 0.6 },
];
/** o quanto da velocidade na mesa e do impacto no aro vira salto */
const FLOOR_SKIP = 0.22;
const RIM_KICK = 0.25;
/** só o aro, no chão, dá um pulinho: acima dessa altura (em raios do dado) é parede lisa */
const RIM_HEIGHT = 1.6;
const RIM_KICK_MIN = 180;
const RIM_KICK_MAX = 320;
/** abaixo dessa velocidade é só encostar no aro */
const RIM_KICK_MIN_HIT = 40;
/** velocidade que sobra na mesa a cada quique */
const BOUNCE_SLIDE = 0.8;
/** segundos que um ponto do rastro fica visível, e a velocidade em que ele aparece */
const TRAIL_LIFE = 0.45;
const TRAIL_MIN_SPEED = 500;
const IMPACT_LIFE = 0.4;

// ---------------------------------------------------------------- dado
interface Die {
  fallOff?: boolean;
  id: string;
  bounce: number;
  drag: number;
  rim: number;
  deflect: number;
  rand: () => number;
  trail: { x: number; y: number; z: number; age: number }[];
  p: Vec3;
  v: Vec3;
  w: Vec3;
  q: Quat;
  st: "fly" | "settle" | "rest";
  lock: number; // face escolhida para assentar
  t: number;
  a: number;
  rgb: [number, number, number];
  label: string;
  labels: number[]; // número exibido em cada face (permite forçar o resultado)
  forced?: number;
  val: number;
  onLand?: (v: number) => void;
}

const hex = (h: string): [number, number, number] => {
  const s = h.replace("#", "");
  const f =
    s.length === 3
      ? s
          .split("")
          .map((c) => c + c)
          .join("")
      : s;
  return [
    parseInt(f.slice(0, 2), 16),
    parseInt(f.slice(2, 4), 16),
    parseInt(f.slice(4, 6), 16),
  ];
};

export function createDiceEngine(
  canvas: HTMLCanvasElement | null,
  opts: EngineOptions,
): DiceEngine {
  const ctx = canvas ? canvas.getContext("2d") : null;
  let T = { ...opts.table };
  const r = opts.dieRadius ?? 28;
  const REST = (opts.restMs ?? 3600) / 1000,
    FADE = (opts.fadeMs ?? 800) / 1000,
    MAX = opts.maxDice ?? 40;
  const NUM_FONT = opts.numberFont ?? "Cinzel, Georgia, serif";
  const LBL_FONT = opts.labelFont ?? "Geist, system-ui, sans-serif";
  const GOLD = opts.gold ?? "#F0CC80";
  const SHOW_BADGE = opts.showBadge ?? true;
  const G = 1900; // gravidade px/s²

  // câmera: elevação e tal que sin(e) = tilt
  const cam = () => {
    const K = T.tilt,
      C = Math.sqrt(1 - K * K);
    return { K, C, VIEW: [0, C, K] as Vec3 };
  };
  const LIGHT = nrm([-0.45, 0.35, 0.85]);
  /** maior velocidade para cima que ainda mantém o dado dentro da tela, mesmo no fundo da mesa */
  const maxLift = (z: number) => {
    const { K, C } = cam();
    const ceiling = Math.max(r * 3, (T.cy - (T.radius - r) * K - r) / C);
    return Math.sqrt(2 * G * Math.max(0, ceiling - z));
  };

  let dice: Die[] = [];
  let impacts: { x: number; y: number; size: number; age: number }[] = [];
  let raf: number | null = null,
    last = 0,
    W = 0,
    H = 0,
    dpr = 1,
    seq = 0;

  const fit = () => {
    if (!canvas) return;
    W = canvas.offsetWidth;
    H = canvas.offsetHeight;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    draw();
  };
  const ro =
    canvas && typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(fit)
      : null;
  if (canvas) {
    ro?.observe(canvas);
    fit();
  }

  // ------------------------------------------------ arremesso
  function toss(o: TossOptions): string {
    const rand = o.seed !== undefined ? rng(o.seed) : Math.random;
    const R = (a: number, b: number) => a + rand() * (b - a);
    const ang = o.fromAngle ?? 0;
    const force = o.power || (o.fallOff ? 9 : NORMAL_FORCE);
    const { speed, lift, height, bounce, drag, rim, deflect } = FORCES[force - 1];
    const d0 = T.radius * 0.86;
    const p: Vec3 = [
      Math.sin(ang) * d0 + R(-40, 40),
      Math.cos(ang) * d0 + R(-40, 40),
      height * R(0.9, 1.1),
    ];
    // reto é do lugar do jogador para o centro; cada lançamento desvia para um lado
    const aim = ang + R(-MAX_AIM_DEVIATION, MAX_AIM_DEVIATION);
    const dir: Vec3 = [-Math.sin(aim), -Math.cos(aim), 0];
    const sp = speed * R(0.92, 1.08) * (T.radius / 294);
    const die: Die = {
      fallOff: o.fallOff,
      id: "d" + ++seq,
      bounce,
      drag,
      rim,
      deflect,
      rand,
      trail: [],
      p,
      v: [dir[0] * sp, dir[1] * sp, Math.min(lift * R(0.8, 1.2), maxLift(p[2]))],
      w: [R(-24, 24), R(-24, 24), R(-14, 14)],
      q: qn([R(-1, 1), R(-1, 1), R(-1, 1), R(-1, 1)]),
      st: "fly",
      lock: -1,
      t: 0,
      a: 1,
      rgb: hex(o.color),
      label: o.label ?? "",
      labels: FACES.map((f) => f.num),
      forced: o.value,
      val: 0,
      onLand: o.onLand,
    };
    dice.push(die);
    if (dice.length > MAX) dice.splice(0, dice.length - MAX);
    if (raf === null && canvas) {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
    return die.id;
  }

  /** troca os números das faces para que a face `f` mostre `value` (mantendo opostas = 21) */
  function relabel(d: Die, f: number, value: number) {
    if (d.labels[f] === value) return;
    const g = d.labels.indexOf(value);
    const L = d.labels;
    [L[f], L[g]] = [L[g], L[f]];
    const of = FACES[f].opp,
      og = FACES[g].opp;
    if (of !== g) [L[of], L[og]] = [L[og], L[of]];
  }

  const topFace = (q: Quat) => {
    let best = -2,
      bi = 0;
    FACES.forEach((f, i) => {
      const z = qrot(q, f.n)[2];
      if (z > best) {
        best = z;
        bi = i;
      }
    });
    return bi;
  };

  // ------------------------------------------------ física
  function step(dt: number) {
    const lim = T.radius - r;
    for (const hit of impacts) hit.age += dt;
    impacts = impacts.filter((hit) => hit.age < IMPACT_LIFE);
    for (const d of dice) {
      for (const point of d.trail) point.age += dt;
      d.trail = d.trail.filter((point) => point.age < TRAIL_LIFE);
      if (Math.hypot(d.v[0], d.v[1]) > TRAIL_MIN_SPEED)
        d.trail.push({ x: d.p[0], y: d.p[1], z: d.p[2], age: 0 });
      if (d.st === "rest") {
        d.t += dt;
        if (d.t > REST) d.a = Math.max(0, 1 - (d.t - REST) / FADE);
        continue;
      }
      d.v[2] -= G * dt;
      d.p[0] += d.v[0] * dt;
      d.p[1] += d.v[1] * dt;
      d.p[2] += d.v[2] * dt;

      // chão: quica enquanto cai rápido; depois fica rolando
      let ground = false;
      if (d.fallOff && d.p[2] < -180) {
        d.a = 0;
        d.onLand?.(d.forced ?? 1);
        continue;
      }
      // dado perdido nunca para no feltro, mesmo depois de bater em outro dado
      if (d.fallOff) {
        const min = T.radius * 1.5;
        if (Math.hypot(d.v[0], d.v[1]) < min) {
          const out = nrm([d.p[0] || 1, d.p[1], 0]);
          d.v[0] = out[0] * min;
          d.v[1] = out[1] * min;
        }
      }
      if (
        d.p[2] < r &&
        (!d.fallOff || Math.hypot(d.p[0], d.p[1]) < T.radius - r)
      ) {
        d.p[2] = r;
        if (d.v[2] < -110) {
          // dado rápido salta pelo feltro mesmo tendo caído pouco
          d.v[2] = Math.min(
            Math.max(
              -d.v[2] * d.bounce,
              Math.hypot(d.v[0], d.v[1]) * FLOOR_SKIP,
            ),
            maxLift(r),
          );
          d.v[0] *= BOUNCE_SLIDE;
          d.v[1] *= BOUNCE_SLIDE;
          d.w = d.w.map((x) => x * 0.6 + (Math.random() - 0.5) * 18) as Vec3;
        } else {
          d.v[2] = 0;
          ground = true;
        }
      }
      // parede circular (aro da mesa)
      const dist = Math.hypot(d.p[0], d.p[1]);
      if (dist > lim && !d.fallOff) {
        const nx = d.p[0] / dist,
          ny = d.p[1] / dist;
        d.p[0] = nx * lim;
        d.p[1] = ny * lim;
        const vn = d.v[0] * nx + d.v[1] * ny;
        if (vn > 0) {
          d.v[0] -= (1 + d.rim) * vn * nx;
          d.v[1] -= (1 + d.rim) * vn * ny;
          // o desvio usa a semente: todos os clientes veem o mesmo ricochete
          const turn = (d.rand() - 0.5) * 2 * d.deflect,
            [vx, vy] = d.v;
          d.v[0] = vx * Math.cos(turn) - vy * Math.sin(turn);
          d.v[1] = vx * Math.sin(turn) + vy * Math.cos(turn);
          const onRim = d.p[2] < r * RIM_HEIGHT;
          if (onRim && vn > TRAIL_MIN_SPEED)
            impacts.push({
              x: d.p[0],
              y: d.p[1],
              size: Math.min(1, vn / 2000),
              age: 0,
            });
          if (onRim && vn > RIM_KICK_MIN_HIT)
            d.v[2] = Math.max(
              d.v[2],
              Math.min(
                Math.max(vn * RIM_KICK, RIM_KICK_MIN),
                RIM_KICK_MAX,
                maxLift(d.p[2]),
              ),
            );
          d.w = d.w.map((x) => -x * 0.7 + (Math.random() - 0.5) * 16) as Vec3;
        }
      }
      // no chão: atrito e rotação de rolamento (ω = ẑ × v / r)
      if (ground && !d.fallOff) {
        const f = Math.exp(-(d.st === "settle" ? 7 : d.drag) * dt);
        d.v[0] *= f;
        d.v[1] *= f;
        const tw: Vec3 = [-d.v[1] / r, d.v[0] / r, 0],
          k = Math.min(1, 12 * dt);
        d.w = d.w.map((x, i) => x + (tw[i] - x) * k) as Vec3;
        if (d.st === "fly" && Math.hypot(d.v[0], d.v[1]) < 70) {
          d.st = "settle";
          d.lock = topFace(d.q);
          if (d.forced) relabel(d, d.lock, d.forced);
        }
      }
      // integra a orientação: q' = q + ½·dt·(ω ⊗ q)
      const wq: Quat = [
        0,
        d.w[0] * dt * 0.5,
        d.w[1] * dt * 0.5,
        d.w[2] * dt * 0.5,
      ];
      const dq = qmul(wq, d.q);
      d.q = qn([
        d.q[0] + dq[0],
        d.q[1] + dq[1],
        d.q[2] + dq[2],
        d.q[3] + dq[3],
      ]);

      // assentar: gira até a face travada ficar exatamente para cima
      if (d.st === "settle") {
        const nw = qrot(d.q, FACES[d.lock].n),
          ax = crs(nw, [0, 0, 1]),
          sa = Math.hypot(...ax),
          an = Math.atan2(sa, nw[2]);
        d.w = d.w.map((x) => x * Math.exp(-6 * dt)) as Vec3;
        if (an < 0.004 && Math.hypot(d.v[0], d.v[1]) < 4) {
          d.st = "rest";
          d.t = 0;
          d.v = [0, 0, 0];
          d.w = [0, 0, 0];
          d.val = d.labels[d.lock];
          d.onLand?.(d.val);
        } else if (sa > 1e-6) {
          const s = Math.min(an, an * 7 * dt + 0.004);
          d.q = qn(qmul(qax([ax[0] / sa, ax[1] / sa, ax[2] / sa], s), d.q));
        }
        if (Math.hypot(d.v[0], d.v[1]) < 4) {
          d.v[0] = 0;
          d.v[1] = 0;
        }
      }
    }
    // colisão entre dados (esferas); dado parado conta como massa infinita
    for (let i = 0; i < dice.length; i++)
      for (let j = i + 1; j < dice.length; j++) {
        const A = dice[i],
          B = dice[j];
        if (A.a < 1 || B.a < 1) continue;
        const dx = sub(B.p, A.p),
          dd = Math.hypot(...dx);
        if (dd <= 0 || dd >= 2 * r) continue;
        const ma = A.st === "rest" ? 0 : 1,
          mb = B.st === "rest" ? 0 : 1;
        if (!ma && !mb) continue;
        const n = dx.map((x) => x / dd) as Vec3,
          pen = 2 * r - dd,
          tot = ma + mb;
        A.p = A.p.map((x, t) => x - (n[t] * pen * ma) / tot) as Vec3;
        B.p = B.p.map((x, t) => x + (n[t] * pen * mb) / tot) as Vec3;
        const rv = dot(sub(B.v, A.v), n);
        if (rv < 0) {
          const jimp = (-1.7 * rv) / tot; // restituição 0.7
          A.v = A.v.map((x, t) => x - n[t] * jimp * ma) as Vec3;
          B.v = B.v.map((x, t) => x + n[t] * jimp * mb) as Vec3;
          for (const D of [A, B])
            if (D.st !== "rest") {
              // tiro em outro dado não pode lançar o dado para fora da tela
              D.v[2] = Math.min(D.v[2], maxLift(D.p[2]));
              D.w = D.w.map((x) => x + (Math.random() - 0.5) * 20) as Vec3;
              if (D.st === "settle") D.st = "fly";
            }
        }
      }
    dice = dice.filter((d) => d.a > 0);
  }

  // ------------------------------------------------ desenho
  function rr(x: number, y: number, w: number, h: number, rad: number) {
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }

  function draw() {
    if (!ctx) return;
    const { K, C, VIEW } = cam();
    const proj = (x: number, y: number, z: number): [number, number] => [
      T.cx + x,
      T.cy + y * K - z * C,
    ];
    const pdir = (d: Vec3): [number, number] => [d[0], d[1] * K - d[2] * C];
    const HALF = nrm([
      LIGHT[0] + VIEW[0],
      LIGHT[1] + VIEW[1],
      LIGHT[2] + VIEW[2],
    ]);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // sombras
    for (const d of dice) {
      const h = Math.max(0, d.p[2] - r),
        f = 1 / (1 + h / 90),
        g = proj(d.p[0], d.p[1], 0);
      ctx.globalAlpha = d.a * 0.55 * f;
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.ellipse(
        g[0] + h * 0.15,
        g[1] + 2,
        r * 1.15 * (1.3 - 0.3 * f),
        r * 0.5 * (1.3 - 0.3 * f),
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    // rastro do tiro: marca o caminho do dado, inclusive os ricochetes
    ctx.lineCap = "round";
    for (const d of dice) {
      ctx.strokeStyle = `rgb(${d.rgb.join(",")})`;
      for (let i = 1; i < d.trail.length; i++) {
        const a = d.trail[i - 1],
          b = d.trail[i],
          fresh = 1 - b.age / TRAIL_LIFE;
        ctx.globalAlpha = d.a * 0.7 * fresh;
        ctx.lineWidth = r * (0.25 + 0.75 * fresh);
        ctx.beginPath();
        ctx.moveTo(...proj(a.x, a.y, a.z));
        ctx.lineTo(...proj(b.x, b.y, b.z));
        ctx.stroke();
      }
    }
    // impacto no aro
    for (const hit of impacts) {
      const grown = hit.age / IMPACT_LIFE,
        ground = proj(hit.x, hit.y, 0),
        radius = r * (0.8 + (1.5 + 3 * hit.size) * grown);
      ctx.globalAlpha = 0.9 * (1 - grown);
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 2 + 4 * hit.size * (1 - grown);
      ctx.beginPath();
      ctx.ellipse(ground[0], ground[1], radius, radius * K, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // dados, de trás para frente
    for (const d of dice
      .slice()
      .sort((a, b) => a.p[1] - b.p[1] || a.p[2] - b.p[2])) {
      ctx.globalAlpha = d.a;
      const sc = 1 + d.p[1] * 0.00045; // um pouco maior quando está mais perto
      const wv = VERTS.map((v) => {
        const t = qrot(d.q, v);
        return [
          d.p[0] + t[0] * r * sc,
          d.p[1] + t[1] * r * sc,
          d.p[2] + t[2] * r * sc,
        ] as Vec3;
      });
      const vis: { i: number; nw: Vec3; fa: number }[] = [];
      FACES.forEach((f, i) => {
        const nw = qrot(d.q, f.n),
          fa = dot(nw, VIEW);
        if (fa > 0) vis.push({ i, nw, fa });
      }); // backface culling (sólido convexo: dispensa z-sort)

      ctx.lineJoin = "round";
      for (const o of vis) {
        const pts = FACES[o.i].v.map((i) => proj(...wv[i]));
        const sh = 0.32 + 0.68 * Math.max(0, dot(o.nw, LIGHT)); // Lambert
        const c = d.rgb.map((x) => Math.round(14 + x * sh * 0.86));
        ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
        ctx.beginPath();
        ctx.moveTo(...pts[0]);
        ctx.lineTo(...pts[1]);
        ctx.lineTo(...pts[2]);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = GOLD;
        ctx.globalAlpha = d.a * 0.85;
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.globalAlpha = d.a;
        const spec = Math.pow(Math.max(0, dot(o.nw, HALF)), 18); // brilho (Blinn-Phong)
        if (spec > 0.02) {
          ctx.fillStyle = `rgba(255,248,230,${(spec * 0.5).toFixed(3)})`;
          ctx.fill();
        }
      }
      // números: cada face recebe uma transformação afim projetada, então o texto "deita" na face
      for (const o of vis) {
        if (o.fa < 0.28) continue;
        const vs = FACES[o.i].v.map((i) => wv[i]);
        const cw: Vec3 = [
          (vs[0][0] + vs[1][0] + vs[2][0]) / 3,
          (vs[0][1] + vs[1][1] + vs[2][1]) / 3,
          (vs[0][2] + vs[1][2] + vs[2][2]) / 3,
        ];
        const u = nrm(sub(vs[0], cw)),
          rt = crs(u, o.nw);
        let pr = pdir(rt);
        const pd = pdir([-u[0], -u[1], -u[2]]);
        if (pr[0] * pd[1] - pr[1] * pd[0] < 0) pr = [-pr[0], -pr[1]]; // evita texto espelhado
        const pc = proj(...cw);
        ctx.setTransform(
          dpr * pr[0],
          dpr * pr[1],
          dpr * pd[0],
          dpr * pd[1],
          dpr * pc[0],
          dpr * pc[1],
        );
        ctx.font = `700 ${(r * 0.52 * sc).toFixed(1)}px ${NUM_FONT}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.globalAlpha = d.a * Math.min(1, (o.fa - 0.28) * 3);
        const n = d.labels[o.i],
          tx = n === 6 || n === 9 ? n + "." : String(n);
        ctx.lineWidth = 2.4;
        ctx.strokeStyle = "rgba(11,14,16,.85)";
        ctx.strokeText(tx, 0, 1);
        ctx.fillStyle = "#FFF6DF";
        ctx.fillText(tx, 0, 1);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.globalAlpha = d.a;
      }
      // etiqueta "nome valor"
      if (SHOW_BADGE && d.st === "rest") {
        const top = proj(d.p[0], d.p[1], d.p[2] + r * 1.05),
          pop = Math.min(1, d.t * 5),
          crit = d.val === 20;
        ctx.font = `600 11px ${LBL_FONT}`;
        const nw = d.label ? ctx.measureText(d.label).width : 0;
        ctx.font = `700 15px ${NUM_FONT}`;
        const vw = ctx.measureText(String(d.val)).width;
        const bw = (d.label ? nw + 24 : 12) + vw + 8,
          bh = 24,
          bx = top[0] - bw / 2,
          by = top[1] - 30 - (1 - pop) * 8;
        ctx.globalAlpha = d.a * pop;
        if (crit) {
          ctx.shadowColor = "rgba(240,204,128,.9)";
          ctx.shadowBlur = 16;
        }
        rr(bx, by, bw, bh, 4);
        ctx.fillStyle = crit ? "#2A2010" : "rgba(11,14,16,.92)";
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = crit ? GOLD : "rgba(217,169,78,.6)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        let x = bx + 8;
        if (d.label) {
          ctx.fillStyle = `rgb(${d.rgb.join(",")})`;
          ctx.fillRect(bx + 7, by + 8, 7, 8);
          ctx.font = `600 11px ${LBL_FONT}`;
          ctx.fillStyle = "#C8C0AE";
          ctx.fillText(d.label, bx + 19, by + bh / 2 + 0.5);
          x = bx + 24 + nw;
        }
        ctx.font = `700 15px ${NUM_FONT}`;
        ctx.fillStyle = GOLD;
        ctx.fillText(String(d.val), x, by + bh / 2 + 1);
        ctx.beginPath();
        ctx.moveTo(top[0] - 4, by + bh);
        ctx.lineTo(top[0], by + bh + 5);
        ctx.lineTo(top[0] + 4, by + bh);
        ctx.fillStyle = crit ? GOLD : "rgba(217,169,78,.6)";
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------ loop (só roda enquanto há dados)
  function frame(ts: number) {
    const dt = last ? Math.min(0.033, (ts - last) / 1000) : 0.016;
    last = ts;
    step(dt / 2);
    step(dt / 2); // 2 subpassos = colisões mais estáveis
    draw();
    raf = dice.length ? requestAnimationFrame(frame) : null;
  }

  return {
    toss,
    clear() {
      dice = [];
      impacts = [];
      draw();
    },
    setTable(t) {
      T = { ...t };
      draw();
    },
    destroy() {
      if (raf !== null) cancelAnimationFrame(raf);
      raf = null;
      ro?.disconnect();
      dice = [];
    },
    count: () => dice.length,
    step,
    snapshot: () =>
      dice.map((d) => ({ id: d.id, p: d.p, v: d.v, st: d.st })),
  };
}
