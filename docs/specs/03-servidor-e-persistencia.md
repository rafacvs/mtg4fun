# Servidor, sincronização e persistência

## Problema

Partidas precisam sobreviver à saída dos jogadores e ao encerramento do servidor, mantendo informações privadas e estado consistente entre até seis participantes. Uma conexão temporária não pode ser confundida com a existência da partida.

## Solução

Servidor Go como autoridade do estado compartilhado, clientes React/TypeScript recebendo somente informações permitidas e snapshots completos persistidos junto do log a cada ação confirmada.

## Histórias de usuário

1. Como jogador, quero que minha ação apareça aos demais, para compartilhar a mesma mesa.
2. Como jogador, quero que ações simultâneas tenham resultado consistente, para não duplicar ou perder cartas.
3. Como jogador, quero que mãos e grimórios permaneçam privados, para preservar informações ocultas.
4. Como jogador, quero que o log não revele consultas privadas, para registrar atividade sem divulgar cartas.
5. Como participante, quero desconectar sem apagar a partida, para retomá-la depois.
6. Como participante, quero que os demais continuem quando eu desconectar, para não bloquear o jogo.
7. Como participante, quero recuperar mão, posições, contadores e turno, para retomar o mesmo estado.
8. Como responsável pelo servidor, quero reiniciar o serviço sem perder ações confirmadas, para operar a aplicação.
9. Como jogador, quero que falha ao salvar não seja apresentada como sucesso, para confiar no estado confirmado.
10. Como participante, quero recuperar votações pendentes ao retornar, para responder às propostas.
11. Como participante, quero preservar o estado final após encerramento, para que snapshots não sejam excluídos.
12. Como responsável pelo servidor, quero hospedar com Docker, para manter uma operação simples.
13. Como mantenedor, quero responsabilidades claras e poucas dependências, para entender e modificar o código.

## Decisões de implementação

