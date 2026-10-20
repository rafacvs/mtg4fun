# 01: Jogador — vida junto ao nome e edição direta

**What to build:** Ver a vida à esquerda, ao lado do nome no cabeçalho do
campo, e editar a própria vida imediatamente ao abrir o menu do jogador, sem
navegar para outra etapa. O acesso a marcadores permanece separado.

**Blocked by:** Nenhum (pode começar imediatamente).

**Status:** implementado

Requisitos: [spec do refinamento](../../specs/04-refinamento-ui-mesa.md).
Integra o [refactor local](README.md), sem modificar a issue da entrega anterior.

- [x] Nome e vida permanecem agrupados à esquerda no cabeçalho, inclusive com nomes longos e telas estreitas; focar o campo continua sendo um acesso separado.
- [x] Menu próprio mostra uma linha compacta e identificada de vida com menos, input do total e mais; não há botão Vida que leve a outra etapa nem bloco redundante do total.
- [x] Digitação confirma por Enter ou perda de foco, sem enviar valores intermediários, inválidos ou duplicar uma confirmação; preservar zero, negativos e limites existentes.
- [x] Menos e mais alteram imediatamente a vida em um; envio e erro têm estados claros e não permitem disparos conflitantes.
- [x] Marcadores continuam em acesso separado; voltar deles retorna ao menu com vida editável.
- [x] Oponente permanece somente para leitura e nenhuma permissão ou informação privada muda.
- [x] Reutilizar o editor numérico existente, extraindo compartilhamento se necessário sem alterar contratos ou outros comportamentos dos contadores.
- [x] Fluxos de navegador com servidor real comprovam edição, botões, sincronização, persistência após recarga, ausência de envio duplicado e consulta do oponente.
- [x] Revisar prints e interação em celular vertical/horizontal, dispositivo médio e desktop; manter controles acessíveis por teclado/toque e alvos de pelo menos 44 por 44 pixels.
- [x] Registrar verificações efetivamente executadas e eventuais limites, sem tratar resultados históricos como validação nova.

## Verificação

Em 19/10/2026, na branch `refactor/game-ui`:

- `npm run build` em `app/` passou, incluindo `tsc --noEmit`.
- `npx playwright test tests/e2e/contadores.spec.ts` passou em desktop, celular e celular horizontal, com API Go e MySQL descartável. O teste cobre posição da vida, nome longo em 320 px, Enter seguido de blur sem log duplicado, valores inválidos, zero, negativo, botões, marcadores, oponente somente leitura e recarga.
- `tests/e2e/game-ui.spec.ts` passou nos três projetos, com os dois cenários de largura 320–desktop ignorados fora do projeto desktop, como já era.
- `tests/e2e/ajustes-mesa.spec.ts --project=desktop` passou; marcadores e poder/resistência continuam em campo numérico.
- Revisão visual em `http://127.0.0.1:8080`, sala local de revisão, em 390×844, 768×1024, 1280×800 e 844×390. Nome e vida ficam juntos à esquerda, o menu próprio abre no editor, o oponente fica somente leitura e a vida 12 permanece após recarregar. Sem rolagem horizontal da página. Botões do editor e o botão de abrir o jogador mediram pelo menos 44×44 px, inclusive no celular horizontal.

Limite: o estado de erro do `PanelFeedback` não foi forçado com uma falha real do servidor nesta entrega. O editor desabilita os controles enquanto `busy` está ativo, mas a resposta local chega antes de uma asserção estável desse instante.
