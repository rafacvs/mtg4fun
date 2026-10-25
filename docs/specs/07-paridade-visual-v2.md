# Paridade visual da mesa com o protótipo V2

**Estado:** requisitos aprovados no refinamento de 25/10/2026; implementação
corretiva e aceite visual pendentes. Issue: https://github.com/rafacvs/mtg4fun/issues/70.

## Problem Statement

Após a entrega da issue [57](https://github.com/rafacvs/mtg4fun/issues/57) e
suas subissues pelo PR [69](https://github.com/rafacvs/mtg4fun/pull/69), a mesa
continua visualmente muito diferente da proposta V2. Há diferenças de
composição, proporções, fundos, controles, mão, foco, leitura e celular.
O jogador quer as telas do protótipo na aplicação real, com as capacidades
existentes, e não apenas uma interface inspirada na mesma direção visual.

A spec anterior não exigia reprodução 1:1 e aceitava proporções como
calibração. A auditoria da aplicação local na sala 4 encontrou lateral fixa,
blocos grandes de zonas, foco com espaço desperdiçado, leitura central que
cobre campos, mão sobreposta no horizontal e duas colunas no vertical.
Essas observações são diagnóstico histórico, não validação da correção.

## Solution

**O HTML V2 é a referência visual obrigatória e principal. Paridade visual é
critério de entrega, não uma sugestão de estilo.** Reproduzir composição,
medidas de referência, espaçamento, cores, fontes, fundos, molduras,
hierarquia e posição dos controles, respeitando somente as exceções e
adaptações explicitadas nesta spec. O PDF complementa a referência.

### Referências obrigatórias e precedência

1. Exceções e adaptações aprovadas nesta spec.
2. [Protótipo HTML V2](../redesign/mock-iterativo-v2.html): fonte visual principal.
3. [Proposta PDF V2](../redesign/proposta-nova-experiencia-v2.pdf): complemento
   explicativo; em conflito visual, prevalece o HTML com as exceções acima.
4. Contratos funcionais existentes, incluindo os preservados pela issue 57,
   permanecem onde não forem expressamente substituídos aqui.

Os arquivos V1 não são alvo desta entrega. O HTML deve ser aberto em navegador
com JavaScript para renderizar suas pranchas; ler apenas seu código, o PDF ou
uma miniatura não substitui observar as nove telas. Os dois V2 são incorporados
à documentação desta entrega para eliminar dependência de arquivos locais
não versionados. Links imutáveis dos originais idênticos, já versionados:
[HTML V2](https://github.com/rafacvs/mtg4fun/blob/201def94d0ec94a704360ddc91e5380a6f90eabb/docs/redesign/mock-iterativo%20%28v2%29.html)
e [PDF V2](https://github.com/rafacvs/mtg4fun/blob/201def94d0ec94a704360ddc91e5380a6f90eabb/docs/redesign/proposta-nova-experiencia%20%28v2%29.pdf).

### Inventário de telas-alvo

| ID | Título exato da prancha HTML | Viewport CSS de referência | Estado exigido |
| --- | --- | --- | --- |
| V1 | Mesa em quadrantes · 4 jogadores | 1440×900 | Visão geral, mão disponível, lateral fixa ausente. |
| V2 | Foco · ampliar um oponente | 1440×900 | Oponente na faixa superior; campo próprio e demais oponentes abaixo. |
| V3 | Leitura · prévia ao passar o mouse | 1440×900 | Prévia passiva do lado oposto ao campo lido. |
| V4 | Crônica aberta · grade se ajusta | 1440×900 | Crônica à direita, grade reduzida sem campos cobertos. |
| V5 | Celular horizontal · quatro campos | 844×390 | Grade 2×2, trilhos e doca separados dos campos. |
| V6 | Celular horizontal · foco em um oponente | 844×390 | Foco acima, próprio abaixo à esquerda e outros à direita. |
| V7 | Celular vertical · faixas e carta selecionada | 390×844 | Oponentes em faixas inteiras, próprio maior, barra da seleção acima da mão. |
| V8 | Celular vertical · faixa expandida | 390×844 | Faixa ampliada, demais oponentes ainda visíveis. |
| V9 | Celular vertical · ler carta de oponente | 390×844 | Painel inferior com carta, dados atuais, dono e acesso ao campo. |

Os IDs V1–V9 desta tabela identificam estados, não versões dos documentos.
A prancha “Antes · implementação atual anotada” é diagnóstico, nunca alvo.
“Layouts por número de jogadores e regras” orienta as adaptações e não é uma
página adicional da aplicação. Login, lobby, decks e preparação não têm tela
correspondente neste V2 e não recebem promessa de paridade 1:1 nesta entrega.

### Exceções aprovadas à reprodução literal

- Campo único com posicionamento e agrupamentos manuais. Não introduzir
  fileiras obrigatórias por tipo nem empilhamento automático de terrenos.
  A distribuição das cartas, portanto, não precisa imitar as duas fileiras
  do mock. Isso não dispensa reproduzir a moldura e composição dos campos.
- A carta no campo mantém a **imagem inteira do catálogo**, sem recorte só da
  arte. Mão e leitura ampliada também mantêm a imagem inteira. Reproduzir
  acabamento, selos e proporções compatíveis com essa escolha, sem inventar
  textos ou estados para copiar as cartas demonstrativas.
- Nomes, decks, cartas, vida, contagens e atividade são os dados reais da
  partida. O conteúdo exemplificativo do mock não vira dado fixo do produto.
- Tamanhos intermediários e mesas de 2–6 jogadores exigem adaptação de encaixe,
  pois o HTML tem canvases fixos. A adaptação mantém a composição e as
  invariantes aprovadas; não permite substituir trilhos por blocos, restaurar
  lateral fixa ou ocultar campos.
- Com cinco ou seis participantes, repetir os quatro playmats disponíveis,
  preservando escudos, nomes e cores distintos. Não criar novas artes.
- Estados adicionais sem prancha própria preservam capacidades e recebem
  acabamento coerente com a V2; não há imagem de referência 1:1 para eles.

## User Stories

1. Como jogador, quero reconhecer na aplicação as telas do HTML V2, para receber a experiência visual aprovada.
2. Como jogador, quero que divergências do protótipo sejam limitadas às exceções aprovadas, para que a implementação não substitua o desenho por outra interpretação.
3. Como jogador, quero os campos inteiros de todos visíveis na visão geral, para acompanhar a partida sem rolar os campos.
4. Como jogador, quero quatro participantes em grade 2×2, para repartir o espaço da mesa como na V2.
5. Como jogador, quero meu campo embaixo à esquerda e o próximo jogador acima de mim, para ler a ordem em sentido horário.
6. Como jogador numa mesa de dois, quero dois campos em faixas inteiras, para aproveitar a área disponível.
7. Como jogador numa mesa de três, quero dois oponentes acima e meu campo na faixa inferior inteira, para manter uma visão conjunta.
8. Como jogador numa mesa de cinco, quero três campos acima e dois abaixo, para ninguém depender de uma faixa rolável.
9. Como jogador numa mesa de seis, quero grade 3×2, para todos continuarem representados.
10. Como jogador, quero trilhos compactos com escudo, vida, contagens e acesso às zonas, para dedicar o restante do quadrante às cartas.
11. Como jogador, quero editar minha vida pelos controles diretos existentes, para preservar a operação durante a mudança visual.
12. Como jogador, quero ver marcadores especiais quando diferentes de zero e poder iniciar sua edição quando zerados, para reduzir ruído sem perder ações.
13. Como jogador, quero nome, deck e atividade real no cabeçalho do campo, para reconhecer participantes e acompanhar a partida.
14. Como jogador, quero a indicação da vez e a ordem visual de escudos, para localizar o turno sem uma linha extensa de texto.
15. Como jogador, quero a última ação pública na barra superior, para acompanhar a partida com a crônica fechada.
16. Como jogador, quero os fundos ilustrados e véus do protótipo, para que a mesa tenha a aparência aprovada.
17. Como jogador, quero manter o fundo associado ao participante ao ampliar ou redimensionar, para não perder sua identificação visual.
18. Como jogador, quero cores e escudos distintos mesmo quando um fundo se repetir, para distinguir cinco ou seis participantes.
19. Como jogador, quero a tipografia, ouro de ação, molduras, espaçamento e ícones da V2, para reconhecer a mesma hierarquia visual.
20. Como jogador, quero a imagem inteira das cartas no campo, para reconhecê-las com facilidade.
21. Como jogador, quero continuar posicionando e agrupando cartas manualmente, para preservar a organização da minha partida.
22. Como jogador, quero manter cartas viradas e selos atuais reconhecíveis, para ler estados sem abrir detalhes a todo momento.
23. Como jogador, quero encaixe automático sem omitir cartas, para acompanhar campos densos.
24. Como jogador, quero detalhes atuais acessíveis na leitura ampliada quando a miniatura for pequena, para não perder informação.
25. Como jogador, quero ampliar um oponente pela composição do protótipo, para observar seu campo sem espremer o meu ou desperdiçar espaço.
26. Como jogador, quero retornar do foco à visão geral, para recuperar a composição anterior.
27. Como jogador, quero que foco e redimensionamento não regravem posições, para a apresentação não modificar o jogo.
28. Como jogador no computador, quero prévia por hover no lado oposto ao campo lido, para ler sem um modal central cobrindo a mesa.
29. Como jogador, quero prévia passiva também nos nomes do registro, para não abrir inspeção involuntariamente.
30. Como jogador, quero abrir a crônica sob demanda, para que registro e informações duplicadas não ocupem espaço permanentemente.
31. Como jogador no computador, quero a grade se reajustando quando a crônica abre, para nenhum campo ficar coberto.
32. Como jogador, quero preservar filtros e agrupamentos do registro, para não perder a leitura das ações.
33. Como jogador, quero minha mão sempre disponível em leque compacto como na V2, para jogar sem reabrir uma superfície.
34. Como jogador, quero destaque da carta apontada ou selecionada e acesso às demais cartas da mão, para operar mesmo quando ela estiver cheia.
35. Como jogador, quero Comprar, Desvirar, Mais e Passar turno nas posições e hierarquia da doca V2, para encontrar as ações frequentes.
36. Como jogador, quero as ações secundárias preservadas nos menus e painéis correspondentes, para o acabamento não remover capacidades.
37. Como jogador, quero continuar usando atalhos, seleção múltipla, arraste e operações em lote, para manter a eficiência da mesa.
38. Como jogador no celular horizontal, quero os quatro campos acima da doca, para mão e controles não cobrirem o meu campo.
39. Como jogador no celular horizontal, quero trilhos e acesso visível ao foco, para observar vida, contagens e cartas como na proposta.
40. Como jogador no celular vertical, quero oponentes em faixas de largura inteira e meu campo maior, para evitar duas colunas de miniaturas ilegíveis.
41. Como jogador no celular vertical, quero a barra de ações da carta própria acima da mão, para selecionar e agir sem um modal de leitura involuntário.
42. Como jogador no celular vertical, quero ampliar uma faixa preservando as demais, para observar um oponente sem perder a mesa.
43. Como jogador no celular, quero tocar carta adversária e abrir o painel inferior da V2, para ler carta, valores atuais, estados e dono.
44. Como jogador no celular, quero o atalho para o campo do dono e fechamento visível da leitura, para alternar entre informação e jogo.
45. Como jogador, quero mudar orientação e tamanho preservando mão, seleção e consulta, para continuar a operação em andamento.
46. Como jogador numa mesa móvel de cinco ou seis, quero faixas ajustadas com todos os campos visíveis e o meu maior, para continuar jogando sem exigir a altura fixa do exemplo de quatro.
47. Como jogador, quero rótulos acessíveis, foco de teclado, contraste e alvos de toque utilizáveis, para o visual continuar operável.
48. Como jogador, quero preservar movimento reduzido e estados de ação pendente ou recusada, para perceber o resultado sem perder acessibilidade.
49. Como jogador, quero manter zonas privadas e permissões corretas, para o redesenho não revelar cartas nem permitir ações indevidas.
50. Como usuário que aprova a entrega, quero comparar cada estado com sua prancha V2 nas mesmas dimensões, para avaliar a paridade além dos testes funcionais.
51. Como usuário que aprova a entrega, quero ver diferenças e exceções documentadas por estado, para não receber uma declaração genérica de conformidade.
52. Como jogador, quero as ações validadas com API real e dados persistidos, para que capturas bonitas não escondam fluxos desconectados.

## Implementation Decisions

- Q1–Q9 desta conversa foram aprovadas. A mudança corrige apresentação,
  composição e acesso às operações existentes, preservando regras de jogo.
  Não autoriza banco, infraestrutura, autenticação, transporte, migration,
  biblioteca estrutural ou mudança de contratos de API.
- Os módulos afetados são composição da mesa e foco; campo e projeção visual;
  identidade, vida e zonas; mão e controles; prévia e inspeção; crônica; menus,
  painéis e responsividade. Preservar a separação por responsabilidade vigente.
- No desktop de referência, barra superior de 46 px, doca de 112 px,
  margem/gap de 10 px, trilho de 66 px e quadrantes de aproximadamente
  705×356 px em 1440×900. Crônica de referência de 340 px. O DOM renderizado
  do protótipo é a fonte das medidas, não os valores arredondados do relato.
- No horizontal móvel, barra de 34 px e doca de 60 px; no vertical, barra de
  44 px e doca de 118 px; margens/gaps de 5 px e trilho normal de 46 px.
  No vertical de quatro jogadores, faixas de oponentes de 104 px; foco de
  250 px e demais faixas de 58 px. Medidas se adaptam quando não couberem,
  mantendo campos visíveis e campo próprio maior no vertical.
- Com quatro jogadores, ordem espacial no desktop e horizontal: próprio
  embaixo à esquerda, próximo acima à esquerda, seguinte acima à direita,
  último abaixo à direita. Foco usa faixa superior inteira e conserva próprio
  campo e demais oponentes abaixo conforme a prancha correspondente.
- Não existe breakpoint intermediário aprovado pelo HTML, que usa canvases
  fixos. Resolver transições por espaço útil e orientação, preservando os
  estados-alvo e encaixe. Redimensionar não salva novas posições.
- Encaixe considera cartas inteiras e suas rotações, sem classificação por
  tipo. Limites de altura do PDF são referências por contexto, não autorização
  para recortar imagens ou restaurar densidade manual. Todos os campos se
  orientam para o observador; virar continua sendo estado da carta.
- Na visão geral, foco e com crônica desktop, nenhum campo fica atrás de
  controles ou painéis. Painéis inferiores abertos deliberadamente podem
  cobrir temporariamente parte da mesa; fechar restaura a composição.
  Isso não autoriza mão/docas permanentemente sobrepostas aos campos.
- Na barra superior ficam sala, ordem por escudos, vez, última ação pública,
  Crônica e menu. Encerramento e controles secundários não disputam espaço
  permanentemente com o turno. Não duplicar lista de jogadores numa lateral.
- Prévia por hover é passiva e fica no lado oposto ao campo observado.
  Não abrir modal central nem duplicar a prévia numa lateral fixa.
- Carta própria mantém clique/toque para seleção, duplo clique para virar e
  toque longo para leitura. Carta adversária mantém clique/toque para
  inspeção pública. A seleção móvel mostra ações acima da mão; a leitura de
  oponente usa painel inferior com os dados e atalhos do protótipo.
- Preservar compra, desvirar, movimentos entre zonas, topo/fundo, consulta e
  reordenação do grimório, revelar/ocultar, faces, marcadores e modificadores,
  fichas/cópias, controle e dono, dados/moeda, turno e encerramento.
  Preservar também ações em lote, estados pendentes, erros e repetição segura.
- Encerramento fica no menu superior; ações adicionais no Mais da doca;
  zonas e marcadores pelo trilho/painel do jogador; ações da carta na barra e
  menus correspondentes. Consultas extensas conservam espaço adequado.
  Estados sem prancha recebem o acabamento V2, sem fluxos novos implícitos.
- Reutilizar os quatro JPEGs de playmat, fundo geral, ornamentos e fontes
  Cinzel/Geist/Geist Mono embutidos no HTML. Servir recursos locais; preservar
  os avisos de licença das fontes. Não substituir fundos por degradês
  provisórios nem criar novas artes. Associação permanece estável por
  participante durante a partida, foco e mudanças de layout; para cinco/seis,
  repetir fundos sem repetir a identidade visual do participante. Não há
  personalização de tema nem associação automática ao deck.
- Reproduzir véus, contraste, bordas, flâmula de vez, escudos e hierarquia de
  controles. O fundo usa recorte de preenchimento como no protótipo; a imagem
  das cartas, ao contrário, permanece inteira.
- Não tratar a existência de grade, testes verdes ou critérios funcionais
  atendidos como prova de paridade. Não aceitar diferenças conhecidas como
  “calibração futura”, nem gerar referência esperada a partir da implementação
  atual sem comparação com o HTML aprovado.

## Testing Decisions

As fronteiras foram apresentadas e aprovadas em Q4 e na confirmação Q9.
A fronteira principal é o **navegador com API real e banco descartável**,
reutilizando Playwright e a preparação pública existentes. Não há nova API
ou mecanismo de testes aprovado. A revisão visual pelo usuário integra o
aceite; teste funcional não aprova aparência nem decisões de produto.

### Matriz mínima de evidências

| Cobertura | Verificação |
| --- | --- |
| V1–V4 | Capturas aplicação/protótipo em 1440×900 e composição utilizável em 1366×768; geral, foco, hover e crônica. |
| V5–V6 | Capturas equivalentes em 844×390, com toque real emulado e foco acionado pelo controle visível. |
| V7–V9 | Capturas equivalentes em 390×844: seleção própria, faixa expandida e leitura de oponente. |
| Mesas de 2–6 | Visão geral e foco por quantidade no desktop e nas duas orientações móveis; todos representados, mão acessível, sem rolagem dos campos. |
| Adaptação | Redimensionamento, mudança de orientação e espaço intermediário; repetir cenários ocupados, não só campos vazios. |
| Operações preservadas | Fluxos reais de seleção, arraste, zonas, grimório, marcadores, turno, registro, painéis e encerramento. |

- Capturar nas dimensões CSS declaradas, com mesma escala de comparação,
  fontes/imagens carregadas e estado estabilizado. Registrar viewport,
  orientação, quantidade de participantes e estado de cada evidência.
- Produzir comparativo lado a lado por ID, com referência V2, resultado,
  diferenças encontradas e exceções aplicáveis. Usar dados controlados e
  reproduzíveis pela fronteira pública; imagens reais completas de cartas
  devem aparecer em ao menos uma rodada de aceite. Placeholders não bastam
  para validar o requisito de carta inteira nem o acabamento final.
- Comparar estrutura, tamanho e posição de regiões/controles, margens,
  espaçamentos, cores, fontes, fundos, bordas, selos e hierarquia. Diferenças de
  conteúdo real e as exceções declaradas são separadas das divergências de
  apresentação. Não existe percentual de diferença de pixels aprovado que
  possa dispensar a avaliação por tela. Antialiasing e conteúdo dinâmico não
  justificam layout distinto.
- Verificar visibilidade integral, ausência de sobreposição indevida e
  alcance real dos controles. Existência no DOM, classe CSS, interseção
  parcial com viewport ou igualdade de cálculos internos não comprovam isso.
- Reutilizar os fluxos existentes de mesa desktop/mobile, seleção/arraste,
  prévia e ações de cartas, registro, grimório, contadores e controle.
  Atualizar expectativas superadas pelo novo contrato sem enfraquecer
  verificações para acomodar defeitos.
- Usar duas sessões quando necessário para observar privacidade, permissão,
  sincronização e dados públicos atuais. Conferir pela API pública e após
  recarga que foco, leitura, crônica, orientação e tamanho não regravam
  posições ou executam ações de jogo.
- Exercitar campos vazios, ocupados e densos, incluindo cartas viradas,
  agrupamentos manuais, fichas/cópias e estados combinados. Encaixe não pode
  omitir cartas nem esconder falhas por testar só uma carta no campo.
- Preservar regressões da issue 57, inclusive campos esparsos/densos, geometria
  estável durante gestos e zoom real já especificado. Esta matriz complementa,
  não revoga, as garantias funcionais anteriores.
- Integração HTTP existente com MySQL real complementa invariantes que não
  forem suficientemente demonstradas pelo navegador. Teste unitário só para
  lógica determinística pertinente; não substitui renderização ou gesto real.
- Não fabricar respostas da API de jogo para comprovar o fluxo integrado.
  Controle de uma imagem externa ou simulação de falha visual específica
  deve ser declarado e não pode ser a única evidência do fluxo completo.
- A implementação deve entregar as capturas e indicar divergências ainda
  existentes. O aceite final depende da revisão visual explícita do usuário;
  aprovação desta spec não é aprovação antecipada de nenhuma tela futura.

## Out of Scope

- Implementar a correção na tarefa que publica esta spec; sua execução é uma
  entrega posterior. Decomposição em subissues não faz parte desta publicação.
- Paridade 1:1 de login, lobby, decks e preparação: não há pranchas V2 dessas
  telas. Preservar fluxos e requisitos vigentes sem redesenho adicional.
- Fileiras obrigatórias, classificação por tipo e empilhamento automático.
- Recorte de arte das cartas no campo, mão ou leitura.
- Novas artes, seleção de tema, personalização de playmat ou tema pelo deck.
- Alterar regras, persistência de posições, permissões, privacidade,
  autenticação, banco, infraestrutura, transporte ou contratos de API.
- Motor de regras, fases, chat, histórico, novas operações de biblioteca ou
  outras funcionalidades independentes. Não absorver escopos de outras issues.

## Further Notes

Aprovação explícita na conversa de 25/10/2026: Q1 e Q2 OK; Q3 aprovada com
correção para manter carta inteira no campo; Q4 e Q5 OK; Q6 formalização
somente após pedido explícito; Q7 OK; Q8 sim; Q9 sim confirmando o resumo.
Depois disso, o usuário pediu esta publicação via to-spec e enfatizou a
referência do HTML para garantir paridade visual. As fronteiras de teste e
revisão visual já estavam incluídas na aprovação Q4/Q9.

A issue 57 e o PR 69 permanecem como histórico da entrega anterior. Os V2
já existiam na branch de planejamento com nomes contendo espaços; seus bytes
são idênticos aos dois arquivos agora incorporados com nomes normalizados.
Não atribuir a diferença atual apenas à falta de commit das referências.

Integridade dos documentos de referência:

- HTML SHA-256: `65ae5ed1f8926471930464029adc035ea2679b587d8ef79e590117b1b6f0bb19`.
- PDF SHA-256: `2c2653e30bffb98b80cb37e1e8c61f3792a5e583ca8b10d5f130507c79964483`.

Esta spec substitui a liberdade anterior de calibração visual nos estados
cobertos, a espera por novas artes de playmat e as apresentações anteriores
conflitantes. Preserva o campo manual, cartas inteiras e os contratos de jogo
aprovados. Ver [registro desta aprovação](../decisions/paridade-visual-v2.md),
[issue 57](https://github.com/rafacvs/mtg4fun/issues/57) e
[spec anterior da mesa V2](https://github.com/rafacvs/mtg4fun/blob/201def94d0ec94a704360ddc91e5380a6f90eabb/docs/specs/06-mesa-v2-campo-unificado.md).

As capturas locais da auditoria são diagnóstico anterior à correção, não
baselines aprovadas do produto. A sala 4 foi referência de observação; testes
não devem depender de seu ID, credenciais ou dados privados.
