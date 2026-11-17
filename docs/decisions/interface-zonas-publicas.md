# Consulta do cemitério e do exílio

## Pedido e implementação

Em 17/11/2026, o usuário pediu que cemitério e exílio seguissem a folha de busca do grimório. Na revisão visual, pediu seleção de cartas com destinos, como no grimório, e controles no canto direito para reduzir, expandir e fechar. Reduzir mantém um painel à esquerda; expandir recupera a consulta e sua seleção.

As zonas públicas mantêm consulta de outros jogadores somente para leitura. O dono pode selecionar cartas e enviá-las por meio da ação existente, inclusive escolhendo topo ou fundo quando aplicável. Arrastar entre cartas continua reordenando a zona.

## Verificação

O build do frontend e os dois testes de navegador de `zona-publica-arraste.spec.ts` em desktop passaram, incluindo seleção, envio ao campo, redução, expansão, reordenação e visualização pelo oponente. A revisão visual do usuário segue em andamento.
