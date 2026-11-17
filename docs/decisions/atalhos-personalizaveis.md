# Atalhos de teclado personalizáveis

## Contexto e aprovação

Em 17/11/2026, o usuário aprovou explicitamente no chat a implementação da
lista de atalhos da mesa, a personalização persistida neste navegador, os
comandos de seleção e navegação, os toggles de Grimório/Cemitério/Exílio e a
numeração automática dos itens de menus. A autorização cobre somente os
atalhos descritos no refinamento do chat; não cria regras de Magic nem ações
novas na API. A mudança respeita a consulta do grimório e os destinos que as
ações existentes permitem.

## Comportamento implementado

- A tecla `K` abre ajuda com busca por rótulo, edição de combinações, validação
  de conflitos, restauração dos padrões e persistência em `localStorage`.
  Valores inválidos ou dados antigos/corrompidos não impedem a mesa de abrir;
  armazenamento indisponível mantém os ajustes apenas na sessão.
- Padrões: `D` comprar, `U` desvirar, `Espaço` passar turno, `Shift+Espaço`
  corrigir turno, `G` grimório, `R` ações, `F` ficha, `V` vida, `E` emojis,
  `K` ajuda, `Tab`/`Shift+Tab` navegar cartas, `Enter` selecionar, `I`
  inspecionar, `T` virar, `M` destinos, `H` mão, `C` alternar mão/campo,
  `N`/`Shift+N` observar jogadores, `B` próprio campo, `O` visão geral,
  `J` cemitério, `X` exílio e `Z` chat. Shift fica restrito a Espaço e N;
  Tab segue a navegação nativa dentro de painéis.
- Letras de comando não são capturadas em campos de texto, `contenteditable`,
  menus ou controles de formulário. Ctrl, Alt, Meta, repetição automática e
  composição IME são ignorados. Tab e Shift+Tab navegam a mão própria e o
  campo ativo fora de painéis; dentro deles, a navegação nativa permanece.
- Enter seleciona ou remove da seleção a carta focada sem mudar ordem ou zona.
  `I` inspeciona, `T` vira/desvira, `H` move à mão e `M` abre os destinos
  permitidos para a seleção. Navegar não seleciona cartas por si só.
- `G`, `J` e `X` abrem ou fecham Grimório, Cemitério e Exílio. Uma consulta
  de busca pendente só termina pelos controles de finalização existentes;
  tentar fechá-la exibe o aviso existente sem perder a consulta.
- Itens de menu explicitamente marcados pela camada comum recebem números
  sequenciais na ordem visual, incluindo opções desabilitadas para manter a
  posição estável. Digitar um número aciona somente sua opção habilitada.
  Campos numéricos mantêm a digitação normal; Enter confirma quantidade válida.
- O atalho de chat comunica com o componente de chat por `CustomEvent`
  `mtg4fun:chat-shortcut`, com `detail.action` igual a `open`, `hold` ou
  `release`. A integração de chat fornece a superfície visual separada do
  registro da partida.

## Verificação

Os testes e2e usam o navegador e a API reais, e os testes unitários verificam
somente validação/mapeamento determinístico dos atalhos. O resultado de cada
execução desta branch será registrado no relatório de entrega; não representa
aceite do usuário para merge.
