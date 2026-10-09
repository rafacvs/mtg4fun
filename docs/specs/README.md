# Especificações do mtg4fun

Estas especificações consolidam o esboço inicial e as decisões da conversa de refinamento. São autossuficientes: o esboço pode ser removido posteriormente sem perda de requisitos. Esta tarefa não altera nem exclui o esboço.

## Leitura

1. [Acesso, salas, decks e catálogo](01-acesso-salas-decks.md).
2. [Mesa manual e experiência de jogo](02-mesa-e-interface.md).
3. [Servidor, sincronização e persistência](03-servidor-e-persistencia.md).

As três especificações formam uma única primeira versão, incluindo jogo completo no celular desde o início.

## Objetivo e direção

Criar uma aplicação web própria para jogar Magic online entre amigos que conhecem o jogo, reduzindo as dificuldades da interface do Cockatrice. O resultado esperado é código organizado e mantível e partidas efetivamente jogáveis.

Cockatrice é referência funcional para ações, zonas, estados de cartas e interações. Servatrice é referência para responsabilidades de servidor. Não há tradução direta de C++/Qt, obrigação de repetir sua arquitetura ou compatibilidade de protocolo. A compatibilidade explicitamente necessária é com decks .cod e o fluxo de catálogo/imagens.

A arquitetura usa React e TypeScript no navegador, Go no servidor, banco de dados e hospedagem própria com Docker. Desktop e celular compartilham cliente e servidor. HTTP atende operações comuns; comunicação em tempo real usa WebSocket ou mecanismo equivalente, a escolher na implementação.

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

## Decisões técnicas ainda abertas

Banco específico, bibliotecas, estrutura interna de módulos, mecanismo exato de realtime, formato de mensagens, contratos detalhados da API, algoritmo de hash de senha e intervalos de atualização do catálogo serão definidos na implementação. Não são requisitos já aprovados.

As fronteiras de teste descritas são propostas desta síntese; não houve aprovação separada delas nem código/testes existentes para reutilizar. Testar comportamento público do servidor e fluxos reais no navegador, evitando testes que espelhem estruturas internas.

## Fora da primeira versão

Motor de regras, validação de formatos/decks, fases, editor de decks, sideboard na mesa, espectadores, cadastro público, administração web, recuperação por e-mail, voz/chat de conversa integrados, desfazer genérico, compatibilidade com Servatrice e interface de histórico/replay.

Manter snapshots e logs de partidas encerradas é obrigatório; isso não implica oferecer navegação por histórico nem manter uma versão de snapshot para cada ação.