Escolhas ainda abertas seguem a [política de decisões do AGENTS.md](../../AGENTS.md#requisitos-e-decisões). Expressões como “a definir na implementação” não autorizam decisões de grande impacto sem aprovação explícita do usuário.

### Arquitetura e responsabilidades

- React/TypeScript renderiza cartas, zonas, campos, mão, seleção, foco e controles; envia intenções e representa o estado autorizado recebido.
- Go mantém usuários, salas, participantes, estado das partidas, permissões, ações, sincronização e persistência.
- Banco guarda credenciais com hash, decks por usuário, configuração de vida inicial, estado persistente e logs.
- Catálogo e cache de imagens são compartilhados no servidor; armazenamento concreto será escolhido na implementação.
- Hospedagem própria com Docker; não reproduzir toda a infraestrutura do Servatrice.
- HTTP para ações; salas recebem atualizações por SSE conforme a [decisão aprovada da issue 03](../decisions/03-salas-sse.md). O transporte realtime das partidas permanece a definir (WebSocket ou equivalente), exigindo aprovação explícita. O stream de salas não resolve filtragem privada, controle único de conexão, prontidão ou votações. Não fixar bibliotecas, banco, esquema detalhado ou organização física de módulos nesta spec.
- Separação de responsabilidades não implica múltiplos serviços ou camadas desnecessárias.
- A sessão de autenticação/conexão não representa a duração da partida.
- Cockatrice informa conceitos úteis; não determina interfaces internas ou protocolo.

### Estado e acesso

- Servidor é autoridade: verifica identidade, participação e permissão das ações sem validar regras de Magic.
- Serializar ações conflitantes por partida ou usar mecanismo equivalente de consistência. O resultado compartilhado deve ter uma ordem definida.
- Preservar identidade das instâncias das cartas, zona, ordem, dono/controlador, face, ocultação, posição/fileira/sobreposição, contadores, fichas e cópias.
- Preservar participantes, vida, ordem/turno, configuração relevante, preparação e votos pendentes.
- Snapshot contém informação completa interna; nunca enviá-lo integralmente a clientes sem filtragem.
- Filtrar mensagens de estado, atualizações e log por jogador. Não basta esconder dados no React.
- Consultas privadas registram a ação sem divulgar nomes/ordem a outros jogadores.
- Cartas ocultas não devem ter identidade vazada por dados de face, URLs de imagem ou outros metadados enviados a observadores.
- Nova conexão assume controle e invalida ações da anterior no servidor, não apenas na UI.
- Ao reconectar, enviar visão atual autorizada em vez de depender de mensagens perdidas.
- Falhas e reenvios não devem aplicar uma mesma intenção duas vezes; mecanismo concreto será escolhido na implementação.

### Persistência e confirmação

- Cada ação que altera estado e é aceita salva snapshot completo atualizado e entrada(s) de log na mesma transação.
- Confirmar sucesso e distribuir estado confirmado somente após a persistência bem-sucedida.
- Se a gravação falhar, não confirmar nem publicar a alteração como concluída.
- Estado e log não podem divergir por falha parcial.
- Reinício carrega o último estado confirmado e restaura partidas independentemente de jogadores conectados.
- Desconexão altera presença, não remove participante, suas cartas ou lugar.
- Snapshot inclui dados necessários para preservar a ordem do grimório; retomada não embaralha nem sorteia novamente.
- Persistir votos pendentes e não concluir votação sem unanimidade.
- Snapshot é o mecanismo de recuperação; não exigir reconstrução por event sourcing.
- Manter estado/snapshot final e log após encerramento. Não excluir automaticamente por decisão de finalizar.
- Não foi exigida retenção de um snapshot histórico por ação; atualizar o snapshot recuperável e preservar o final atende ao requisito. Se versões forem adicionadas, não são obrigação desta primeira versão.
- Encerramento é estado terminal para ações de jogo; conservação de dados não implica reabertura ou tela de histórico.
- Reinício aprovado volta à preparação; os resultados aleatórios do novo início são persistidos como os demais estados.

## Decisões de teste

Proposta: preferir uma fronteira principal, o contrato público do servidor, com múltiplos clientes e banco real de teste. Usar fluxos no navegador apenas para comportamentos de interação/renderização que essa fronteira não cobre. Na elaboração original desta spec, ainda não existiam módulos ou testes para tomar como precedente.

Critérios observáveis:

- Dois ou mais clientes recebem estados compatíveis após ações aceitas.
- Ações simultâneas sobre a mesma carta não a duplicam, perdem ou deixam em zonas incompatíveis.
- Reenvio após perda de confirmação não duplica uma ação.
- Payloads e log de oponentes não contêm mãos, ordem de grimório ou identidade de cartas ocultas.
- Reiniciar o servidor após ações confirmadas restaura estado completo, log e votos.
- Desconectar todos mantém a partida; retorno recupera a mesma visão autorizada.
- Falha de persistência não gera confirmação de sucesso ou estado publicado como durável.
- Estado e log são gravados atomicamente.
- Controle antigo não consegue agir após nova conexão.
- Reinício votado limpa estado de jogo conforme preparação; encerramento preserva snapshot/log e rejeita novas ações de jogo.
- Salas distintas não interferem umas nas outras.
- Upload/exclusão de deck e atualização de catálogo não corrompem partidas em andamento.

Não há metas quantitativas de latência/carga definidas além de seis jogadores por sala e múltiplas salas. Evitar inventar números como critérios aprovados. Validar a operação Docker quando existir uma implementação.

## Fora do escopo

Compatibilidade com Servatrice, arquitetura distribuída obrigatória, motor de regras, event sourcing obrigatório, histórico de snapshots por ação, replay e UI de partidas encerradas.

## Notas adicionais

As garantias descritas são comportamentais. Algoritmos de ordenação de comandos, idempotência, migrações e formatos concretos de snapshots serão definidos na implementação com a menor complexidade que cumpra essas garantias.
