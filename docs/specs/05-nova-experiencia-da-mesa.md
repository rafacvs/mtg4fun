# Nova experiência da mesa

**Estado histórico:** aprovada em 24/10/2026, seguida pela mesa V2 da
[issue 57](https://github.com/rafacvs/mtg4fun/issues/57), entregue no PR 69.
A apresentação-alvo atual é a [paridade visual V2](07-paridade-visual-v2.md),
ainda pendente de implementação corretiva. As seções abaixo preservam o
planejamento original da issue https://github.com/rafacvs/mtg4fun/issues/39.

Cards, na ordem em que podem começar:

1. [Tema e login](https://github.com/rafacvs/mtg4fun/issues/40), sem bloqueio.
2. [Consulta como vista do grimório](https://github.com/rafacvs/mtg4fun/issues/41), sem bloqueio.
3. [Poder e resistência impressos](https://github.com/rafacvs/mtg4fun/issues/42), sem bloqueio.
4. [Mesa de quatro no computador](https://github.com/rafacvs/mtg4fun/issues/43), depois de 40 e 42.
5. [Barra, gestos e arraste](https://github.com/rafacvs/mtg4fun/issues/45), depois de 43.
6. [Folha do grimório](https://github.com/rafacvs/mtg4fun/issues/46), depois de 41 e 43.
7. [Registro legível](https://github.com/rafacvs/mtg4fun/issues/47), depois de 43.
8. [Mesa no celular](https://github.com/rafacvs/mtg4fun/issues/48), depois de 45.
9. [Lobby, sala e decks](https://github.com/rafacvs/mtg4fun/issues/44), depois de 40.

Esta spec substitui a apresentação e os gestos da [mesa](02-mesa-e-interface.md) e a direção visual do [refinamento premium](04-refinamento-ui-mesa.md). Regras de zona, permissão, privacidade, turno, encerramento e ausência de motor de regras continuam na mesa, salvo a consulta do grimório, redefinida aqui. Aprovação: [decisão 35](../decisions/35-nova-experiencia-da-mesa.md).

O protótipo de referência é a proposta e o mock em `docs/redesign/`. As cartas do mock são marcadores de lugar. Na aplicação, a imagem continua vindo do catálogo.

## Problem Statement

A partida já funciona, mas a mesa parece um painel. O estado da carta exige abrir alguma coisa, as ações frequentes ficam longe do gesto, e o celular é o computador encolhido. O grupo quer sentar numa mesa de Commander entre amigos, ler a partida de relance e jogar sem pensar na interface. O jogo continua manual, sem motor de regras.

## Solution

A carta passa a ser a interface. O estado aparece nela. Virar, comprar, mover, mudar a vida e passar a vez ficam a um gesto. O computador mostra a mesa de quatro jogadores de uma vez. No celular, o horizontal é o modo de jogo e o vertical é mão e leitura. O ouro marca a próxima ação. A cor do assento identifica a pessoa. A consulta do grimório passa a ser uma vista do monte, sem esvaziá-lo. O poder e a resistência impressos vêm do catálogo e ficam separados do modificador manual.

## User Stories

1. Como jogador, quero ler quem está na vez, a vida de todos e o que há no campo sem abrir um painel, para acompanhar a mesa em um relance.
2. Como jogador no computador, quero os oponentes numa faixa no topo, o meu campo no centro e a minha mão embaixo, para jogar sem alternar entre visão geral e campo ampliado.
3. Como jogador numa partida de um, dois ou três participantes, quero a mesma composição com menos assentos, para não haver um layout diferente.
4. Como jogador numa partida de cinco ou seis, quero rolar a faixa de oponentes na horizontal, para ninguém sumir e sem uma segunda linha desenhada agora.
5. Como jogador, quero o assento da vez com a cor daquela pessoa e a ordem do turno visível, para saber de quem é a vez.
6. Como jogador, quero a vida grande no assento e editável só por quem é o dono daqueles pontos, para corrigir a vida sem caçar um menu.
7. Como jogador, quero ver os cinco marcadores de cor do jogador no assento, para continuar o dano e os contadores manuais que a mesa já tem.
8. Como jogador, quero o campo com duas faixas pintadas, permanentes e terrenos, sem a posição deixar de ser livre, para me orientar como numa mesa física.
9. Como jogador, quero comando, grimório, cemitério e exílio como montes do tamanho de uma carta, com a contagem, para achar a zona sem um rótulo solto.
10. Como jogador, quero o grimório com o verso desenhado, para a face das cartas do monte continuar privada.
11. Como jogador, quero a carta do topo visível no cemitério, no exílio e no comando, para ler a zona pública.
12. Como jogador, quero a carta no campo, na mão e na inspeção com a imagem inteira que o catálogo já fornece, para reconhecer a carta como hoje.
13. Como jogador, quero quatro tamanhos fixos de carta, conforme o contexto, para deixar de usar zoom em porcentagem.
14. Como jogador, quero escolher entre densidade compacta e confortável, para ajustar a mesa sem um controle de porcentagem.
15. Como jogador, quero carta virada, face para baixo, revelada, selecionada, com marcador, controlada por outra pessoa, ficha, cópia, pendente e sem imagem com um sinal próprio que se combina, para ler o estado na própria carta.
16. Como jogador, quero o modificador de poder e resistência num selo, dourado quando eu o alterei, para não abrir a carta só para saber o número.
17. Como jogador, quero o selo com a soma quando o valor impresso é um inteiro, para ver o resultado do impresso mais o modificador manual.
18. Como jogador, quero `*`, `1+*` e textos parecidos no selo, com o modificador ao lado quando houver, sem uma soma inventada, para não falsificar a carta.
19. Como jogador, quero terreno, mágica e qualquer carta sem poder e resistência sem esse selo, para o campo não inventar um número.
20. Como jogador, quero uma ficha 1/1 sem parecer que alguém somou +1/+1, para distinguir o valor impresso do modificador.
21. Como jogador, quero o anel de quem controla a carta na cor do assento dessa pessoa, para ver controle emprestado sem abrir painel.
22. Como jogador no computador, quero passar o mouse para inspecionar e clicar para selecionar, para a inspeção não atrasar a seleção.
23. Como jogador, quero que o duplo clique continue virando a carta, sem o primeiro clique esperar por ele, para não perder o atalho de quem já o usa.
24. Como jogador, quero virar pela tecla T ou pelo botão da barra, para não depender do duplo clique.
25. Como jogador com uma carta selecionada, quero uma barra com Virar, Mão, Cemitério, Exílio, Topo, +1 marcador e Mais, para as ações frequentes ficarem a um clique.
26. Como jogador com uma carta na mão, quero a barra trocar para jogar no campo, revelar e os destinos, para a mão não oferecer os comandos do campo.
27. Como jogador, quero o menu completo num único nível no clique direito e no Mais, para não atravessar subtelas.
28. Como jogador, quero arrastar e ver os destinos com nome, o destino sob o ponteiro na cor de ação, para não soltar a carta num alvo sem rótulo.
29. Como jogador no computador, quero selecionar várias cartas por arraste no vazio ou com Shift, para movê-las juntas.
30. Como jogador no toque, quero um modo Selecionar e tocar as cartas, para a seleção múltipla não depender de arraste de área.
31. Como jogador, quero comprar com D, desvirar tudo com U e passar a vez com N, para manter os atalhos que já existem.
32. Como jogador, quero H para a mão, G para o cemitério, E para o exílio, + para marcador, R para dado e moeda e F para ficha, para as ações frequentes terem tecla.
33. Como jogador, quero ocultar as reveladas no menu, e não mais na tecla H, para H significar mão.
34. Como jogador no toque, quero segurar a carta para inspecionar e tocar para selecionar, para o mesmo mapa de gestos do computador.
35. Como jogador, quero a carta se mover na hora e voltar se o servidor recusar, com um sinal de pendente, para a mesa não esperar parada.
36. Como jogador, quero o registro agrupado por turno, o mais recente primeiro, com filtros de jogo, ajustes e tudo, para um reposicionamento não esconder uma compra.
37. Como jogador, quero ações seguidas da mesma pessoa juntadas numa linha, para ler “virou estas cartas” em vez de uma linha por carta.
38. Como jogador, quero consultar o grimório sem o monte ir a zero, para a busca ser uma vista e não uma retirada.
39. Como oponente, quero ver a mesma contagem do grimório e o aviso de que a pessoa está consultando, sem os nomes, para saber que a consulta acontece e sem ver a mão do monte.
40. Como jogador, quero a folha de busca com grade, filtro e a posição de cada carta, para achar uma carta e saber onde ela está no monte.
41. Como jogador, quero uma bandeja de destino ao selecionar na folha, com mão, campo, cemitério, exílio, topo, fundo e revelar, para mover sem outro menu.
42. Como jogador, quero minimizar a consulta sem perder o que já selecionei, para olhar a mesa e voltar.
43. Como jogador, quero embaralhar e fechar, ou fechar sem embaralhar, para as duas saídas serem explícitas.
44. Como jogador, quero olhar o topo ou o fundo como uma faixa ordenável na mesma folha, para vidência e efeitos parecidos.
45. Como jogador, quero reordenar essa faixa e mudar a ordem daquele trecho do grimório, para o fechamento não desfazer a ordem que escolhi.
46. Como jogador, quero devolver o trecho olhado ao topo ou ao fundo, para manter a escolha que a consulta já oferece.
47. Como jogador, quero que mover uma carta da folha para outra zona a tire do grimório de verdade, para a contagem só cair quando a carta sai.
48. Como jogador, quero comprar e embaralhar pelo monte desabilitados enquanto a folha está aberta, para não puxar a carta que estou olhando por outro caminho.
49. Como jogador, quero revelar uma carta e ela continuar na contagem do monte até sair de lá, para revelar não esvaziar o grimório.
50. Como jogador no celular horizontal, quero oponentes à esquerda, o campo no centro e, à direita, a minha vida, as zonas, Comprar e Passar a vez, com a mão em leque na borda, para jogar deitado.
51. Como jogador no celular vertical, quero a mão, a leitura e uma barra com rótulo no lugar dos botões sem texto, para usar o polegar.
52. Como jogador no celular vertical, quero um convite para girar o aparelho, para saber que o modo de jogo é o horizontal.
53. Como jogador no celular vertical, quero tocar uma carta e ver a carta grande com ações em botões grandes, para ler e agir sem o campo inteiro.
54. Como jogador, quero todo controle com rótulo e alvo confortável no toque, para não depender de um ícone sem nome.
55. Como jogador, quero movimento curto ao virar, ao mover e ao passar a vez, e um fade quando peço para reduzir movimento, para ver a jogada dos outros sem enjoo.
56. Como jogador, quero o campo com véu na cor do assento até as artes de playmat chegarem, para a mesa já ter identidade por pessoa.
57. Como jogador, quero depois um playmat por cor de assento, seis no total, para a arte seguir o assento e não a cor de mana.
58. Como usuário, quero o login com a moldura, a noite e o ouro novos, e as esferas de mana como estão, para a entrada parecer a mesma aplicação.
59. Como usuário, quero o lobby na ordem das minhas mesas, das abertas e das que já começaram, para achar o que preciso fazer.
60. Como usuário, quero uma mesa em jogo sem promessa de vaga, para não achar que ainda dá para sentar.
61. Como usuário, quero o painel de criar mesa com o visual da proposta, para ver nome, formato, lugares, vida e deck no mesmo passo.
62. Como usuário, quero que formato, lugares, vida da sala e deck na criação apareçam como exemplo e não sejam salvos, para o visual não mentir que a sala guardou isso.
63. Como jogador na preparação, quero ver quem está pronto e o botão de começar desabilitado dizendo quem falta, para não receber um erro no lugar do aviso.
64. Como jogador, quero excluir um deck só depois de confirmar, com a explicação de que a partida já iniciada não muda, para a ação perigosa não ficar no botão principal.
65. Como jogador, quero Meus decks no visual da proposta, com nome, quantidade, carta fora do catálogo e prévia verdadeiros, para organizar a biblioteca com o que o servidor já sabe.
66. Como jogador, quero comandante, cores, curva e tipos marcados como exemplo, para não escolher um deck por um dado falso.
67. Como jogador, quero continuar editando vida e modificador de poder e resistência com os controles diretos já existentes, dentro da superfície nova, para o redesenho não tirar a edição que já funciona.
68. Como jogador, quero finalizar a partida como hoje, para o encerramento não mudar junto com o visual.

## Implementation Decisions

- A mudança é de apresentação e de dois contratos do servidor. O resto da partida permanece.
- A consulta deixa de mover as cartas para fora do grimório. A folha é uma janela: o monte inteiro, as N do topo ou as N do fundo. As cartas continuam no grimório. A contagem, para todos, inclui as cartas da janela. Os outros recebem que a pessoa está consultando, sem nomes nem ordem. Mover da folha para mão, campo, cemitério, exílio ou comando remove a carta do grimório. Reordenar a faixa reordena esse trecho. Embaralhar e fechar embaralha o monte. Fechar sem embaralhar mantém a ordem, inclusive a opção de devolver o trecho ao topo ou ao fundo. Comprar e embaralhar pelo monte ficam desabilitados com a folha aberta. Revelar continua público, e a carta revelada segue na contagem até sair do monte.
- O poder e a resistência impressos passam a viajar com a carta da partida, lidos do catálogo. O modificador manual e os cinco marcadores de cor não mudam de significado nem de armazenamento. A ficha grava o impresso fora do modificador, e o modificador começa em zero. Selo: se os dois números impressos são inteiros, mostra a soma e fica dourado quando o modificador manual é diferente de zero. Caso contrário, mostra o texto impresso e, se houver modificador, o modificador ao lado. Sem poder e resistência, não há selo.
- A imagem da carta continua a carta inteira do catálogo, no campo, na mão, na inspeção e na folha. Não há recorte de arte. Face para baixo usa o verso desenhado pela interface, não uma imagem do dataset.
- O campo mantém colunas, fileiras, pilha e posição livre. As duas faixas são pintura-guia. Não separam terrenos sozinhas, porque a carta da partida não traz tipo.
- Tamanho por contexto, mais duas densidades. O zoom em porcentagem sai.
- Ouro é a próxima ação e o destaque. A cor do assento identifica a pessoa. Cor de mana só pinta custo e moldura de carta. Cinzel para o que é jogo. Geist para controle, contagem pequena e texto de apoio.
- Até as artes chegarem, o playmat é véu na cor do assento. Quando chegarem, um playmat por cor de assento, seis. A atribuição não usa identidade de cor do deck.
- Ação otimista é só no cliente: a carta muda na hora e volta se o servidor recusar, com estado pendente. Isso não é desfazer persistido.
- O registro filtrado e agrupado é apresentação do log que já existe. Reposicionar, organizar e abrir consulta são ajustes e ficam fora da vista padrão.
- Atalhos novos convivem com D, U e N. H passa a ser mão.
- O clique seleciona na hora. O duplo clique ainda vira, sem segurar o clique.
- Vida direta, modificador de poder e resistência, confirmação por Enter ou saída do campo, falha parcial e permissão de quem edita continuam valendo dentro da barra, do assento e da inspeção.
- Lobby, criação de sala, preparação, Meus decks e login ganham o visual. O que o servidor não guarda aparece com a marca exemplo e não é enviado. Nome, quantidade e carta fora do catálogo continuam reais. Criar sala continua criando a sala como hoje, com o criador sentado. Começar partida continua exigindo todos prontos. O botão só deixa de disparar o erro quando alguém falta.
- Excluir deck pede confirmação. A exclusão não altera partida já iniciada, como já é o caso.
- A construção usa os cards 40 a 48 numa branch de integração, no fluxo `/implement-spec`. Esta spec não abre um PR por card.
- Fontes Cinzel e Geist entram como dependência de apresentação, porque fazem parte do desenho aprovado.

## Testing Decisions

Um bom teste observa o que o jogador ou o outro cliente observa. Não basta uma classe CSS, um mock que sempre sucede no lugar do servidor, nem um cálculo interno repetido pelo teste.

Duas fronteiras, as que já existem:

- Navegador, com a API real: mesa de quatro, faixa, mão, gestos, densidade, destinos do arraste, folha do grimório, registro, celular horizontal e vertical, lobby, preparação, decks e o exemplo que não pode ser salvo. A referência são os fluxos atuais da mesa, do celular, do grimório, da interface e dos contadores.
- HTTP da API pública: a consulta mantém a contagem do grimório para quem consulta e para o oponente, o oponente não recebe os nomes, mover para outra zona reduz a contagem, reordenar e embaralhar persistem, e a carta da partida traz o impresso separado do modificador, inclusive na ficha. A referência são os testes de integração do grimório, das salas, das fichas e dos contadores.

Vida, permissão e falha parcial do modificador continuam cobertos pelos fluxos que já provam esses editores. A soma do selo, quando for uma regra pura de exibição, pode ter teste unitário junto dessa regra. Esse teste não substitui a carta chegando com o impresso na API nem o selo visto no navegador.

## Out of Scope

- Desfazer a última ação própria. Fica na issue 37. A spec da mesa continua sem desfazer genérico até lá.
- Comprar 7 e colocar o comandante na zona de comando ao iniciar. Issue 33. A sala não anuncia essas regras.
- Comandante, cores, curva, tipos, exportar, duplicar, colar lista e corrigir nomes como dado real. Issue 34. No visual, isso é exemplo.
- Desfazer a prontidão. Issue 35.
- Reinício por unanimidade. Issue 36. A spec da mesa mantém o requisito. Esta entrega não o implementa e não o apaga.
- Criar mesa persistindo nome, formato, lugares, vida e deck. Issue 38. Formato, se um dia for salvo, é rótulo. A mesa continua sem motor de regras.
- Mulligan como fluxo próprio.
- Dano de comandante por oponente. Continuam os cinco marcadores de cor.
- Recorte de arte no campo.
- Uma sessão por conta derrubando a anterior.
- Segunda linha de assentos para cinco ou seis jogadores.
- Motor de regras, fases, chat e histórico.

## Further Notes

A aprovação foi dada na conversa de 24/10/2026, pergunta a pergunta, sobre a proposta e o mock. Esta spec contradiz, com essa autorização, a experiência mobile em que o vertical é plenamente jogável, a paleta de ouro em tudo, a consulta que retira cartas do grimório e a decisão de não inferir poder e resistência impressos. A edição manual do modificador permanece.

As artes de playmat chegam na hora de desenvolver. Até lá o véu de assento cumpre o campo.
