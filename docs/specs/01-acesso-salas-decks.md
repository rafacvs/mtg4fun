# Acesso, salas, decks e catálogo

## Problema

Os jogadores conhecem Magic, mas encontram dificuldade para preparar partidas online no Cockatrice. Precisam acessar uma aplicação privada, reutilizar decks e começar partidas sem configurar catálogo e imagens em cada dispositivo.

## Solução

Oferecer autenticação simples, contas provisionadas pelo responsável pelo servidor, salas de até seis jogadores e biblioteca pessoal de arquivos .cod. O servidor mantém um catálogo único e cache de imagens compartilhado.

## Histórias de usuário

1. Como responsável pelo servidor, quero criar usuários por comando, para fornecer acesso apenas às pessoas convidadas.
2. Como usuário, quero entrar com login e senha, para acessar minhas salas e decks.
3. Como usuário, quero usar computador ou celular, para jogar com o dispositivo disponível.
4. Como jogador, quero enviar um arquivo .cod, para usar um deck já preparado.
5. Como jogador, quero manter meus decks vinculados à conta, para não reenviar arquivos em cada partida.
6. Como jogador, quero excluir meus decks, para organizar minha biblioteca.
7. Como jogador, quero escolher um deck salvo na preparação, para carregá-lo na partida.
8. Como jogador, quero usar o catálogo compartilhado, para não baixar datasets individualmente.
9. Como jogador, quero que imagens sejam carregadas e reutilizadas, para ver as cartas sem configuração local.
10. Como usuário autenticado, quero criar uma sala, para reunir amigos.
11. Como usuário autenticado, quero encontrar e entrar em uma sala com vaga antes do início, para participar sem aprovação adicional.
12. Como jogador, quero confirmar que estou pronto, para indicar que meu deck foi escolhido.
13. Como criador, quero iniciar após todos confirmarem, para evitar começar sem os participantes preparados.
14. Como jogador, quero vida inicial configurada na sala, para começar com o valor usado pelo grupo.
15. Como participante desconectado, quero retomar meu lugar após autenticar novamente, para continuar a mesma partida.
16. Como participante, quero que novos usuários não entrem no jogo iniciado, para preservar a composição da mesa.
17. Como usuário, quero interface PT-BR, para compreender as operações independentemente do idioma das cartas.

## Decisões de implementação

