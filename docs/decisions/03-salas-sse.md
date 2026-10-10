# Salas: HTTP, SSE e persistência

Issue: [03: Criar e entrar em salas](../issues/03-criar-e-entrar-em-salas.md).

## Proposta e aprovação explícita

A implementação existente tinha somente autenticação HTTP, sem transporte em
realtime. Foram apresentadas ao usuário as alternativas WebSocket, SSE e polling
HTTP. A recomendação foi SSE para distribuir atualizações de salas do servidor
para os navegadores, com ações por HTTP e sem nova dependência de transporte.
WebSocket permite comunicação bidirecional, mas essa capacidade não é necessária
para listar/criar/entrar; polling HTTP acrescenta requisições periódicas por cliente.

Na conversa de implementação paralela das issues 02 e 03, o usuário aprovou:
**“card 3 - sim. Registr mudanças de decisao nas docs se Websocket ou outra solução era prevista e alteramos, para termos os registro. Veja se alguma outra issue/spec foi impactada por essa decisão de SSE”**.

A proposta aprovada inclui cookie existente, SSE com reconexão/snapshot completo,
rotas abaixo, criador ocupando a primeira vaga, título gerado `Sala #ID`, entrada
repetida idempotente e configuração de streaming no proxy. Essa autorização
é específica para salas; não aprova transporte ou contrato de partida.

WebSocket era uma alternativa aberta nas specs, junto de mecanismos equivalentes;
não era um requisito obrigatório nem uma implementação substituída. SSE resolve
essa escolha apenas no escopo desta entrega.

## Contrato público e operação

- `GET /api/rooms`: `{ "rooms": [...] }` para usuários autenticados.
- `POST /api/rooms`: JSON `{}`; 201 com `{ "room": ... }`. O criador já participa.
- `POST /api/rooms/{id}/participants`: JSON `{}`; 200 com `{ "room": ... }`.
  Já participar retorna a mesma sala; 409 para sala cheia/iniciada, 404 para
  sala inexistente e 400 para identificador/corpo inválido.
- `GET /api/rooms/events`: stream `text/event-stream`, eventos `rooms` com
  `{ "rooms": [...] }`. Envia a visão completa inicial e após mudanças, permitindo
  reconexão sem replay de mensagens antigas. A lista contém somente identidade
  pública dos participantes; nenhum deck, credencial ou estado privado de jogo.
- Sala contém `id`, `title`, `creatorId`, `status`, `participants` (`id`, `name`)
  e `vacancies`. Estado inicial `preparing`, capacidade seis. A participação
  permanece após saída/logout/reinício; esta issue não cria ação de sair de sala.
- Rotas exigem a sessão existente. Erros JSON seguem o contrato de acesso em PT-BR,
  sem cache; ações HTTP conservam a proteção de origem existente.
- Stream revalida sessão e consulta snapshots MySQL a cada segundo, enviando
  apenas alterações; heartbeat mantém o proxy ativo. Revogação/expiração emite
  `session-expired` e encerra. Falha de armazenamento emite `sync-error` e encerra,
  para que o cliente reconecte e obtenha estado confirmado.
- Nginx desativa buffering na rota de eventos. O servidor renova o prazo de escrita
  do stream por envio, preservando timeouts das demais rotas. Nenhum broker,
  dependência nova ou arquivo de dados é necessário.

Snapshots JSON de preparação e entradas de log ficam no MySQL aprovado. Cada
criação/entrada nova salva snapshot e log numa transação antes de confirmar.
Entrada bloqueia a linha da sala (`FOR UPDATE`), serializando disputa pela última
vaga. A leitura da lista usa um único SELECT consistente. Repetir a entrada não
altera participantes nem gera nova entrada de log. Salas têm linhas/snapshots
independentes; nenhuma memória de conexão determina sua existência.

## Auditoria de impacto nas especificações e issues

Todos os arquivos em `docs/specs/` e `docs/issues/` foram conferidos. Referências
explícitas a WebSocket/realtime abertas aparecem no índice de specs e na spec
03; ambas passam a apontar para esta decisão, limitando SSE a salas.

- [Issue 05: preparação/início](../issues/05-preparar-e-iniciar-partida.md): poderá
  ampliar snapshot/status das salas e suas atualizações, mas não recebe aqui
  contrato de prontidão/início nem escolha de transporte de estado privado.
- [Issue 16: retomada/controle](../issues/16-retomar-e-transferir-conexao.md):
  EventSource reconecta a lista; não implementa controle exclusivo da conexão,
  invalidação de ações HTTP antigas ou retomada da partida.
- Issues 08, 09, 11, 14, 15 e 17 exigem sincronização/persistência genérica sem
  transporte obrigatório. Seus requisitos permanecem vigentes; SSE de salas
  não entrega manipulação de cartas, log privado, turnos, votação ou snapshots
  de partida. Qualquer decisão de grande impacto nesses contratos continua
  exigindo consulta/aprovação explícita conforme AGENTS.md.

## Validação

Os resultados efetivamente executados serão registrados na entrega/PR. A
aprovação de transporte acima é do usuário; testes não substituem essa aprovação.
