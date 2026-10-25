# Plano de ajustes visuais v2

**Estado:** confirmado pelo usuário em Q16, após aprovação de Q1–Q15.
Implementação não iniciada nesta tarefa. Requisitos consolidados na
[spec da mesa v2](../specs/06-mesa-v2-campo-unificado.md).

Objetivo: acompanhar os campos de todos os jogadores e executar ações com
clareza, em uma mesa visualmente consistente, agradável e responsiva ao espaço
útil e ao zoom. O campo é único, organizado manualmente em grade invisível.

As aprovações e sua origem ficam na
[decisão da mesa v2](../decisions/mesa-v2-campo-unificado.md). Este plano não
atribui ao usuário decisões técnicas adicionais.

## Referências e precedência

- Solicitação e respostas Q1–Q15 da conversa atual.
- Documentos fornecidos: `mock-iterativo (v2).html` e
  `proposta-nova-experiencia (v2).pdf`, neste diretório.
- Implementação integrada pelo [PR 51](https://github.com/rafacvs/mtg4fun/pull/51).
- [Spec anterior](../specs/05-nova-experiencia-da-mesa.md), para identificar os
  pontos substituídos e preservar os contratos não alterados.
- [Estratégia de testes](../testing.md).

Os documentos v2 propõem duas fileiras e pilhas automáticas de terrenos. Esses
pontos não serão seguidos: a conversa aprovou campo unificado e organização
manual. As artes de cartas dos mocks são ilustrativas; a aplicação continua
usando as imagens completas e os dados reais do catálogo.

## Evidências da auditoria anterior às mudanças

Navegação real por Chromium headless na aplicação Docker, mais cenários com
API e MySQL descartáveis. Foram capturados 43 prints de login, lobby, decks,
preparação, mesa, menus, inspeção, quatro/seis jogadores, orientações móveis,
zoom real e referências v2.

| Achado | Evidência observada | Consequência para o plano |
| --- | --- | --- |
| Campo próprio fora do enquadramento | Sala existente com dez cartas, nenhuma intersectando a área inicial em 1440×900; canvas de 28.987 px. | Tratar coordenadas antigas/esparsas e enquadramento, não apenas trocar tamanhos fixos. |
| Adversários cortados | Com quatro jogadores e 16 cartas por campo, seis cartas de cada adversário ficam inteiramente fora do respectivo campo. | Grade e encaixe devem ser verificados com campos ocupados. |
| Jogadores fora da vista | Com seis jogadores, faixa de oponentes de 1.953 px para 1.168 px úteis; dois adversários fora da vista inicial. | Substituir faixa rolável pela composição aprovada. |
| Vertical sem campos | Campos com dimensão zero; tela mostra mão e convite para girar. | Implementar o vertical jogável e atualizar testes do contrato antigo. |
| Zoom muda a composição | Em janela de 1440×900, 150% gera 960×600 CSS e ativa a composição mobile horizontal. | Testar zoom real, além de redimensionamento. Ausência de overflow da página não basta. |
| Hover abre modal | Passar o mouse em carta do registro abre inspeção completa e captura foco. | Separar prévia passiva de inspeção deliberada. |

Os arquivos locais estão em `app/test-results/ui-v2-audit/`: `index.html`,
`auditoria.md`, `dense-audit.md`, `geometry.json`, `dense-metrics.json`,
`zoom-real.json`, imagens e resultados E2E. São artefatos gerados e ignorados
pelo Git; não estarão disponíveis automaticamente num checkout ou no PR.

Resultado histórico desta auditoria: build/TypeScript passaram. A suíte
descobriu 207 cenários: **96 passaram, 69 falharam e 42 foram pulados**, em
12,5 minutos. Uma reexecução isolada de seleção passou. Há expectativas antigas
de clique/modal e portrait, seletores ambíguos, estado compartilhado entre
cenários do mesmo worker e corridas de preparação. Algumas falhas não chegam
à ação que deveriam verificar. Não há declaração de validação completa das
ações atuais, nem de conformidade da implementação à v2.

A aplicação foi acessada pelo Docker. A execução E2E existente exige Go no
host: foi usado Go temporário em `/private/tmp`, sem instalação global ou
mudança na configuração operacional. Os bancos descartáveis foram removidos.

## Experiência resultante

### Campo, enquadramento e foco

- Campo único, com grade invisível; sem faixas de terrenos/permanentes.
- Reaproveitar os dados de posicionamento existentes. A apresentação compacta
  grandes vazios, preserva ordem/grupos e calcula a escala útil automaticamente.
- Abrir, redimensionar, mudar zoom, abrir registro ou focar um campo não deve
  gravar novas posições. Um arraste explícito continua sendo uma ação real de
  posicionamento; a projeção precisa traduzir corretamente seu destino.
- Remover o seletor de densidade. Não empilhar cartas automaticamente.
- Representar todas as cartas; reduzir detalhes secundários conforme o espaço
  e oferecer leitura por foco/prévia/inspeção. Isso não promete texto impresso
  legível em todas as miniaturas de um campo muito cheio.
- Manter a geometria estável durante arraste/seleção. Atualizações de vida e
  estados continuam; o reenquadramento ocorre ao terminar o gesto.
- Um campo ampliado por vez, com retorno explícito à visão geral e os outros
  jogadores ainda visíveis. A mão própria permanece disponível.

### Composição por participantes e dispositivo

| Situação | Composição |
| --- | --- |
| Um jogador | Campo próprio aproveita a área disponível; mão na faixa inferior. |
| Dois | Duas faixas, próprio abaixo. |
| Três | Dois oponentes acima, próprio na faixa inferior. |
| Quatro | 2×2, próprio embaixo à esquerda na visão geral. |
| Cinco | Três acima e dois abaixo, próprio embaixo à esquerda. |
| Seis | 3×2, próprio embaixo à esquerda. |
| Celular horizontal | Visão conjunta adaptada ao espaço, com a composição v2 como referência; sem a faixa estreita rolável atual. |
| Celular vertical | Oponentes em faixas, campo próprio maior, expansão deliberada por jogador e mão disponível. |

Campos orientados para o observador. Foco redistribui espaço, sem retirar os
demais jogadores da visão. As proporções exatas serão calibradas no navegador
com os cenários de aceite, preservando esses comportamentos.

### Informação e ações

- Informações compactas por jogador: identidade/turno, vida e acesso às zonas
  e suas contagens. Manter as permissões e a edição existentes.
- Marcadores de jogador visíveis quando não nulos; edição acessível também
  quando todos forem zero. Não introduzir semântica nova de dano/contadores.
- Prévia flutuante passiva. Registro sob demanda; no desktop, ocupa espaço e
  faz a grade se ajustar. Não duplicar a lista fixa de jogadores.
- Mão sempre disponível, com sobreposição moderada, destaque e rolagem quando
  necessário. A proibição de rolagem interna dos campos não proíbe rolagem da
  mão, listas, menus ou registro.
- Carta própria seleciona no clique/toque; mouse mostra prévia e toque longo
  inspeciona. Duplo clique no campo mantém virar/desvirar. Carta adversária
  inspeciona no clique/toque. Cabeçalho tem botão explícito de foco.
- Preservar seleção múltipla e operações existentes. Não criar vínculo
  permanente de agrupamento como efeito colateral do redesenho.
- No celular, registro/jogador/ações são painéis inferiores com fechamento
  visível e cerca de 60% da tela inicialmente, rolando conteúdo longo. Podem
  cobrir campos temporariamente. A consulta extensa do grimório mantém sua
  superfície maior. Fechar retorna à composição anterior.

### Consistência visual

Manter a direção existente de fundo noturno, ouro para ação e cor de assento
para identificação, com Cinzel/Geist. Priorizar cartas e informações de jogo,
reduzir cabeçalhos e controles repetidos, evitar rótulos quebrados e manter
contraste, foco de teclado e alvos de toque confortáveis. Os acabamentos
devem seguir o comportamento de movimento reduzido já existente.

Login, lobby, biblioteca e preparação recebem correções concretas de
consistência, espaçamento, legibilidade e responsividade. Seus fluxos e
funcionalidades atuais permanecem; a v2 não fornece um novo desenho dessas
telas.

## Entregas e dependências propostas

| Entrega | Conteúdo e resultado verificável | Dependências |
| --- | --- | --- |
| 1. Base de verificação | Classificar falhas atuais, atualizar expectativas superadas e isolar dados dos cenários. Manter falhas reais visíveis. Preparar massa ocupada e coordenadas esparsas. | Plano confirmado em Q16. |
| 2. Campo unificado | Projeção/encaixe, tradução do arraste, grade invisível, remoção de guias e densidade, estabilidade durante gestos. | 1. |
| 3. Visão conjunta e foco | Composição de um a seis, foco/retorno, zoom e redimensionamento, sem esconder campos em faixas roláveis. | 2. |
| 4. Mão, informações e painéis | Trilhos por jogador, prévia passiva, registro sob demanda, mão permanente e ações acessíveis. | 3. |
| 5. Celular e gestos | Vertical jogável, horizontal adaptado, seleção/inspeção/foco sem ambiguidade e painéis inferiores. | 3 e 4. |
| 6. Demais telas | Consistência de login/lobby/decks/preparação, sem adicionar funcionalidades. | 1; integrar ao acabamento de 4 e 5. |
| 7. Aceite integrado | Matriz de browser/zoom, regressão de ações e persistência, prints comparáveis, documentação coerente e PR aberto para revisão. | 2–6. |

Os pontos principais do cliente estão em `app/src/features/rooms/`: composição
em `TableFields`, projeção em `battlefieldLayout`/`overviewLayout`, campos em
`PlayerTable`/`OpponentField`, coordenação em `MatchBoard`, apresentação em
`desktop-table.css`/`mobile-table.css`, e componentes de mão/painéis/registro.
Evitar concentrar o redesenho inteiro em `MatchBoard` ou acumular overrides CSS
que deixem composições antigas ativas.

O trabalho cabe na arquitetura existente. Não está prevista migration para
posições nem mudança no contrato de jogo. Se uma dessas mudanças se mostrar
necessária, apresentar o motivo e obter autorização específica antes de agir.

## Critérios de aceite e matriz de verificação

### Composição e leitura

- Um a seis participantes; todos os campos disponíveis na visão geral, com
  a composição aprovada e mão própria visível também durante foco.
- Carta não fica cortada pelas bordas do campo; sobreposição manual
  intencional é tratada separadamente. Interseção parcial de retângulos não
  conta como evidência suficiente de enquadramento.
- Reproduzir os casos da auditoria: dez cartas em posições esparsas, quatro
  jogadores com 16 cartas por campo e seis jogadores com 16 cartas por campo.
- Ampliar a massa de teste com campos vazios, cartas viradas, pilhas manuais,
  fichas/cópias, estados e contagens maiores. Amostras de 30 e 60 cartas são
  cenários de estresse, não limites novos de cartas permitidas.
- Quando miniaturas perderem detalhes, prévia/inspeção permitem ler nome,
  estado e valores atuais, respeitando informações públicas/privadas.

### Responsividade e gestos

- Desktop: 1366×768 e 1920×1080; manter 1440×900 para comparação com a
  auditoria/protótipo. Zoom real de 100%, 125%, 150% e 200%.
- Celular: vertical e horizontal, incluindo 390×844/844×390, além das
  dimensões dos dispositivos usados pela suíte atual.
- Verificar espaço útil CSS real; a equivalência 1920×1080 a 133% = 1440×900
  escrita na referência é incorreta.
- Mudar zoom, orientação ou tamanho não altera dados de cartas nem perde
  seleção/consulta por simples mudança de apresentação.
- Arraste individual/múltiplo, seleção por área, alinhamento, pilhas,
  virar/desvirar e destinos funcionam sob a projeção. Não deslocar alvos
  durante o gesto.
- Teclado, mouse e toque exercitados no navegador. Prévia não captura foco;
  inspeção/painéis deliberados têm fechamento acessível.

### Operações e persistência

Exercitar com API real os fluxos de acesso, decks, preparação, compra,
movimentos entre zonas, consulta/revelação/reordenação do grimório,
vida/marcadores/modificadores, estados/faces, fichas/cópias, transferência de
controle, turno/dado/moeda e finalização. Não considerar um cenário coberto
quando o teste falhar antes de alcançar a ação.

Usar dois clientes quando houver privacidade, controlador ou sincronização;
recarregar para comprovar persistência e comparar posições antes/depois de
ações somente visuais. Manter cobertura de confirmação incerta e recusa de
ação onde a interface alterada participa desses fluxos.

Testes unitários podem validar a projeção determinística e seu mapeamento,
mas não substituem arrastar/selecionar cartas reais no navegador. Comparação
de screenshots e revisão visual complementam as asserções; não substituem
contratos HTTP/persistência quando esses forem exercitados.

## Fechamento do planejamento

Spec publicada na [issue 57](https://github.com/rafacvs/mtg4fun/issues/57), com `ready-for-agent`.

O usuário confirmou o entendimento em Q16 e solicitou a publicação da spec
no GitHub. A spec registra requisitos aprovados; a execução permanece
pendente. Planejamento e validação histórica não anunciam a nova interface
como disponível. Esta tarefa conclui a documentação, não a implementação.
