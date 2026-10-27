# Especificações do mtg4fun

Estas especificações consolidam o esboço inicial e as decisões da conversa de refinamento. São autossuficientes: o esboço pode ser removido posteriormente sem perda de requisitos.

## Leitura

1. [Acesso, salas, decks e catálogo](01-acesso-salas-decks.md).
2. [Mesa manual e experiência de jogo](02-mesa-e-interface.md).
3. [Servidor, sincronização e persistência](03-servidor-e-persistencia.md).

As três especificações formam uma única primeira versão, incluindo jogo completo no celular desde o início.

A experiência vigente da mesa é a
[nova experiência](05-nova-experiencia-da-mesa.md), aprovada em 24/10/2026.
Ela substitui a apresentação da [mesa](02-mesa-e-interface.md) e a direção
visual do [refinamento premium](04-refinamento-ui-mesa.md). As regras de jogo
da mesa permanecem, com a consulta do grimório redefinida na spec nova.

A [preparação, o início e o reinício](06-preparacao-inicio-e-reinicio.md),
aprovados em 24/10/2026, passam a valer sobre criação da sala, prontidão,
compra inicial, comandante do deck e reinício votado. Substitui a compra
manual e a escolha de comandante pelo grimório da spec de acesso, e o
exemplo não salvo da nova experiência para esses campos.

## Objetivo e direção

Criar uma aplicação web própria para jogar Magic online entre amigos que conhecem o jogo, reduzindo as dificuldades da interface do Cockatrice. O resultado esperado é código organizado e mantível e partidas efetivamente jogáveis.

Cockatrice é referência funcional para ações, zonas, estados de cartas e interações. Servatrice é referência para responsabilidades de servidor. Não há tradução direta de C++/Qt, obrigação de repetir sua arquitetura ou compatibilidade de protocolo. A compatibilidade explicitamente necessária é com decks .cod e o fluxo de catálogo/imagens.

A arquitetura usa React e TypeScript no navegador, Go no servidor, banco de dados e hospedagem própria com Docker. Desktop e celular compartilham cliente e servidor. HTTP atende operações comuns. Para salas, atualizações em tempo real usam SSE, conforme a [decisão aprovada](../decisions/03-salas-sse.md); o transporte de partidas permanece aberto (WebSocket ou mecanismo equivalente), exigindo aprovação antes da implementação.

Preferir menos componentes, camadas, dependências e código, desde que os comportamentos permaneçam corretos e claros.

## Vocabulário

- **Usuário:** conta autenticada.
- **Sala:** espaço de preparação e participação de até seis jogadores.
- **Partida:** jogo com participantes fixados após o início e estado persistente.
- **Jogador/participante:** usuário que ocupa um lugar na sala/partida.
- **Conexão:** vínculo temporário de um navegador com o servidor; não define a existência da partida.
- **Campo:** zona de cartas em jogo de um jogador; também chamada de mesa do jogador na interface.
- **Foco:** campo ampliado para observação; não muda identidade, permissões ou ações próprias.
- **Dono:** jogador de origem de uma carta.
- **Controlador:** jogador autorizado a manipulá-la no campo.
- **Catálogo:** dataset compartilhado de cartas e fichas.
- **Snapshot:** representação completa e durável do estado da partida.
- **Log:** registro de ações, com informações filtradas conforme visibilidade.
- **Formato da sala:** rótulo Commander, Livre ou Duelo. Não é regra de jogo.
- **Comandante:** carta do deck escolhida pelo dono na biblioteca. No início,
  se ainda estiver no grimório, vai à zona de comando.
- **Arquivo de partida:** snapshot e log de uma partida substituída por
  reinício. Não há tela nem replay nesta versão.

## Decisões técnicas ainda abertas

Banco específico, bibliotecas, estrutura interna de módulos, mecanismo exato de realtime, formato de mensagens, contratos detalhados da API, algoritmo de hash de senha e intervalos de atualização do catálogo não foram fixados por estas specs. A [decisão de SSE para salas](../decisions/03-salas-sse.md) resolve somente esse escopo, sem definir transporte/contratos de partidas. Isso não autoriza decisões autônomas de grande impacto: siga a [política de decisões do AGENTS.md](../../AGENTS.md#requisitos-e-decisões), consultando o usuário e obtendo aprovação explícita antes de implementar essas escolhas. Detalhes locais de baixo impacto seguem a mesma política.

A implementação inicial da issue 01 usou SQLite sem aprovação e essa escolha
foi rejeitada. Nas issues [19](../issues/19-substituir-sqlite.md) e
[20](../issues/20-docker-dev-e-producao.md), o usuário aprovou MySQL 26.7.0,
serviços separados de API e frontend, dev com Air/Vite, produção com Go
compilado/Nginx e configuração por ambiente preparada para banco externo.
O MySQL começa vazio, preservando o armazenamento SQLite antigo. O
[registro da aprovação e implementação](../decisions/19-20-mysql-e-docker.md)
acompanha o estado e a validação da entrega.

As fronteiras de teste descritas são propostas da síntese original, quando ainda não havia código/testes existentes para reutilizar. O registro de acesso documenta as verificações da implementação posterior. Testar comportamento público do servidor e fluxos reais no navegador, evitando testes que espelhem estruturas internas.

## Fora da primeira versão

Motor de regras, validação de formatos/decks, fases, editor de decks, sideboard na mesa, espectadores, cadastro público, administração web, recuperação por e-mail, voz/chat de conversa integrados, desfazer genérico, compatibilidade com Servatrice e interface de histórico/replay.

Manter snapshots e logs de partidas encerradas é obrigatório; o reinício
aprovado arquiva a partida abandonada. Isso não implica oferecer navegação
por histórico nem manter uma versão de snapshot para cada ação.
