# Mesa v2: campo unificado, visão conjunta e responsividade

**Estado:** aprovada na conversa de refinamento, com confirmação final do
entendimento em Q16 e pedido explícito de publicação via to-spec. Implementação
pendente. Issue: https://github.com/rafacvs/mtg4fun/issues/57

Aprovações: [decisão da mesa v2](../decisions/mesa-v2-campo-unificado.md).

Esta spec substitui os requisitos conflitantes de apresentação e interação da
[nova experiência da mesa](05-nova-experiencia-da-mesa.md), implementada no
[PR 51](https://github.com/rafacvs/mtg4fun/pull/51). Preserva os contratos de jogo
não alterados e os requisitos independentes de
[preparação, início e reinício](https://github.com/rafacvs/mtg4fun/issues/52).

## Problem Statement

O jogador quer acompanhar a mesa inteira e agir com clareza, mas a composição
atual reserva muito espaço para controles e pouco para os adversários. Cartas
podem ficar fora do campo visível; com cinco ou seis participantes, alguns
campos exigem rolagem. Em uma partida existente, dez cartas ficaram fora da
área inicial porque as posições salvas produziram um canvas de quase 29 mil
pixels. Em um cenário compacto de quatro jogadores com 16 cartas por campo,
seis cartas de cada adversário ficaram inteiramente fora da área do campo.

O celular vertical oculta os campos, e aumentar o zoom do navegador pode
acionar uma composição móvel sem resolver a legibilidade. A inspeção também
interrompe a navegação quando o hover no registro abre um modal completo.
O resultado dificulta reconhecer o estado da partida, observar os amigos e
jogar com precisão.

Os documentos v2 melhoram a distribuição do espaço, mas ainda propõem fileiras
separadas de terrenos e permanentes. O usuário quer um campo unificado, com
organização manual, boa visibilidade dos participantes e uma experiência
premium, bonita, agradável e intuitiva.

## Solution

A mesa passa a enquadrar os campos automaticamente no espaço disponível, com
composição adequada ao número de participantes. Quatro jogadores ficam em
2×2; cinco e seis usam duas linhas. Foco amplia um campo mantendo os demais
visíveis e a mão própria disponível. O celular vertical passa a ser jogável.

Cada campo é único, com grade invisível para alinhamento manual, sem divisão
por tipo nem pilhas automáticas. Grandes intervalos vazios são compactados na
apresentação, preservando ordem, agrupamentos e posições salvas. O tamanho das
cartas acompanha o espaço útil; prévia e inspeção permitem ler detalhes quando
as miniaturas ficam pequenas.

Informações compactas por jogador, prévia flutuante, registro sob demanda e
mão sempre disponível devolvem espaço às cartas. Os gestos distinguem
selecionar, inspecionar e ampliar. A direção visual existente é refinada e
aplicada com consistência às demais telas, sem criar funcionalidades novas.

## User Stories

1. Como jogador, quero um campo único para todas as minhas cartas em jogo, para organizá-las conforme a partida sem áreas obrigatórias de terrenos ou permanentes.
2. Como jogador, quero alinhar cartas em uma grade invisível, para posicioná-las com precisão sem poluir o campo.
3. Como jogador, quero escolher manualmente meus agrupamentos, para preservar a organização que faz sentido para mim.
4. Como jogador, quero que terrenos iguais não sejam empilhados automaticamente, para continuar distinguindo as instâncias que organizei.
5. Como jogador, quero que grandes intervalos vazios sejam compactados apenas na apresentação, para posições antigas não tornarem meu campo aparentemente vazio.
6. Como jogador, quero preservar a ordem e a composição dos agrupamentos nessa compactação, para reconhecer minha organização.
7. Como jogador, quero preservar espaços próximos reconhecíveis entre cartas, para não perder separações intencionais durante o enquadramento.
8. Como jogador, quero que abrir ou observar a mesa não regrave posições, para minha organização persistida não mudar por causa da tela usada.
9. Como jogador, quero arrastar uma carta até a posição visual escolhida, para o destino continuar correto mesmo com compactação e escala.
10. Como jogador, quero representar todas as cartas na visão geral sem rolagem interna do campo, para acompanhar o conjunto sem procurar cartas fora da janela.
11. Como jogador, quero que o tamanho das cartas acompanhe o espaço disponível, para dispensar o seletor Compacta/Confortável.
12. Como jogador, quero que detalhes secundários diminuam progressivamente quando o campo ficar cheio, para manter a visão do conjunto.
13. Como jogador, quero ler os detalhes por foco, prévia ou inspeção, para não depender do texto impresso em uma miniatura pequena.
14. Como jogador, quero que a interface não crie pilhas nem esconda cartas para fazê-las caber, para não perder a representação do estado real.
15. Como jogador sozinho, quero aproveitar a área disponível com meu campo e minha mão, para não reservar lugares vazios de oponentes.
16. Como jogador numa partida de dois, quero os campos em duas faixas, com o meu abaixo, para acompanhar o adversário e minhas ações.
17. Como jogador numa partida de três, quero dois oponentes acima e meu campo na faixa inferior, para ver todos ao mesmo tempo.
18. Como jogador numa partida de quatro, quero os campos em 2×2, para os adversários receberem espaço útil de jogo.
19. Como jogador numa partida de cinco, quero três campos acima e dois abaixo, para ninguém depender de rolagem lateral para aparecer.
20. Como jogador numa partida de seis, quero os campos em 3×2, para todos permanecerem na visão geral.
21. Como jogador, quero meu campo embaixo à esquerda na visão geral de quatro a seis participantes, para ter uma referência espacial consistente.
22. Como jogador, quero ampliar deliberadamente um campo sem esconder os outros, para observar detalhes sem perder o contexto da partida.
23. Como jogador, quero voltar explicitamente à visão geral, para recuperar a distribuição conjunta quando terminar a observação.
24. Como jogador, quero continuar com minha mão disponível ao ampliar um campo, para preparar minhas ações enquanto observo.
25. Como jogador, quero que foco seja observação e não troca de identidade ou permissões, para nunca agir como outro participante.
26. Como jogador, quero todos os campos orientados para mim, para ler as cartas sem campos superiores espelhados.
27. Como jogador, quero continuar reconhecendo cartas viradas pela rotação de estado, para a orientação comum não apagar essa informação.
28. Como jogador, quero geometria estável durante arraste ou seleção por área, para os alvos não mudarem sob o cursor ou o dedo.
29. Como jogador, quero que o reenquadramento ocorra depois de concluir o gesto, para terminar a ação com precisão.
30. Como jogador, quero que começar um arraste da mão não amplie automaticamente meu campo, para a interface não deslocar os destinos.
31. Como jogador, quero continuar recebendo atualizações de vida e estados durante um gesto, para estabilidade visual não significar informação desatualizada.
32. Como jogador, quero identidade, turno, vida e acesso às zonas em informações compactas por participante, para ler a mesa sem uma lista lateral duplicada.
33. Como jogador, quero ver as contagens das zonas e acessar suas operações, para a compactação dos controles não remover recursos de jogo.
34. Como jogador, quero editar minha vida com os controles existentes, para o redesign preservar as ações já disponíveis.
35. Como jogador, quero mostrar marcadores de jogador quando não forem zero, para evitar ruído repetido no cabeçalho.
36. Como jogador, quero abrir a edição mesmo quando todos os marcadores forem zero, para poder começar a usá-los sem procurar um controle oculto.
37. Como jogador, quero uma prévia flutuante ao passar o mouse, para ler sem abrir uma superfície que interrompa a ação.
38. Como jogador, quero que o hover em nomes de cartas no registro também seja uma prévia passiva, para não abrir um modal involuntariamente.
39. Como jogador, quero abrir o registro quando precisar, para dedicar a área central aos campos durante o jogo.
40. Como jogador no desktop, quero que abrir o registro reduza o espaço da grade, para o painel não ficar por cima dos campos.
41. Como jogador, quero preservar os filtros, agrupamento e leitura do registro existentes, para a troca de superfície não remover informações.
42. Como jogador, quero minha mão sempre visível numa faixa compacta, para não precisar reabri-la para jogar.
43. Como jogador, quero sobreposição moderada e destaque da carta apontada ou selecionada na mão, para economizar espaço sem perder a interação.
44. Como jogador, quero rolar a mão quando necessário, para alcançar todas as cartas sem aumentar indefinidamente a faixa.
45. Como jogador, quero clicar ou tocar numa carta própria para selecioná-la e ver ações, para distinguir seleção de inspeção.
46. Como jogador, quero manter o duplo clique no campo para virar/desvirar, para preservar o gesto que já uso.
47. Como jogador no toque, quero segurar uma carta para inspecioná-la, para ler sem confundir um toque simples com abertura de detalhes.
48. Como jogador, quero clicar ou tocar numa carta adversária para inspecionar, para observar informações públicas sem oferecer ações indevidas.
49. Como jogador, quero um botão explícito de foco no cabeçalho do jogador, para ampliar o campo sem confundir esse gesto com selecionar uma carta.
50. Como jogador, quero preservar seleção múltipla e operações sobre cartas, para o novo enquadramento não reduzir minha capacidade de jogar.
51. Como jogador no celular horizontal, quero uma visão conjunta adaptada ao espaço, para não depender da coluna estreita de oponentes com rolagem.
52. Como jogador no celular vertical, quero ver os campos e jogar sem precisar girar o aparelho, para usar a orientação disponível.
53. Como jogador no celular vertical, quero oponentes em faixas e meu campo maior, para acompanhar o grupo e executar minhas ações.
54. Como jogador no celular vertical, quero expandir deliberadamente um campo mantendo os demais disponíveis na composição, para observar sem abandonar a visão da partida.
55. Como jogador no celular, quero registro, jogador e ações em painéis inferiores temporários, para operar com o dedo sem reservar permanentemente grande parte da tela.
56. Como jogador no celular, quero esses painéis inicialmente limitados a cerca de 60% da tela e com rolagem interna, para consultar conteúdo longo numa superfície controlada.
57. Como jogador, quero fechamento visível dos painéis, para voltar facilmente à composição anterior da mesa.
58. Como jogador, quero manter uma superfície maior para consultas extensas do grimório, para ler e selecionar várias cartas com espaço adequado.
59. Como jogador, quero que mudar tamanho, orientação ou zoom adapte a apresentação sem gravar novas posições, para usar a mesma partida em diferentes telas.
60. Como jogador, quero preservar seleção e consulta ao mudar somente a apresentação, para não reiniciar uma operação por causa da janela.
61. Como jogador, quero que a mesa seja validada em zoom real de 100%, 125%, 150% e 200%, para a responsividade refletir o navegador que utilizo.
62. Como jogador, quero que campos densos e posições antigas sejam verificados, para a interface funcionar além de mesas vazias ou com uma carta.
63. Como jogador, quero manter nomes, estados e valores atuais acessíveis na inspeção, para a redução visual de detalhes não remover informação do jogo.
64. Como jogador, quero preservar dono, controlador e privacidade, para a nova visualização não permitir ações ou revelar cartas indevidamente.
65. Como jogador, quero preservar compra, movimentos, consulta, revelação, marcadores, fichas, cópias, turno e encerramento, para continuar jogando com os contratos atuais.
66. Como jogador, quero reconhecer estados pendentes e recusas de ação, para o acabamento visual não ocultar falhas ou aplicar ações duas vezes.
67. Como jogador, quero fundo noturno, ouro para ação e cores de assento consistentes, para reconhecer prioridades e participantes sem ruído.
68. Como jogador, quero rótulos legíveis, foco de teclado e alvos confortáveis no toque, para operar a mesa de forma intuitiva.
69. Como jogador, quero preservar a preferência por movimento reduzido, para acompanhar ações sem animações desconfortáveis.
70. Como usuário, quero login, lobby, decks e preparação com espaçamento e legibilidade coerentes com a mesa, para perceber uma aplicação única.
71. Como usuário, quero preservar os fluxos atuais dessas telas durante os ajustes visuais, para não reaprender operações que já funcionam.
72. Como jogador, quero que o resultado seja demonstrado com ações reais e prints comparáveis, para avaliar jogabilidade e aparência sem depender apenas de descrições.

## Implementation Decisions

- A aprovação cobre Q1–Q15 e a confirmação final Q16. Campo unificado prevalece
  sobre as fileiras por tipo e pilhas automáticas dos documentos v2.
- A arquitetura existente permanece: cliente React/TypeScript, API Go e banco
  MySQL. Não há migration de posições, novo transporte, biblioteca estrutural,
  contrato de API ou mecanismo de autenticação aprovado por esta spec. Se uma
  mudança desse porte se mostrar necessária, exige decisão específica.
- Os módulos afetados são composição dos campos, projeção e encaixe,
  posicionamento/gestos, mão, identificação dos jogadores, prévia, inspeção,
  registro e painéis responsivos. As demais telas recebem acabamento visual
  mantendo os fluxos atuais.
- O campo continua uma única zona de jogo. A grade invisível ajuda o
  posicionamento manual; não classifica cartas nem determina fileiras por tipo.
  Agrupamentos não passam a criar vínculos permanentes por causa do redesign.
- Compactar grandes intervalos vazios é projeção visual. Preservar ordem,
  agrupamentos e espaços próximos reconhecíveis, sem gravar posições ao abrir,
  focar, redimensionar ou mudar zoom. Arrastes explícitos precisam traduzir o
  destino da projeção para o posicionamento real corretamente.
- Encaixe automático substitui tamanhos fixos escolhidos pelo seletor de
  densidade. Não há rolagem interna dos campos, cartas omitidas ou pilhas
  automáticas para caber. Detalhes secundários diminuem progressivamente;
  foco/prévia/inspeção preservam acesso à informação atual.
- A visão geral usa duas faixas para dois participantes, dois campos acima e
  próprio abaixo para três, 2×2 para quatro, três acima/dois abaixo para cinco
  e 3×2 para seis. Um participante aproveita o espaço disponível. O próprio
  fica embaixo à esquerda na visão geral de quatro a seis.
- Foco amplia um campo por vez, mantendo os demais visíveis e a mão própria
  disponível, com retorno explícito. Proporções exatas são calibração visual
  dentro desse contrato. Todos os campos ficam orientados para o observador;
  a rotação de carta virada continua significando seu estado.
- Congelar a geometria do gesto durante arraste e seleção por área; atualizar
  o enquadramento ao concluir. Não congelar informações de vida/estado nem
  ampliar automaticamente o campo ao iniciar arraste da mão.
- Informações compactas por jogador substituem a lateral fixa e sua lista
  duplicada. Preservar identidade/turno, vida, contagens e acesso às zonas.
  Marcadores de jogador só aparecem quando não nulos; edição continua
  acessível quando todos forem zero, sem semântica nova para suas cores.
- Prévia por hover é passiva, inclusive no registro. Inspeção é deliberada.
  Registro abre sob demanda e ocupa espaço da grade no desktop; seus filtros,
  agrupamento e conteúdos existentes permanecem.
- Mão permanece visível, inclusive em foco, com sobreposição moderada,
  destaque e rolagem quando necessário. Listas, mão, menus e registro podem
  rolar; a restrição de rolagem aplica-se aos campos.
- Carta própria: clique/toque seleciona; duplo clique no campo mantém
  virar/desvirar; mouse oferece prévia; toque longo inspeciona. Carta
  adversária: clique/toque inspeciona. Botão no cabeçalho amplia o campo.
  Seleção múltipla e permissões existentes permanecem.
- Vertical móvel passa a ser jogável, com oponentes em faixas, campo próprio
  maior e expansão deliberada. Horizontal móvel usa visão conjunta adaptada,
  em lugar da coluna estreita rolável de oponentes.
- No celular, registro/jogador/ações usam painéis inferiores, inicialmente em
  cerca de 60% da tela, com fechamento visível e rolagem interna. Cobrir parte
  dos campos enquanto um painel deliberado está aberto é uma exceção
  temporária à visão conjunta. Consulta extensa do grimório mantém superfície
  maior; fechar restaura a composição anterior.
- Preservar a direção de fundo noturno, ouro para ação, cor por assento e
  tipografia Cinzel/Geist. Calibrar contraste, espaçamento, rótulos, foco de
  teclado, alvos de toque e movimento reduzido. Imagens continuam completas,
  vindas do catálogo; dados reais não viram exemplos para copiar o mock.
- Login, lobby, decks e preparação recebem consistência e responsividade,
  sem redesenho de seus fluxos ou funcionalidades extras.
- Contratos de jogo não reabertos: consulta do grimório, valores impressos e
  modificadores, zonas, dono/controlador, privacidade, persistência,
  sincronização, ações otimistas/recusa e encerramento. Requisitos aprovados
  separadamente sobre preparação/início/reinício continuam em seu escopo.

## Testing Decisions

As fronteiras foram apresentadas no plano e aceitas na confirmação final.
A fronteira principal é o **navegador com API real e banco descartável**, usando
as capacidades já existentes. Ela deve observar o que o jogador e outro
cliente realmente conseguem ver e fazer. Asserções apenas sobre classes CSS,
retângulos parcialmente intersectados, chamadas de mocks ou detalhes internos
não comprovam enquadramento nem jogabilidade.

- Reutilizar os fluxos existentes de mesa desktop/mobile, gestos e seleção,
  grimório, cartas/contadores, transferência, registro, lobby, decks,
  preparação e finalização. Corrigir expectativas superadas pelo novo
  contrato, preparação insuficiente, seletores ambíguos e dados compartilhados
  entre cenários. Não alterar expectativas apenas para esconder defeitos.
- Um teste que falha antes de executar a ação não prova essa ação. Antes de
  declarar aceite, cada operação afetada deve chegar ao resultado observável,
  com dados preparados e espera pelas confirmações reais.
- Cobrir um a seis participantes e campos ocupados, não apenas vazios.
  Reproduzir a sala de dez cartas em posições esparsas e cenários de quatro e
  seis jogadores com 16 cartas por campo. Incluir campos vazios, viradas,
  pilhas manuais, fichas/cópias e estados combinados. Amostras de 30 e 60
  cartas são estresse, não um limite novo de cartas permitidas.
- Verificar cartas dentro das bordas do campo, distinguindo sobreposição
  manual intencional. Interseção parcial não significa visibilidade integral.
  Conferir acesso a detalhes atuais por prévia/inspeção quando miniaturas
  perderem detalhes.
- Validar desktop em 1366×768 e 1920×1080, mantendo 1440×900 para comparação
  visual. Exercitar zoom real do navegador em 100%, 125%, 150% e 200%, além
  de redimensionamento. Registrar espaço útil CSS, não só resolução física.
- Cobrir celular vertical/horizontal, incluindo 390×844 e 844×390 e os
  dispositivos já usados na suíte. Exercitar toque de fato, mouse e teclado,
  foco/retorno, mão disponível, painéis e mudança de orientação.
- Exercitar arraste individual/múltiplo, seleção por área, alinhamento,
  agrupamentos, virar/desvirar e destinos com projeção compactada e escala.
  Verificar que alvos não se movem durante o gesto e que a ação persiste no
  destino escolhido.
- Comparar posições pela API pública antes/depois de abrir, focar, mudar
  zoom/tamanho ou abrir registro: mudanças somente visuais não as regravam.
  Recarregar e usar outro cliente para conferir persistência e sincronização.
- Verificar prévia passiva no campo e no registro, sem captura de foco por
  modal; inspeção deliberada e painéis com fechamento acessível.
- Regressão das operações afetadas: acesso, decks, preparação, compra,
  movimentos entre zonas, consulta/revelação/reordenação, vida/marcadores e
  modificadores, estados/faces, fichas/cópias, controle, turno/dado/moeda e
  finalização. Usar dois clientes para privacidade e permissões. Preservar
  cenários de confirmação incerta e recusa de ação onde a UI participa.
- Reutilizar integração na API pública com MySQL real para invariantes de
  persistência, autorização e privacidade que não sejam suficientemente
  demonstrados pelo fluxo do navegador. Não criar uma nova API de testes.
- Testes unitários podem cobrir projeção determinística e tradução de
  coordenadas. Complementam, sem substituir, arraste/seleção observados no
  navegador e persistência pela fronteira pública.
- Prints comparáveis e revisão visual complementam as verificações
  funcionais. A massa sintética com imagens ausentes não prova defeito no
  provedor real; não trocar a API por snapshots fabricados para provar o fluxo.

## Out of Scope

- Fileiras obrigatórias por tipo, classificação automática do campo ou
  empilhamento automático de terrenos/cartas.
- Posicionamento totalmente livre por pixel e vínculos permanentes novos
  entre cartas agrupadas.
- Regravar ou migrar posições existentes para resolver enquadramento visual.
- Voltar ao seletor Compacta/Confortável ou exigir ajuste manual de escala
  como solução principal para visibilidade.
- Prometer texto impresso legível em todas as miniaturas, independentemente
  da quantidade de cartas; leitura ampliada é parte da solução aprovada.
- Alterar regras de jogo, formatos, permissão, privacidade, autenticação,
  banco, infraestrutura ou transporte da partida.
- Novas funcionalidades de login, lobby, biblioteca ou preparação. Requisitos
  independentes da issue 52 permanecem separados; operações adicionais de
  biblioteca, histórico de uso do deck, desfazer e infraestrutura continuam
  nas respectivas issues.
- Motor de regras, fases, chat, mulligan próprio, dano de comandante com nova
  semântica, replay/histórico de partidas e novas artes de playmat.

## Further Notes

A conversa aprovou Q1–Q4 com “sim pra todas”, Q5–Q10 com “ok pra tudo” e
Q11–Q15 individualmente com OK. O usuário confirmou Q16 e pediu publicar o
entendimento como spec no GitHub. Essa autorização substitui expressamente os
pontos conflitantes da experiência anterior: faixa rolável de oponentes,
vertical restrito à mão, guias por tipo, densidade fixa, lateral permanente e
hover que abre modal. As duas fileiras e pilhas automáticas propostas na v2
foram rejeitadas em favor do campo unificado manual.

A referência visual contém uma equivalência incorreta: 1920×1080 a 133% não
resulta em 1440×900 CSS. Usar medidas reais. O enquadramento e os campos densos
são critérios de jogabilidade, não somente acabamento.

Auditoria histórica anterior ao redesign: 43 prints, build/TypeScript
aprovados e 207 cenários E2E descobertos, dos quais 96 passaram, 69 falharam e
42 foram pulados. Uma reexecução isolada de seleção passou. Há expectativas
antigas, problemas de preparação e falhas não resolvidas; esses números não
validam o redesign nem todas as ações atuais. A navegação ocorreu na aplicação
Docker; ações de cenários controlados usaram bancos descartáveis. Não foi
necessário instalar Go globalmente para operar a aplicação.

Sequência de execução acordada: base de verificação, campo/projeção, grade e
foco, mão/informações/painéis, celular/gestos, consistência das demais telas e
aceite integrado. A publicação desta spec documenta requisitos aprovados;
não anuncia a interface como implementada.

Referências: [plano confirmado](../redesign/plano-ajustes-v2.md),
[aprovações](../decisions/mesa-v2-campo-unificado.md),
[mock v2](../redesign/mock-iterativo%20%28v2%29.html) e
[proposta v2](../redesign/proposta-nova-experiencia%20%28v2%29.pdf).
