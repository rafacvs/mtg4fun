import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Page } from '@playwright/test';

const repositoryRoot = resolve(import.meta.dirname, '../../..');
const referenceCommit = '170a87f10caa5f11708429ad0890df9c1cdde5bb';
const referencePath = 'docs/redesign/mock-iterativo-v2.html';

export const v2Boards = [
  ['V1', 'Mesa em quadrantes · 4 jogadores', { width: 1440, height: 900 }],
  ['V2', 'Foco · ampliar um oponente', { width: 1440, height: 900 }],
  ['V3', 'Leitura · prévia ao passar o mouse', { width: 1440, height: 900 }],
  ['V4', 'Crônica aberta · grade se ajusta', { width: 1440, height: 900 }],
  ['V5', 'Celular horizontal · quatro campos', { width: 844, height: 390 }],
  ['V6', 'Celular horizontal · foco em um oponente', { width: 844, height: 390 }],
  ['V7', 'Celular vertical · faixas e carta selecionada', { width: 390, height: 844 }],
  ['V8', 'Celular vertical · faixa expandida', { width: 390, height: 844 }],
  ['V9', 'Celular vertical · ler carta de oponente', { width: 390, height: 844 }],
] as const;

type Board = typeof v2Boards[number];

const visualReviewPending = {
  composition: 'Aguardando revisão visual humana.',
  measures: 'Aguardando revisão visual humana.',
  typography: 'Aguardando revisão visual humana.',
  colors: 'Aguardando revisão visual humana.',
  playmat: 'Aguardando revisão visual humana.',
  frames: 'Aguardando revisão visual humana.',
  controls: 'Aguardando revisão visual humana.',
  differences: 'Aguardando revisão visual humana.',
  exceptionJustification: 'Aguardando revisão visual humana.',
} as const;

const reviewLabels: ReadonlyArray<[keyof typeof visualReviewPending, string]> = [
  ['composition', 'Composição'],
  ['measures', 'Medidas'],
  ['typography', 'Tipografia'],
  ['colors', 'Cores'],
  ['playmat', 'Playmat'],
  ['frames', 'Molduras'],
  ['controls', 'Controles'],
  ['differences', 'Diferenças'],
  ['exceptionJustification', 'Justificativa de exceção'],
];

function referenceHTML() {
  return execFileSync('git', ['show', `${referenceCommit}:${referencePath}`], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
}

function safeName(id: string) {
  return `${id.toLowerCase()}-referencia-v2.png`;
}

/**
 * Renders the immutable V2 document itself. It deliberately does not use an
 * application screenshot as a baseline: an unavailable reference is a test
 * failure, rather than an opportunity to compare the application to itself.
 */
export async function captureV2ReferenceBoards(page: Page, outputDirectory: string): Promise<Board[]> {
  mkdirSync(outputDirectory, { recursive: true });
  const temporaryDirectory = mkdtempSync(join(tmpdir(), 'mtg4fun-v2-reference-'));
  const referenceFile = join(temporaryDirectory, 'mock-iterativo-v2.html');
  writeFileSync(referenceFile, referenceHTML());

  try {
    await page.goto(pathToFileURL(referenceFile).href);
    for (const [id, title, viewport] of v2Boards) {
      const iframe = page.locator(`iframe[title="${title}"]`);
      await iframe.waitFor({ state: 'visible' });
      const content = page.frameLocator(`iframe[title="${title}"]`).locator('body');
      await content.waitFor({ state: 'visible' });
      await content.evaluate(async body => { await body.ownerDocument.fonts.ready; });
      const bodySize = await content.evaluate(body => body.getBoundingClientRect());
      if (bodySize.width < viewport.width || bodySize.height < viewport.height) {
        throw new Error(`A prancha ${id} ficou vazia ou incompleta (${bodySize.width}×${bodySize.height}).`);
      }
      const screenshot = join(outputDirectory, safeName(id));
      await iframe.screenshot({ path: screenshot });
      if (!existsSync(screenshot) || statSync(screenshot).size === 0) throw new Error(`A captura da prancha ${id} não foi criada.`);
    }
    return [...v2Boards];
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

export function writeV2ComparisonReport(outputDirectory: string, applicationCaptures: ReadonlyMap<string, string>) {
  const rows = v2Boards.map(([id, title, viewport]) => {
    const reference = safeName(id);
    const application = applicationCaptures.get(id);
    if (!application) throw new Error(`Falta a captura da aplicação para ${id}.`);
    return { id, title, viewport, reference, application, visualReview: visualReviewPending };
  });
  const report = {
    reference: { commit: referenceCommit, path: referencePath },
    status: 'captura técnica atual — aguardando comparação e aceite visual explícito do usuário',
    rows,
    differences: [
      'Cada par deve ser revisado contra a prancha V2 correspondente; esta execução não declara paridade nem aceite visual.',
      'Somente campo manual, carta inteira, dados reais e adaptação de 2–6 participantes são exceções aprovadas. Qualquer outra diferença é defeito a corrigir.',
      'A evidência funcional exige imagem completa obtida pelo endpoint público; indisponibilidade não pode ser substituída por placeholder.',
    ],
  };
  writeFileSync(join(outputDirectory, 'comparativo-v2.json'), `${JSON.stringify(report, null, 2)}\n`);
  const cards = rows.map(row => {
    const review = reviewLabels.map(([field, label]) => `<dt>${label}</dt><dd>${row.visualReview[field]}</dd>`).join('');
    return `<section><h2>${row.id} · ${row.title} (${row.viewport.width}×${row.viewport.height})</h2><p>Estado técnico: capturado com navegador, API pública e banco descartável. A avaliação visual permanece humana.</p><dl>${review}</dl><div><figure><figcaption>HTML V2 — referência</figcaption><img src="${row.reference}" alt="Referência ${row.id}"></figure><figure><figcaption>Aplicação — captura desta execução</figcaption><img src="${row.application}" alt="Aplicação ${row.id}"></figure></div></section>`;
  }).join('\n');
  writeFileSync(join(outputDirectory, 'comparativo-v2.html'), `<!doctype html><meta charset="utf-8"><title>Comparativo V2</title><style>body{font:16px system-ui;margin:2rem;background:#f5f4ef;color:#1f1e1d}section{margin:2rem 0;border-top:1px solid #bbb}div{display:flex;gap:1rem;align-items:start;overflow:auto}figure{margin:0;min-width:max-content}figcaption{font-weight:700;margin:.5rem 0}img{display:block;border:1px solid #777;max-width:none}</style><h1>Comparativo visual V2 — captura técnica atual</h1><p>Não declara paridade nem aceite visual. A referência é renderizada do commit ${referenceCommit}; o aceite depende de revisão explícita do usuário.</p>${cards}`);
}
