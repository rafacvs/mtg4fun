# Preparação, início e reinício

**Estado:** aprovada em 24/10/2026, na conversa de refinamento das issues
abertas. A implementação ainda não começou. Issue: https://github.com/rafacvs/mtg4fun/issues/52

Cards, na ordem em que podem começar:

1. [Dados reais do deck e escolha do comandante](https://github.com/rafacvs/mtg4fun/issues/34), sem bloqueio.
2. [Desfazer a prontidão](https://github.com/rafacvs/mtg4fun/issues/35), sem bloqueio.
3. [Criar mesa com nome, formato, lugares, vida e deck](https://github.com/rafacvs/mtg4fun/issues/38), depois de 35.
4. [Comprar 7 e pôr o comandante no comando](https://github.com/rafacvs/mtg4fun/issues/33), depois de 34.
5. [Reinício da partida por unanimidade](https://github.com/rafacvs/mtg4fun/issues/36), depois de 35 e 38.

Esta spec passa a valer sobre a criação da sala, a prontidão, o início da
partida e o reinício votado. Substitui, nesses pontos, a compra manual e a
escolha de comandante pelo grimório em
[acesso, salas e decks](01-acesso-salas-decks.md), completa a votação de
reinício em [mesa e interface](02-mesa-e-interface.md) e tira do “exemplo
não salvo” da [nova experiência](05-nova-experiencia-da-mesa.md) o que esta
entrega persiste. Formato da sala continua rótulo. A mesa continua manual,
sem motor de regras.

Aprovação: [decisão 49](../decisions/49-preparacao-inicio-e-reinicio.md).

## Problem Statement

O visual novo já mostra nome, formato, lugares, vida, deck, comandante, cores,
curva e tipos. O servidor ainda não guarda isso. A sala nasce como
“Sala #id”, com seis lugares e vida global 40. Confirmar o deck trava a
prontidão. O início deixa mão e comando vazios. Não há reinício. Quem senta
para jogar entre amigos precisa repetir à mão o que a mesa deveria fazer
sozinha, e não pode voltar uma partida à preparação sem destruir o jogo
abandonado.

## Solution

O catálogo em memória passa a expor o que o XML Cockatrice já tem: tipo
principal, CMC, cores e identidade de cor. A biblioteca resolve curva e
grupos na hora de listar. O dono do deck marca um comandante na lista daquele
deck. Criar mesa grava nome, formato, lugares, vida daquela sala e, se
houver, o deck do criador, sem deixá-lo pronto. Deck selecionado e prontidão
são coisas distintas; dá para desfazer o “estou pronto” e trocar o deck.
Todo início compra sete. Se o deck tem comandante e o nome ainda está nele,
essa carta vai à zona de comando antes das sete. Reinício por unanimidade
volta à preparação de verdade, arquiva snapshot e log da partida abandonada
e deixa a próxima começar limpa. Encerrar não muda.

## User Stories

1. Como jogador, quero que tipo, custo, CMC, cores e identidade de cor venham do XML do catálogo, para a curva e os grupos deixarem de ser exemplo.
2. Como jogador, quero ver esses dados resolvidos na listagem, para um catálogo novo atualizar a biblioteca sem eu reenviar o `.cod`.
3. Como jogador, quero buscar na lista do meu deck e marcar um comandante, para a mesa saber qual carta não é do 99.
4. Como jogador, quero fazer essa escolha depois do upload e de novo em Meus decks, para corrigir ou atrasar a decisão.
5. Como jogador, quero um deck sem comandante, para jogar Livre ou Duelo sem inventar uma lenda.
6. Como jogador, quero apagar a escolha do comandante, para o deck voltar a não ter um.
7. Como jogador, quero que um nome que não está no deck seja recusado, para não gravar um comandante fantasma.
8. Como jogador, quero um comandante por deck, para Partner e o segundo comandante continuarem manuais na mesa.
9. Como jogador, quero a identidade de cor do deck igual à `coloridentity` do comandante, para o cartão da biblioteca mostrar as cores daquela carta.
10. Como jogador, quero que sem comandante não apareça identidade, para o app não unir as cores do 99 como se fosse regra.
11. Como jogador, quero os grupos comandante, criaturas, mágicas, artefatos, terrenos e outras, para achar o que tem no deck.
12. Como jogador, quero o comandante fora do grupo do tipo dele, para ele não contar duas vezes.
13. Como jogador, quero a curva pelo CMC das cartas que não são o comandante, para o gráfico ser o do 99.
14. Como jogador, quero que Instant e Sorcery caiam em mágicas, e o `maintype` restante que não for criatura, artefato ou terreno caia em outras, para Planeswalker, Battle e Enchantment terem um lugar.
15. Como jogador, quero que os decks antigos nasçam sem comandante, para eu escolher quando quiser.
16. Como usuário, quero nomear a mesa na criação, para achar a sala no lobby sem ser “Sala #id”.
17. Como usuário, quero escolher o formato Commander, Livre ou Duelo, para o rótulo aparecer sem a mesa validar o deck.
18. Como usuário, quero definir de 1 a 6 lugares, para a vaga seguir essa mesa e não o teto fixo de seis.
19. Como usuário, quero definir a vida inicial de 1 a 999, com o formulário nascendo em 40, para um Duelo a 20 não herdar a vida global.
20. Como usuário, quero criar sem deck, para sentar e escolher na preparação.
21. Como usuário, quero mandar o deck no mesmo passo, para já chegar com ele selecionado e ainda não pronto.
22. Como criador, quero entrar sentado ao criar, como hoje, para não ter um passo extra de “entrar na minha mesa”.
23. Como usuário, quero que nome e formato sejam obrigatórios depois do trim, para não nascer mesa sem rótulo.
24. Como usuário, quero poder repetir o nome de outra mesa, para o grupo não discutir título único.
25. Como usuário, quero que nome, formato, lugares e vida não mudem depois de criar, para quem entra ver o que foi combinado.
26. Como jogador numa sala antiga, quero seis lugares, vida 40 e o título que ela já tem, para a migração não reescrever a mesa no ar.
27. Como jogador, quero escolher o deck sem ficar pronto, para montar a mesa sem travar o seletor.
28. Como jogador, quero desfazer “estou pronto” enquanto a partida não começou, para trocar de deck ou esperar alguém.
29. Como jogador, quero que desfazer a prontidão mantenha o deck selecionado, para não escolher de novo à toa.
30. Como criador, quero o botão de começar desabilitado dizendo quem falta, inclusive depois de alguém desfazer a prontidão, para não levar um erro no lugar do aviso.
31. Como jogador, quero que começar continue exigindo todos prontos e a autorização do criador, para o início não mudar de dono.
32. Como jogador, quero comprar sete ao iniciar, para a mão inicial não ser um atalho manual.
33. Como jogador com comandante no deck, quero essa carta na zona de comando antes das sete, para ela não ir à mão.
34. Como jogador sem comandante, ou com o nome ausente do grimório, quero só as sete, para o início não inventar uma carta.
35. Como jogador com menos de sete no grimório depois de tirar o comandante, quero o que restar, para um deck curto não recusar o início.
36. Como jogador, quero que o formato da sala não mude compra nem comando, para o rótulo não virar regra.
37. Como jogador, quero devolver e embaralhar à mão se precisar de mulligan, para não nascer um fluxo próprio.
38. Como jogador, quero propor o reinício da partida, para o grupo decidir se aquela mesa vale a pena.
39. Como jogador, quero aceitar ou recusar, para uma pessoa não reiniciar sozinha.
40. Como proponente, quero cancelar a proposta, para um clique errado não prender a mesa.
41. Como jogador que reconecta, quero ver a proposta e votar, para a unanimidade incluir quem caiu.
42. Como jogador, quero que a partida continue enquanto falta voto, para ninguém ficar parado.
43. Como jogador, quero que recusa ou cancelamento encerre a proposta, sem timeout e sem auto-aprovar desconectado.
44. Como jogador, quero que reinício e finalizar não fiquem abertos ao mesmo tempo, para não haver dois destinos da mesa.
45. Como jogador, quero que abrir a outra votação seja recusado enquanto a primeira existir, para o servidor ser a autoridade.
46. Como jogador, quero que a unanimidade volte à preparação com as mesmas pessoas e os mesmos decks selecionados, ninguém pronto, para trocar deck ou esperar.
47. Como jogador, quero sair depois do reinício e deixar a vaga livre, para outra pessoa sentar.
48. Como usuário, quero entrar numa vaga dessa preparação, para a sala voltar a ser sala de verdade.
49. Como jogador cujo deck foi excluído, quero ficar sem deck e não pronto, para escolher outro sem corromper a sala.
50. Como jogador, quero que o próximo início limpe mesa e contadores, restaure a vida daquela sala, carregue e embaralhe os decks e sorteie a ordem de novo, para não herdar o jogo abandonado.
51. Como jogador, quero que o jogo abandonado vá para o arquivo com snapshot e log, motivo `restarted` e data, para o histórico existir sem tela.
52. Como jogador, quero que o `GET` da mesa atual não devolva o arquivo, para a preparação e a partida nova não misturarem o jogo velho.
53. Como jogador, quero que o encerramento continue guardando snapshot e log na partida viva e fechando a sala, para finalizar não virar arquivo.
54. Como o grupo, quero guardar todos os arquivos, sem prazo, para um histórico futuro ter de onde ler.

## Implementation Decisions

- A mudança é de contrato da sala, da biblioteca e do início. A mesa manual, as zonas, as permissões, o turno, o encerramento por metade e a ausência de motor de regras permanecem.
- O catálogo em memória passa a guardar, além do que já guarda, `maintype`, `cmc`, `colors` e `coloridentity` lidos do XML Cockatrice. Não se copiam esses campos para as linhas do deck no MySQL. A listagem resolve na hora, como já faz com texto, ficha e disponibilidade.
- Grupos: a carta escolhida como comandante sai do grupo de tipo; `Creature` → criaturas; `Instant` e `Sorcery` → mágicas; `Artifact` → artefatos; `Land` → terrenos; o resto do `maintype` → outras. Curva: contagem por CMC inteiro das cartas que não são o comandante. Identidade do deck: `coloridentity` do comandante, ou ausente.
- O comandante é um nome de carta opcional persistido no deck. Tem de existir na lista daquele deck. Um por deck. Criar mesa e preparar só leem o que já está no deck; não há seletor de comandante na sala.
- Participante tem deck selecionado e flag de pronto, separados. Escolher ou trocar deck só vale enquanto não está pronto. Confirmar prontidão exige deck selecionado. Desfazer prontidão, enquanto a sala está em preparação, tira o pronto e mantém o deck.
- `POST` de criar sala deixa de aceitar só `{}`. Corpo: nome (texto após trim, obrigatório, não único), formato (`Commander`, `Livre` ou `Duelo`), lugares (1 a 6), vida (inteiro 1 a 999) e `deckId` opcional do criador, da biblioteca dele. O criador senta. Se veio deck, fica selecionado e não pronto. Recusar formato, lugares ou vida fora do intervalo. Nome vazio após trim é recusado.
- A sala grava nome, formato, lugares e vida inicial. Vagas = lugares menos sentados. O teto de seis continua o máximo de lugares, não mais a capacidade de toda sala. Vida inicial da partida nova vem daquela sala, não do `initial_life` global. Salas já existentes sem esses campos: título atual, seis lugares, vida 40, formato ausente. Depois de criar, esses campos não se editam.
- Formato é rótulo. Não valida deck, não muda lugares, vida, compra nem comandante.
- Início, depois de carregar e embaralhar cada grimório: se o deck do participante tem comandante e existe uma carta com esse nome no grimório, uma cópia vai à zona de comando. Em seguida cada jogador compra sete do que restou, ou o que houver. Mão e comando deixam de nascer vazios por omissão. Sem mulligan.
- Reinício da partida reutiliza o barramento de ações da mesa, com kinds distintos do encerramento. Qualquer participante propõe; cada um aceita ou recusa; o proponente cancela. Recusa ou cancelamento encerra a proposta. Sem timeout e sem auto-aprovar. Votos persistem e sobrevivem à reconexão. A partida segue enquanto espera.
- Só uma votação aberta. Com reinício aberto, finalizar é recusado. Com finalizar aberto, propor reinício é recusado. Recusa, cancelamento ou sucesso da atual libera a outra.
- Unanimidade de todos os participantes, inclusive desconectados quando voltarem. A sala volta a `preparing`. Participantes e decks selecionados permanecem; ninguém fica pronto. Quem quiser sai; vaga livre pode ser ocupada. Criador, nome, formato, lugares e vida da sala não mudam. Começar de novo exige todos prontos e o criador. Deck cujo arquivo foi excluído some da seleção; o participante fica sem deck e não pronto.
- `matches` continua uma partida viva por sala. No reinício aprovado, snapshot e log da partida atual vão para uma tabela de arquivo (`restarted` e timestamp) e a linha viva é liberada. O próximo início insere partida nova como hoje. Encerrar não usa o arquivo: a sala termina e o snapshot fica na partida viva. Sem endpoint, lista ou replay do arquivo neste lote. Sem prazo de retenção.
- O `GET` da mesa atual só lê a partida viva. Durante a preparação após reinício não há partida viva.
- Ações da mesa, SSE das salas e cookie de sessão permanecem. Transporte realtime da partida não é reaberto aqui.
- Textos da interface em PT-BR. Os nomes das cartas seguem o catálogo.

## Testing Decisions

Um bom teste observa o que o jogador ou o outro cliente observa. Não basta
uma coluna nova, um agrupamento interno repetido pelo teste, um mock que
sempre sucede no lugar do servidor, nem conferir que o arquivo foi escrito
sem provar que a mesa atual não o devolve.

Duas fronteiras, as que já existem:

- HTTP da API pública com MySQL real, em `api/tests/integration/`. A
  referência são as suítes de salas, decks, preparação, início e
  encerramento. Elas hoje provam o contrário de vários requisitos desta spec:
  criar com `{}`, vida global 40, grimório inteiro na biblioteca, prontidão
  só de ida e ausência de reinício. Esses casos precisam passar a provar o
  contrato novo, não o antigo.
- Navegador com a API real, em `app/tests/e2e/`. A referência são o lobby
  redesenhado e o finalizar. O cenário que monta a mesa sem enviar os campos
  de exemplo deixa de ser o comportamento certo: o formulário envia e a sala
  guarda. Cobrir escolha do comandante, desfazer prontidão, mão inicial com
  sete, comandante no comando e a votação de reinício (proposto, recusa,
  cancelamento, unanimidade, exclusão com finalizar).

O que cada fronteira tem de poder refutar:

- Criar sala persiste nome, formato, lugares e vida; listagem, detalhe e SSE
  mostram esses valores; vagas seguem os lugares daquela sala; vida da
  partida nova é a da sala, não 40 genérico quando o pedido pediu outra.
- Deck opcional na criação: criador sentado, não pronto; com `deckId`, deck
  selecionado e não pronto; `deckId` de outra pessoa ou inexistente é
  recusado.
- Listagem do deck devolve grupos, curva e identidade a partir do catálogo
  real (uma Island é terreno, um Instant é mágica, Gargos é criatura até ser
  marcado comandante). Marcar comandante persiste; nome fora da lista é
  recusado; limpar tira identidade e devolve a carta ao grupo de tipo.
- Desfazer prontidão permite trocar o deck; começar com alguém não pronto
  continua recusado; o seletor volta a responder.
- Início de um deck com comandante e pelo menos oito cartas: uma no comando,
  sete na mão, o resto no grimório. Sem comandante: sete na mão, zero no
  comando. Deck curto entrega o que restar.
- Reinício: recusa e cancelamento deixam a partida no estado em que estava;
  unanimidade arquiva snapshot e log, a sala volta a preparar, o `GET` da
  mesa atual não devolve o arquivo; o próximo início tem vida da sala, mesa
  limpa e ordem nova. Finalizar com reinício aberto é recusado, e o
  contrário também. Deck excluído entre o jogo e a volta deixa o
  participante sem deck.
- Encerrar continua fechando a sala e conservando a partida viva, sem ir
  para o arquivo.

A soma da curva ou o rótulo do grupo, quando for regra pura de exibição,
pode ter teste unitário junto dessa regra. Esse teste não substitui a
listagem HTTP com catálogo real nem o cartão visto no navegador.

## Out of Scope

- Desfazer a última ação própria. A issue 37 permanece aberta e fora desta
  entrega. A spec da mesa continua sem desfazer genérico.
- Exportar, duplicar, colar lista e corrigir nomes que o catálogo não
  reconhece. Issue 53.
- Data de “quando foi jogado”. Issue 54.
- Redes Docker de worktrees (issue 14). A política combinada nessa conversa
  fica na própria issue, para um tospec de infra.
- Tela, lista, replay ou endpoint de partidas arquivadas. O arquivo existe
  para não perder o jogo.
- N partidas vivas por sala. `matches` continua 1:1 com a sala.
- Inferir o comandante pelo XML, por lenda ou por zona extra do `.cod`.
- Mais de um comandante no deck. Partner e Background são manuais na mesa.
- União das cores do 99 como identidade do deck.
- Formato como regra: tamanho de deck, identidade, legalidade, dano de
  comandante por oponente.
- Mulligan como fluxo próprio.
- Editar nome, formato, lugares ou vida depois de criar.
- Motor de regras, fases, chat, sideboard, espectadores e cadastro público.

## Further Notes

A aprovação foi dada na conversa de 24/10/2026, pergunta a pergunta, sobre as
issues 33 a 38 e 14. Esta spec contradiz, com essa autorização, a compra
manual e a escolha de comandante pelo grimório da spec de acesso, e o
“exemplo que não se salva” da nova experiência para nome, formato, lugares,
vida, deck na criação, comandante, cores, curva e tipos.

O desfazer da issue 37, as operações extras da biblioteca, “quando foi
jogado” e a limpeza das redes Docker foram recortados de propósito, para
este lote só destrancar sentar e jogar.
