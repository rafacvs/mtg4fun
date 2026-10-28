# Continuidade, acessibilidade e operações da paridade V2

Issue: [#80](https://github.com/rafacvs/mtg4fun/issues/80), parte da
[spec #70](https://github.com/rafacvs/mtg4fun/issues/70).

Este mapa aponta a fronteira pública que deve provar cada continuidade da
mesa. Ele não transforma uma execução histórica, nem uma captura automatizada,
em aceite visual: a comparação HTML V2 × aplicação e a revisão explícita do
usuário pertencem ao aceite integrado da issue #81.

| Requisito/operação | Teste de navegador com API real | Evidência observada |
| --- | --- | --- |
| Grade, foco e retorno de 2 a 6 no desktop | `desktop-table.spec.ts` | Todos os campos, mão e zonas permanecem acessíveis; o snapshot API não muda ao focar. |
| Crônica e prévia sem cobrir o campo | `desktop-table.spec.ts`, `game-ui.spec.ts` | Painel pode abrir e fechar, e a prévia/leitura segue uma ação pública do jogador. |
| Horizontal móvel, doca, foco e turno | `mobile-experience.spec.ts` | Toque em controle visível compra, passa o turno e entra/sai do foco sem cobrir o campo. |
| Vertical móvel, seleção e orientação | `mobile-experience.spec.ts`, `mobile-table.spec.ts` | Faixas inteiras, alvos de toque de 44 px, seleção múltipla, mão e URL/estado sobrevivem à rotação. |
| Posição manual, densidade, cartas viradas e agrupamentos | `desktop-table.spec.ts`, `posicionamento.spec.ts`, `game-ui.spec.ts` | API e segundo cliente observam as posições/estados; a apresentação não os grava novamente. |
| Zonas, grimório, marcadores, ações de carta e lote | `grimorio.spec.ts`, `contadores.spec.ts`, `card-actions.spec.ts`, `virar-selecao.spec.ts` | Ações pela interface alcançam a API real e têm efeito persistido/visível. |
| Privacidade, permissão, sincronização e recusa | `mesa.spec.ts`, `acoes-http.spec.ts`, `transferir-controle.spec.ts` | Duas sessões e a API pública distinguem os dados e as autorizações de cada participante. |
| Teclado, rótulos, foco e movimento reduzido | `ajustes-mesa.spec.ts`, `game-ui.spec.ts`, `login-visual.spec.ts` | Controles são alcançados por teclado, mantêm foco durante atualização e respeitam preferência de movimento. |
| Encerramento, dado, moeda e turno | `finalizar.spec.ts`, `card-actions.spec.ts`, `contadores.spec.ts` | Fluxos continuam acionáveis pela interface e confirmados no estado da partida. |

## Execução reproduzível

As suítes usam o executável Go e MySQL descartável por meio de `fixtures.ts`;
elas não fabricam a API de jogo. Imagens de carta podem ser controladas apenas
para manter os gestos determinísticos, enquanto sessão, ações e persistência
continuam reais.

```bash
npm --prefix app run build
npm --prefix app test -- tests/e2e/desktop-table.spec.ts tests/e2e/game-ui.spec.ts --project=desktop --workers=1
npm --prefix app test -- tests/e2e/mobile-experience.spec.ts tests/e2e/mobile-table.spec.ts --workers=1
```

As capturas de cada execução ficam em `app/test-results/` e não são baseline
visual. Para concluir a entrega, registrar os quatro viewports exigidos e os
pares da referência V2 conforme a issue #81.
