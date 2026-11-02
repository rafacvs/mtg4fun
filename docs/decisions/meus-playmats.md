# Meus playmats

Entrega: [solicitação e aceite](../issues/meus-playmats.md).

## Proposta e aprovação explícita

Em 02/11/2026, o usuário pediu uma tela de playmats baseada nas imagens da
conversa e aplicação do fundo no campo. Foi criada a branch `feat/meus-playmats`
na mesma worktree, mantendo a porta 8080, conforme solicitado.

Foram apresentadas duas decisões antes da implementação:

1. Guardar imagens e preferências no MySQL existente, vinculadas à conta,
   validando JPG/PNG/WEBP de até 10 MB. Foi explicado o aumento do banco e
   comparada a alternativa de arquivos em volume com backup separado.
2. Todos veriam o playmat do dono de cada campo. O modo aleatório sortearia um
   dos quatro cenários ao iniciar e manteria o resultado até o fim. Mudanças
   na biblioteca valeriam para a próxima partida.

O usuário respondeu **“1 - sim / 2 - sim”**, aprovando ambas explicitamente.
Depois pediu que o visual seguisse Salas e Meus decks; confirmou a largura
unificada com **“ta certinho agora, pode abrir um pr”**. Essa aprovação se
refere ao resultado local observado, sem substituir as verificações técnicas.

## Implementação e contrato

- Migration `00003_playmats.sql`: imagens em `MEDIUMBLOB`, metadados por dono
  e preferências em JSON. Não altera dados das partidas existentes.
- `GET /api/playmats`: lista a biblioteca e preferências da própria conta.
- `POST /api/playmats`: multipart com uma imagem no campo `file`.
- `PUT /api/playmats/preferences`: JSON com `random`, `preset`, `imageId`,
  `fit`, `zoom` (100–200) e `dim` (0–100).
- `GET /api/playmats/{id}/image`: dono da imagem ou conta autenticada quando
  a imagem já foi usada numa partida, coerente com a visualização por espectadores.
- `DELETE /api/playmats/{id}`: somente o dono; retira da biblioteca e retorna
  a preferência ao modo aleatório se a imagem excluída estava selecionada.
  Os bytes são preservados para não quebrar snapshots de partidas.
- A inicialização fixa a configuração em cada jogador do snapshot persistente,
  na transação existente da partida. Snapshots antigos sem configuração mantêm
  os fundos anteriores por assento.
- Upload valida extensão, formato decodificado, integridade e dimensão máxima
  de 40 milhões de pixels para limitar memória na decodificação. O pacote
  oficial `golang.org/x/image/webp` acrescenta suporte a WEBP; JPEG/PNG usam a
  biblioteca padrão. Não há provedor externo nem serviço adicional.
- Nginx permite corpo de até 11 MB nas rotas de playmats; a API aplica o limite
  de 10 MB ao arquivo e limita o overhead multipart. O backup do MySQL passa
  a incluir também as imagens; remoção da biblioteca não libera esses bytes.

## Verificação

- Integração HTTP com MySQL real descartável: formatos PNG/JPEG, rejeição de
  extensão incompatível, arquivo truncado e excesso de tamanho; autenticação,
  isolamento entre donos, proteção de origem, configurações inválidas,
  compartilhamento na partida e persistência após mudança, exclusão e reinício.
- Navegador com API real: upload WEBP, proporções, ajuste, zoom, escurecimento,
  gravação, recarga, renderização do fundo e comparação das três telas em
  desktop e celular. Os resultados executados são descritos no PR.
- Verificação manual local pelo usuário: upload e uso do playmat funcionaram;
  revisão de composição aprovada após padronização de visual e largura.
- A pedido do usuário, foram criadas duas simulações locais via API: partida
  com quatro jogadores e sala em preparação com dois. A segunda preservou
  os estados de todas as salas anteriores. Contas, imagens pessoais e credenciais
  usadas na simulação não fazem parte do código nem dos testes.

Resultados desta entrega:

- `npm run build --prefix app`: passou (TypeScript e build Vite); permanece o
  aviso de tamanho do chunk de Three.js.
- `go test ./internal/...` e `go vet ./...`: passaram no container dev.
- Integração direcionada de playmats e migrations: passou com MySQL real.
- `npm test --prefix app -- playmats.spec.ts --workers=1`: seis cenários passaram
  em desktop, celular vertical e horizontal, usando API real e bancos descartáveis.
- `go test ./... -count=1`: encontrou uma falha em
  `TestTransferredSelectionPreservesZoneRulesAndRollsBack`, na expectativa
  de posição 520 contra posição observada 400. A mesma falha foi reproduzida
  executando somente esse teste em uma cópia temporária da `master`
  `a548f0a`, sem as alterações de playmats. Não foi corrigida nesta entrega.
- Configuração Compose, links locais e `git diff --check`: passaram.
