# Aceite integrado da mesa v2

Issue: [#68](https://github.com/rafacvs/mtg4fun/issues/68). Esta matriz aponta
as fronteiras que demonstram o contrato da [spec #57](https://github.com/rafacvs/mtg4fun/issues/57).
Os cenários de navegador iniciam o executável Go e um MySQL descartável; não
interceptam a API de jogo. Quando controlam a imagem da carta, é somente para
evitar uma dependência de rede na arte.

| Requisito observável | Evidência de navegador/API real | Captura ou artefato gerado |
| --- | --- | --- |
| Zoom de 100%, 125%, 150% e 200% em 1366×768 e 1920×1080, sem perder seleção, estado ou posições | `game-ui.spec.ts` — `zoom real preserva a partida, seleção e painéis em resoluções desktop`; compara a projeção persistida pela API com a leitura de outro cliente | anexo Playwright `espaco-util-zoom.json` com espaço CSS e viewport visual por combinação |
| Um a seis participantes, composição, foco, mão e campos densos | `desktop-table.spec.ts`, `game-ui.spec.ts` e `mesa.spec.ts` | `mesa-quatro.png`, `seis-mesas.png`, `06-visao-geral.png` |
| Posições esparsas, pilhas e cartas viradas sem regravação pela apresentação | `game-ui.spec.ts` — `visão geral mantém cartas visíveis...`; compara snapshot e log antes/depois pela API | `visao-geral-posicoes-esparsas.png` |
| Troca de orientação, toque, mão, foco e painéis móveis | `mobile-experience.spec.ts` e `mobile-table.spec.ts` | `horizontal48.png`, `vertical48.png`, `mobile-gestures48.png` |
| Prévia, inspeção, registro, grimório, ações e jogador | `game-ui.spec.ts`, `ajustes-mesa.spec.ts` e `grimorio.spec.ts` | `01-mesa.png` a `06-visao-geral.png`, `previa-no-registro.png`, `grimorio-consulta.png` |
| Privacidade, permissões, recusa e confirmação no fluxo de jogo | `mesa.spec.ts`, `acoes-http.spec.ts`, `transferir-controle.spec.ts` | traces Playwright em falha; o estado é observado por outro cliente e pela API |
| Acesso, decks, preparação e encerramento | `acesso.spec.ts`, `decks.spec.ts`, `inicio.spec.ts`, `finalizar.spec.ts` | `login.png`, `biblioteca-de-decks.png`, `grimorio-e-finalizar.png` |
| Estados, contadores, fichas/cópias, consulta/revelação, controle, turno/dado/moeda | `estados.spec.ts`, `contadores.spec.ts`, `fichas.spec.ts`, `grimorio.spec.ts`, `transferir-controle.spec.ts` e `card-actions.spec.ts` | capturas específicas mantidas nos resultados Playwright |

## Como repetir

Compile o cliente antes da suíte, pois o executável de teste serve `app/dist`:

```bash
npm --prefix app run build
npm --prefix app test -- tests/e2e/game-ui.spec.ts --project=desktop --workers=1
npm --prefix app test -- tests/e2e/mobile-experience.spec.ts tests/e2e/mobile-table.spec.ts --workers=1
```

Os artefatos ficam em `app/test-results/`, que é ignorado pelo Git para não
transformar capturas locais em fonte de verdade. A matriz documenta a cobertura
reproduzível; cada execução deve registrar seu resultado no PR, sem converter
histórico de testes em aprovação do produto.
