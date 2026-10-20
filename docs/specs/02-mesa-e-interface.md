# Mesa manual e experiência de jogo

## Problema

A interface atual dificulta ações simples para quem sabe jogar Magic, mas não conhece Cockatrice. Até seis campos precisam ser consultados em telas pequenas sem perder acesso à própria mão.

## Solução

Mesa virtual manual com ações genéricas, posicionamento em fileiras e seleção múltipla. Desktop permite observar todos os campos quando há espaço; celular vertical ou horizontal usa campo em foco e visão geral com miniaturas dos jogadores.

## Histórias de usuário

1. Como jogador, quero ver minha mão junto ao menu inferior, para agir sem procurar comandos.
2. Como jogador no celular, quero observar um campo por vez, para enxergar cartas em uma tela pequena.
3. Como jogador, quero tocar na miniatura de outro campo, para mudar o foco.
4. Como jogador, quero identificar o campo em foco, para evitar confundir meus cards com os do oponente.
5. Como jogador, quero manter minha mão e ações ao observar outro campo, para continuar jogando.
6. Como jogador no desktop, quero ver todos os campos quando houver espaço, para acompanhar a mesa.
7. Como jogador, quero ampliar um campo, para examinar suas cartas.
8. Como jogador, quero posicionar cartas livremente na horizontal, para organizar meu campo.
9. Como jogador, quero alinhamento automático em fileiras, para evitar desalinhamento vertical involuntário.
10. Como jogador, quero sobrepor cartas, para organizar terrenos ou representar anexos visualmente.
11. Como jogador no desktop, quero selecionar várias cartas por arraste de área, para movê-las ou agir em conjunto.
12. Como jogador no celular, quero ativar seleção e tocar em várias cartas, para realizar ações coletivas.
13. Como jogador, quero comprar X cartas, para executar compras sem repetir comandos.
14. Como jogador, quero consultar meu grimório inteiro com busca, para localizar cartas.
15. Como jogador, quero olhar X cartas do topo ou fundo em privado, para resolver efeitos manualmente.
16. Como jogador, quero reordenar e mover cartas consultadas, para resolver efeitos diversos.
17. Como jogador, quero enviar cartas ao topo/fundo do grimório, para controlar a posição de retorno.
18. Como jogador, quero embaralhar, para randomizar meu grimório quando necessário.
19. Como jogador, quero mover cartas entre zonas, para representar o jogo.
20. Como jogador, quero revelar cartas explicitamente, para compartilhar informações quando necessário.
21. Como jogador, quero virar/desvirar cartas e desvirar todas, para representar seu uso.
22. Como jogador, quero escolher faces e colocar cartas viradas para baixo, para representar diferentes estados.
23. Como jogador, quero ver imagem ampliada e texto, para consultar uma carta.
24. Como jogador, quero criar fichas do catálogo ou personalizadas, para representar efeitos.
25. Como jogador, quero criar cópias independentes, para representar cópias em jogo.
26. Como jogador, quero modificar contadores de cartas e jogadores, incluindo vida, para registrar valores manualmente.
27. Como jogador, quero transferir controle, para que outro participante manipule uma carta.
28. Como jogador, quero rolar dados e moedas, para executar escolhas aleatórias.
29. Como jogador, quero acompanhar um log público com informação privada protegida, para entender as ações.
30. Como jogador, quero avançar ou corrigir o turno, para acompanhar quem está jogando.
31. Como jogador, quero corrigir erros movimentando cartas e ajustando valores, para resolver enganos como numa mesa física.
32. Como jogador, quero propor reinício ou encerramento, para decidir isso com todos.
33. Como participante, quero aceitar ou recusar uma proposta, para preservar meu poder de decisão.

## Decisões de implementação

