# Prévia lateral de cartas

Relacionada às issues [04](../issues/04-consultar-cartas-e-imagens.md) e
[07](../issues/07-navegar-pelos-campos.md), e aos
[ajustes da mesa](22-ajustes-da-mesa.md).

## Solicitação e aprovação explícita

Em 15/10/2026, o usuário pediu uma prévia ao passar o mouse sobre cartas,
usando o Cockatrice como referência, e um botão ao lado de **Recolher registro**.
Após consulta sobre posição e função, confirmou: **“ponto 1 - acima dos
jogadores/registro, no canto direito”** e **“ponto 2 - isso, ele vai continuar
recolhendo tudo ali”**.

## Implementação

A prévia fica no topo da lateral direita, acima de jogadores e registro.
**Ocultar prévia / Mostrar prévia** controla essa seção; **Recolher registro**
recolhe toda a lateral, incluindo a prévia. Mostrar a prévia com a lateral
recolhida também abre a lateral. A configuração é local à tela.

Mouse sobre cartas da mesa, mão e zonas visíveis atualiza a imagem; foco por
teclado também permite consultar a prévia. A última carta permanece enquanto
o ponteiro sai dela, e sua identidade é reavaliada a partir do snapshot atual.
Carta oculta pelo servidor não exibe nome nem imagem; carta removida deixa de
ser exibida. Falha de imagem mantém nome e texto disponível.

A consulta é local, sem movimentar, revelar ou ocultar cartas e sem criar
ações no registro. Clique/toque continua abrindo os controles existentes.
São usados os endpoints e o cache de imagens já existentes, sem nova fonte,
dependência ou alteração no contrato da API.

Na revisão para o PR, a regressão de navegador detectou que o painel do
grimório cobria o botão **Ações** no desktop, após a reorganização anterior
da barra. O posicionamento dos painéis no desktop agora acompanha a altura
real da mão/barra usando `ResizeObserver`, preservando o acesso às ações.
O teste de grimório verifica a separação visual e a troca de painéis por clique.

## Validação em 15/10/2026

- `go -C api vet ./...` e `go -C api test ./... -count=1`: passaram,
  incluindo integração HTTP/executável com MySQL descartável.
- Build/TypeScript e três testes unitários do frontend: passaram.
- Regressão completa de navegador após corrigir a sobreposição: 56 passaram,
  25 omitidos por orientação, mouse/toque e opt-in. Nenhuma falha final.
- O fluxo novo verifica hover na mão e no campo, posição acima dos jogadores,
  botões de prévia/recolhimento completo, ausência de ações no log, atualização
  de identidade oculta e falha de imagem com acesso por foco de teclado.
- Capturas da prévia e do grimório no desktop foram revisadas; links locais
  da documentação e `git diff --check` foram conferidos.

A primeira tentativa de navegador não iniciou por faltar o Chromium exigido
pelo Playwright. Após instalá-lo, os testes executaram; a falha de sobreposição
encontrada na regressão foi corrigida e a suíte repetida. Esses resultados são
desta entrega. Não foi executada a suíte operacional Docker de produção nem
repetido o smoke opt-in do provedor de imagens, que permanece o existente.

## Prévia pelo registro, em 15/10/2026

Na revisão seguinte, o usuário pediu que passar o mouse sobre uma carta no
registro também mostrasse sua imagem na prévia lateral. O pedido estende a
consulta local aos nomes de cartas associados às novas entradas de registro.
Mouse, foco por teclado e toque reutilizam o mesmo painel, sem enviar ações
de jogo, revelar cartas ou abrir o diálogo de edição.

Eventos passam a guardar referências de instância junto do payload JSON
existente, na mesma transação da ação. O servidor acrescenta `cards` opcional
às entradas da visão do registro, com ID e nome somente quando permitidos.
O texto e os contratos de entrada das ações existentes são preservados, sem
nova tabela, migration, dependência ou transporte.

As referências respeitam tanto a visibilidade no momento da ação quanto a
visibilidade atual do snapshot filtrado. Uma ação originalmente privada não
ganha referências públicas retroativamente quando a carta aparece no campo.
Cartas que voltam ao grimório, à mão privada do oponente ou ficam face para
baixo sem revelação deixam de oferecer uma prévia identificada ao observador.
O próprio jogador pode consultar as referências ainda permitidas na sua mão.
Fichas removidas deixam de ter referência consultável no snapshot atual.

Entradas antigas sem IDs de cartas continuam legíveis como texto; não se
deduzem vínculos por quantidade, posição, nome ou ordem das zonas. Textos
públicos históricos de revelação mantêm a semântica anterior.

Validação desta extensão em 15/10/2026, distinta da execução acima:

- `go -C api vet ./...` e suíte completa `go -C api test ./... -count=1`:
  passaram com MySQL descartável. O novo teste HTTP verifica referências de
  movimentos públicos, privacidade ao voltar à mão/grimório ou ficar face para
  baixo, ausência de exposição retroativa de movimentos privados, recuperação
  após reinício e leitura de eventos antigos sem referências.
- Build/TypeScript e três testes unitários do frontend: passaram.
- Regressão de navegador: 62 passaram, 28 omitidos por orientação/mouse e
  opt-in. O novo fluxo usa a API real e verifica hover/toque/foco pelo registro,
  prévia sem abrir diálogo ou criar ações, mudança de visibilidade para outro
  participante e recarga. Captura desktop conferida.
- Links locais e `git diff --check`: conferidos. O usuário também confirmou
  manualmente que o comportamento visual estava correto.

A suíte operacional Docker de produção não foi repetida nesta extensão.
