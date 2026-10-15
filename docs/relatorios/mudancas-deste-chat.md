# Mudanças realizadas nesta conversa

Resumo do trabalho no mtg4fun até 13/10/2026. Este documento reúne a atualização do projeto, os ajustes de regras e interface e as revisões pedidas após visualizar a mesa.

**Estado registrado em 13/10/2026:** trabalho na branch `work/testes-mesa`, com commits locais autorizados por você. Naquela etapa, sem push, PR ou merge. A `master` não recebeu alterações. O endereço do ambiente de desenvolvimento é [localhost:8080](http://localhost:8080). Este relatório preserva o histórico daquela entrega.

## 1. Atualização do GitHub e execução local

- Buscamos as atualizações de branches remotas e tags do GitHub.
- Atualizamos o checkout `work/local-env` com 52 commits da `origin/master`, por fast-forward, chegando ao commit `efbaeda`, sem conflitos.
- Executamos `docker compose up -d --build api app` para construir e iniciar a aplicação.
- Confirmamos API e frontend em execução e MySQL saudável. O ambiente usa Air/Vite para aplicar alterações por hot reload.
- Para os ajustes seguintes, criamos uma branch própria e a renomeamos para `work/testes-mesa`, conforme a orientação de usar uma branch de testes.

## 2. Revelação de cartas

- Abrir uma carta no painel é uma visualização local. Essa ação não revela a carta para os outros jogadores.
- A revelação pública depende de uma ação explícita, como **Revelar para todos** ou revelar cartas pelo grimório.
- Fechar o detalhe oculta a revelação da carta controlada pelo jogador, salvo se ele marcar **Manter revelada ao fechar**.
- Essa opção mantém a carta pública até ocultar ou passar para o próximo turno.
- Passar turno limpa as revelações de todos os jogadores, sem mover cartas entre zonas nem alterar sua ordem.
- Corrigir para o turno anterior não restaura revelações.
- A zona Reveladas ganhou **Ocultar todas reveladas**, que oculta somente as cartas do próprio jogador. O atalho é **H**.
- A mensagem de revelação foi ajustada para explicar a nova duração.
- Revelar o topo usa uma consulta compartilhada com cartas públicas, sem abrir uma segunda consulta simultânea. Depois de ocultar, o dono ainda pode retomar e devolver as cartas.
- Mantivemos compatibilidade com snapshots antigos que possuem a área temporária de cartas reveladas.
- Acrescentamos recuperação de confirmação perdida dentro do detalhe: **Tentar novamente** reutiliza a intenção original, sem repetir a ação.

## 3. Comandante, fichas e mudanças de zona

- Corrigimos o encolhimento da zona do Comandante causado pela expansão de Reveladas. Os testes comparam posição e tamanho antes e depois de revelar/ocultar.
- Centralizamos as transições de zona em `placeCards`, no arquivo `api/internal/rooms/zone_transitions.go`, incluindo compras e consultas.
- Fichas e cópias agora são removidas do jogo quando seu destino é qualquer zona fora do campo: cemitério, exílio, mão, grimório, comando ou área de consulta.
- Novas instâncias têm a flag `isToken`. Instâncias antigas continuam reconhecidas por `instanceKind`.
- Cartas normais que saem do campo para cemitério ou exílio perdem todos os marcadores de cor, modificadores de poder/resistência, estado virado e face para baixo.
- A limpeza não apaga a identidade da carta nem troca a face escolhida. Revelações seguem o ciclo descrito acima.
- O Registro informa a remoção de fichas/cópias. As ações continuam usando permissões, persistência e proteção contra repetição do servidor.

## 4. Marcadores, vida e poder/resistência

- Marcadores de cor e poder/resistência oferecem input numérico e botões **− / +**, com alteração unitária.
- Inputs aceitam inteiros negativos, validam valores inválidos e confirmam com **Enter** ou ao sair do input.
- Os controles de vida mantêm definir, adicionar e subtrair, com confirmação por Enter para definir o valor.
- Os números dos marcadores foram centralizados horizontal e verticalmente dentro dos círculos, mantendo suas cores e tamanhos.
- O primeiro input recebe foco ao abrir os controles. O polling não interrompe a digitação.
- Uma confirmação digitada enquanto outra ação está em andamento aguarda a liberação do controle.
- As mudanças seguem sincronizadas com os participantes autorizados e registradas no log, preservando a privacidade das cartas ocultas.

## 5. Barra de ações e atalhos

A barra acima da mão reúne, na mesma fileira: **Comprar**, **Passar turno**, **Desvirar todas**, **Grimório** e **Ações**.

| Atalho | Ação |
| --- | --- |
| D | Comprar uma carta |
| U | Desvirar todas as permanentes do próprio campo |
| N | Passar para o próximo turno e limpar as revelações |
| H | Ocultar todas as próprias cartas reveladas |

- Os atalhos aparecem nas dicas dos botões e estão documentados no README.
- Não disparam durante digitação, com modificadores de teclado, repetição de tecla ou diálogo aberto.
- Clique no grimório abre suas ações; duplo clique compra uma carta e cancela a abertura pendente do menu.
- Há feedback visual leve e uma proteção de 450 ms contra compras repetidas numa sequência acidental de duplos cliques.
- Após sua revisão, retiramos **Grimório** e **Ações** da fileira da mão e removemos seu posicionamento flutuante no celular.
- Em espaço estreito, a barra permite scroll horizontal para manter os cinco botões na mesma fileira.

## 6. Layout da mesa e painel da carta

- O cabeçalho da partida foi unificado em uma barra compacta de aproximadamente 40 px, com retorno ao lobby, sala, observação, turno, ordem e acesso ao Registro.
- A coluna de jogadores/Registro ficou recolhível, com largura de 240–260 px. Começa recolhida em telas de até 1000 px.
- Os jogadores aparecem em cartões compactos, com nome, vida e quantidades no campo e na mão.
- Os nomes e as contagens de Comandante, Grimório, Cemitério e Exílio foram centralizados e separados para caber sem cortes. Zonas vazias mostram **Vazio**, sem repetir seu nome no centro.
- O Registro tem altura limitada e scroll interno.
- O detalhe da carta usa duas colunas: imagem de um lado, botões e controles do outro, incluindo Fechar, estados, revelação, marcadores e cópia.
- O painel foi verificado em viewport de 720 px de altura. Telas muito baixas têm fallback de scroll; a partida continua usando orientação horizontal no celular.

## 7. Campo, pilhas e revisão das linhas

- Mantivemos agrupamento manual por posição/fileira, com até três cartas por pilha e manipulação independente de cada carta.
- O layout reserva a largura das cartas viradas e os deslocamentos das pilhas para evitar colisão com a pilha vizinha.
- O campo conserva zoom e scroll para acessar cartas fora da área visível.
- Inicialmente acrescentamos linhas horizontais visíveis. Após a imagem enviada por você, removemos somente o fundo que desenhava essas linhas.
- O campo agora tem fundo contínuo. Essa revisão preservou coordenadas, espaçamento, encaixe nas fileiras e agrupamento das cartas.
- Criamos cenários de teste pela API real: pilhas de duas e três cartas, uma carta em pé com duas viradas, vizinha da pilha mista e linha cheia com overflow.
- Os cenários geram `campo-cenarios.png` e `painel-carta.png` nos relatórios de `app/test-results/`.

Para gerar os cenários visuais em banco descartável:

```bash
npm test --prefix app -- ajustes-mesa.spec.ts --workers=2
```

## 8. Login, salas e decks

- Ajustamos a apresentação para manter o tema escuro/verde, hierarquia, espaçamento e adaptação a desktop/celular.
- Login ganhou título mais compacto e apresentação consistente, preservando autenticação e mensagens de erro.
- Salas mostram nome, participantes em formato x/6, status, vagas e ação de entrada, com apresentação de loading e estado vazio.
- A biblioteca ganhou cartões de seleção com nome e quantidade de cartas, mantendo importação de .cod, consulta e exclusão.
- **Não criamos editor de decks nem cadastro/miniatura de comandante.** Após a consulta sobre esse escopo, você pediu para deixar essa parte como estava. As operações e contratos dos decks foram preservados.

## 9. Documentação e verificações realizadas

- Atualizamos README e referências de decisões para refletir os novos comportamentos, preservando os registros históricos.
- Registramos o escopo autorizado e as revisões em [Ajustes de regras e interface da mesa](../decisions/22-ajustes-da-mesa.md).
- A suíte completa Go passou com executável HTTP e MySQL real, cobrindo permissões, privacidade, limpeza de estados, fichas/cópias, revelações, log e recuperação após reinício.
- `go -C api vet ./...`, build e tipos do frontend, três testes unitários dos gestos, links locais e `git diff --check` passaram.
- A última execução ampla de navegador teve 54 testes aprovados, 23 omitidos pelos critérios existentes e uma falha de sincronização no teste de arraste por toque. Corrigimos a espera pela posição confirmada; o arraste passou depois em seis repetições, duas por variante.
- O conjunto posterior de ajustes/estados/fichas passou nove cenários, com três omissões por orientação vertical, incluindo recuperação de confirmação perdida.
- Após remover as linhas do Campo, ajustes e posicionamento passaram sete cenários, com duas omissões por orientação vertical.
- Após unificar os cinco botões, os cenários de ajustes passaram em desktop e celular horizontal: quatro aprovados e duas omissões por orientação vertical.
- Conferimos o Docker local: frontend respondeu 200, API respondeu 401 sem sessão, conforme esperado, e MySQL estava saudável.
- Esses resultados são verificações de execuções específicas, não uma afirmação de que toda a suíte foi repetida após cada alteração visual. A suíte operacional Docker de produção não foi executada.

## 10. O que permanece para depois

- Revisão manual do visual e dos fluxos por você no ambiente local.
- Você autorizou os commits locais na branch de testes após revisar os ajustes. Publicação da branch e PR não foram executados nesta etapa.
- Editor de decks e cadastro de comandante ficaram fora destes ajustes por sua orientação.
- Agrupamento automático por tipo não foi acrescentado: a organização do campo permanece manual.

A instalação de dependências e os testes usaram ferramentas temporárias e bancos descartáveis. Nenhum seed de teste foi aplicado às contas ou mesas do Docker local, e não trocamos banco, autenticação, transporte multiplayer ou infraestrutura do projeto.