Escolhas ainda abertas seguem a [política de decisões do AGENTS.md](../../AGENTS.md#requisitos-e-decisões). Expressões como “a definir na implementação” não autorizam decisões de grande impacto sem aprovação explícita do usuário.

### Layout e interação

O refinamento posterior de vida/P/R diretos e acabamento premium está
[especificado separadamente](04-refinamento-ui-mesa.md), com aprovação
registrada na [decisão 29](../decisions/29-refinamento-ui-mesa.md) e
implementação pendente. Ele simplifica apenas as etapas de edição indicadas;
demais regras e fluxos abaixo permanecem.

- Interface PT-BR, excluindo o conteúdo das cartas/dataset.
- Celular plenamente jogável nas orientações vertical e horizontal, sem bloqueio para girar o aparelho. Alterar orientação mantém conexão, estado e acesso à mão.
- No celular, campo principal no centro, próprio por padrão; Visão geral abre uma grade de até seis campos reduzidos. Tocar numa miniatura amplia o campo; as miniaturas não manipulam cartas.
- Mão própria permanece na faixa inferior, com Comprar, Desvirar todas e Ações ao lado, em botões com ícones e alvos confortáveis de toque.
- Menus seguem dimensões, cabeçalho e linhas verticais de ícone/texto compartilhados. Desktop ancora o menu no elemento de origem, ajustando às bordas; telas estreitas usam painel inferior. Consultas de várias cartas usam espaço maior com o mesmo padrão visual.
- Grimório concentra comprar, embaralhar, olhar, buscar e revelar. Ações contém turno, dado, moeda, correção de turno e fichas. Card/cabeçalho do jogador abre vida e marcadores, com edição apenas do próprio jogador e consulta pública dos demais; Ver campo é um acesso separado.
- Detalhe de carta organiza imagem, identificação, estados, ações rápidas, ajustes e outras ações. P/R é rotulado como modificador manual e continua universal. Destinos explícitos oferecem movimento sem depender de arrastar.
- Visual restrito à mesa e seus fluxos: playmat escuro, texturas/detalhes arcanos discretos, dourado e cores funcionais. Turno/foco claros, prévia vazia compacta e registro que não interrompe quem lê entradas anteriores. Animações curtas respeitam movimento reduzido. Aprovação: [decisão 28](../decisions/28-ui-mesa-responsiva.md).
- Foco só muda observação. Mão, ações próprias e permissões permanecem iguais; identificar claramente o jogador observado.
- Desktop mostra todos os campos quando há espaço, com opção de ampliar um jogador.
- Fileiras fixas invisíveis ajustam a posição vertical da carta; posição horizontal livre. A quantidade/espaçamento final das fileiras será definida na implementação.
- Sobreposição é apenas visual: não cria grupo, vínculo ou propagação automática de ações.
- Seleção por área no desktop; modo explícito de seleção múltipla no celular, adicionando cartas por toque.
- Cartas selecionadas podem ser movidas juntas e receber ações coletivas aplicáveis.
- Toque seleciona/abre ações; arraste move. Ações essenciais não dependem de gestos secretos.
- Virar/desvirar fica disponível na seleção; gestos rápidos opcionais não são requisito.
- Não há agrupamento permanente, vínculo de aura/equipamento ou inclinação acidental causada pelo posicionamento. Sobreposição e rotação para indicar carta virada são permitidas.

### Zonas, consultas e ações

- Zonas: grimório, mão, campo, cemitério, exílio e comando. Não há reserva/sideboard.
- Área temporária privada para consultar/reordenar cartas; não é uma zona permanente adicional.
- Mão e ordem/conteúdo do grimório privados. Campo, cemitério, exílio e comando públicos, respeitando cartas viradas para baixo.
- Consultar todo o próprio grimório com busca por nome, consultar X do topo/fundo, reordenar, mover e revelar explicitamente.
- Embaralhamento é separado da consulta, com opção de fechar e embaralhar.
- Movimentos para grimório escolhem topo/fundo, com topo como opção rápida.
- Comprar X, mover entre zonas, embaralhar, revelar, virar/desvirar individualmente e desvirar todas.
- Escolher face de carta de múltiplas faces é independente de deixá-la virada para baixo.
- Consultar imagem ampliada e texto da carta.
- Criar fichas do catálogo ou personalizadas. Fichas personalizadas têm nome, descrição, poder/resistência opcionais e imagem padrão.
- Criar cópias independentes. Vida, cinco marcadores de cor e modificadores de poder/resistência são valores manuais, conforme a [decisão da issue 12](../decisions/12-vida-e-contadores.md).
- Vida é alterável durante a partida, independentemente do valor inicial configurado.
- Rolar dados, incluindo D20, e moedas, com resultados sincronizados e registrados.
- Não há desfazer genérico ou operação especial de desfazer compra. Jogador move a carta de volta; log mostra ambas as ações.
- App não valida legalidade, custo, texto de carta, formato, tamanho de deck ou condição de vitória.

### Controle e turno

- Guardar dono e controlador separadamente.
- Por padrão, jogador manipula suas cartas; transferência explícita leva a carta ao campo do novo controlador e transfere a permissão de manipulá-la.
- Ao sair do campo, oferecer zonas do dono original como destino padrão, com escolha explícita.
- Ordem inicial: D20 para cada participante, maior primeiro. Empatados rolam novamente apenas entre si, repetindo até resolver; demais posições são preservadas.
- Apenas indicador de turno, sem fases ou compras/desviradas automáticas.
- Qualquer participante pode avançar/corrigir o turno, com log. Ordem circular; turno não bloqueia ações.
- Comunicação por canal externo. No app há log de ações, sem chat de conversa.
- Indicadores nas miniaturas sinalizam atividade; não trocar foco automaticamente.

### Votações

- Qualquer participante propõe reinício; cada jogador recebe aceitar/recusar.
- Reinício exige unanimidade de todos os participantes, inclusive desconectados quando retornarem.
- No reinício, uma recusa encerra a proposta; proponente pode cancelar. Partida continua enquanto aguarda.
- Não há aprovação automática por tempo nem exceção para desconectados; partida pode aguardar indefinidamente.
- Reinício aprovado volta à preparação, mantendo participantes e decks selecionados, permitindo troca.
- Novo início limpa mesa e contadores, restaura vida inicial, carrega/embaralha decks e sorteia novamente a ordem.
- Qualquer participante pode solicitar encerramento pelo botão **Finalizar**, com destaque discreto em vermelho na barra superior. Confirmar registra concordância; pelo menos metade dos participantes, arredondando para cima, encerra a partida e fecha a sala. Uma pessoa sozinha pode confirmar e encerrar. A sala sai do lobby e todos voltam ao lobby, preservando snapshot e log. Votos persistem e a partida continua enquanto faltam concordâncias. Detalhes e autorização: [decisão de encerramento](../decisions/24-finalizar-partida.md); apresentação refinada na [decisão 28](../decisions/28-ui-mesa-responsiva.md).

## Decisões de teste

Proposta: testar operações/permissões pela interface pública do servidor; testar layout, foco e gestos em fluxos de navegador com mouse e toque. Na elaboração original desta spec, ainda não existiam testes no repositório.

Critérios observáveis:

- Foco em oponente preserva mão e ações próprias.
- Celular vertical/horizontal permite consultar seis jogadores pela visão geral e ampliar qualquer campo, mantendo mão e ações próprias.
- Movimento preserva posição horizontal e alinha à fileira; sobreposição não cria vínculo.
- Seleção múltipla move cartas juntas sem impedir manipulação individual posterior.
- Consulta privada e cartas viradas para baixo não expõem identidade a oponentes.
- Comprar X, consultar topo/fundo, reordenar e retornar cartas preservam quantidades e ordem esperada.
- Frente/verso, fichas, cópias e contadores sincronizam para os observadores autorizados.
- Controle transferido altera quem pode manipular; dono original permanece.
- Sorteio resolve empates somente entre empatados. Usar aleatoriedade controlável no teste sem impor mecanismo público de manipulação dos resultados.
- Turno não bloqueia jogadas; correções aparecem no log.
- Reinício não conclui sem o voto de desconectados; recusa/cancelamento encerra a proposta; unanimidade reinicia corretamente. Encerramento exige metade dos participantes, incluindo os desconectados no total, e preserva estado/log ao fechar a sala.

Testar comportamento observável, evitando snapshots de CSS ou testes que apenas repitam cálculos internos de layout.

## Fora do escopo

Motor de regras, formatos, fases, agrupamento permanente de cartas, desfazer genérico, chat/voz integrados e tela de histórico.

## Notas adicionais

A UI deve servir a quem conhece Magic, mas não o Cockatrice. Não inclui tutorial de regras. Os detalhes visuais finais serão refinados durante implementação sem remover a jogabilidade mobile inicial.