Escolhas ainda abertas seguem a [política de decisões do AGENTS.md](../../AGENTS.md#requisitos-e-decisões). Expressões como “a definir na implementação” não autorizam decisões de grande impacto sem aprovação explícita do usuário.

### Acesso

- Autenticação por login e senha; contas são criadas somente pelo responsável pelo servidor usando um comando do executável Go.
- O comando recebe nome/login e senha e armazena hash de senha apropriado, nunca senha em texto puro ou criptografia reversível.
- A sintaxe exata do comando e o algoritmo de hash permanecem escolhas de implementação.
- Não há cadastro público, painel administrativo ou recuperação por e-mail.
- Troca da própria senha e comando de redefinição não foram explicitamente confirmados; não são requisitos desta versão.
- Apenas uma conexão por usuário controla a aplicação por vez. A mais recente assume; a anterior informa a transferência e deixa de enviar ações válidas.
- Dados privados da biblioteca só podem ser modificados pelo titular.

### Salas e preparação

A configuração editável da preparação e sua autorização posterior estão na
[decisão de preparação](../decisions/49-decks-na-preparacao.md). O criador pode
alterar vida inicial (inteiro de 1 a 999), posicionamento inicial do comandante
e compra inicial de até sete cartas; mulligan automático permanece fora do escopo.

- Várias salas simultâneas, com limite de seis jogadores por sala.
- Qualquer usuário autenticado cria e entra em salas com vagas antes do início; não há aprovação individual ou senha adicional de sala.
- Cada participante escolhe um deck e confirma prontidão. O criador inicia quando todos estiverem prontos.
- A quantidade mínima de jogadores para iniciar não foi explicitamente definida; não impor requisito de formato de Magic.
- No início, carregar os decks, inicializar a vida pelo valor configurado na sala, embaralhar os grimórios e sortear a ordem de turnos.
- A compra inicial de até sete cartas é opcional conforme a configuração da sala; sem ela, a compra é manual.
- O comandante definido no deck começa em comando quando a opção da sala está ligada; desligada, começa no grimório embaralhado.
- Após o início, participantes ficam fixos. Desconexão não libera o lugar para outro usuário.
- Um participante original pode autenticar novamente e recuperar seu estado.

### Decks, catálogo e imagens

- Aceitar arquivos .cod com a mesma interpretação funcional de cartas e quantidades usada pelo Cockatrice; não usar uma lista textual como substituto obrigatório.
- Guardar os decks vinculados ao usuário no banco até exclusão. Oferecer upload, escolha e exclusão; nenhuma edição ou exportação é exigida.
- Não haverá zona de reserva/sideboard. O grupo não usa essa seção; tratamento de .cod que contenha seções não utilizadas deve ser definido na implementação sem criar uma reserva na mesa.
- Catálogo de cartas e fichas no servidor, compartilhado por todos. Não é baixado separadamente por usuário.
- Preservar o fluxo funcional de datasets e imagens do Cockatrice; o catálogo é separado do arquivo de deck.
- Usar formatos/fontes do Cockatrice como referência. Atualizações posteriores substituem/atualizam o catálogo compartilhado, não exigem configuração em cada navegador.
- Imagens baixadas sob demanda e mantidas em cache compartilhado. Não exigir baixar todas as imagens antecipadamente.
- Nomes, textos e imagens seguem o idioma do dataset, inclusive inglês; não há requisito de traduzir cartas.
- Upload não deve permitir que um usuário altere catálogo global ou arquivos de outro usuário.
- Cartas/imagens customizadas por usuário não foram confirmadas. Isso não impede fichas personalizadas durante a partida.
- A partida mantém sua própria representação das cartas; excluir o deck da biblioteca não deve destruir uma partida já iniciada.

## Decisões de teste

Proposta: testar autenticação, biblioteca e ciclo de sala pela interface pública do servidor, usando persistência real de teste quando durabilidade/importação fizerem parte do comportamento. Na elaboração original desta spec, ainda não existiam testes ou módulos no repositório.

Critérios observáveis:

- Conta criada pelo comando consegue autenticar; credenciais inválidas não dão acesso; senha original não é armazenada.
- Usuários não excluem decks de outros usuários.
- Deck .cod permanece disponível após desconexão/reinício e reproduz cartas/quantidades.
- Um deck salvo pode ser usado em partidas diferentes sem novo upload.
- Excluir um deck não altera cartas de partida iniciada.
- Sexto jogador entra; sétimo é recusado; partida iniciada rejeita não participantes.
- Início exige prontidão e autorização do criador.
- Participante original retoma seu lugar; nova conexão invalida o controle anterior.
- Catálogo compartilhado e cache evitam downloads por usuário para o mesmo recurso já armazenado.

Um fluxo de navegador cobre login, upload, criação/entrada e prontidão em desktop e celular. Testar resultados, não organização de classes ou tabelas.

## Fora do escopo

Editor/exportador de decks, sideboard na mesa, aprovação de entradas antes do início, espectadores, cadastro público, painel administrativo, e-mail de recuperação e tradução de cartas.

## Notas adicionais

O repositório original do Cockatrice foi consultado como referência local. Suas estruturas não determinam módulos, banco ou protocolo desta aplicação.

A apresentação do login, do lobby, da preparação e de Meus decks segue a [nova experiência da mesa](05-nova-experiencia-da-mesa.md). Os dados e opções disponibilizados posteriormente são registrados nas decisões pertinentes; o que não existe não deve ser apresentado como disponível. Excluir um deck pede confirmação. O comportamento persistido desta spec permanece.
