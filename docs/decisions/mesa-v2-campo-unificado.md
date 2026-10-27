# Mesa v2: campo unificado e visibilidade conjunta

## Estado e autorização

Decisões de produto aprovadas na conversa de planejamento posterior ao PR 51.
A confirmação final do entendimento foi dada em Q16, seguida do pedido de
publicação como spec via to-spec. A UI ainda não foi alterada nesta tarefa;
aprovação das respostas não é evidência de implementação.

O usuário pediu análise do código, navegação real e prints, usando
`docs/redesign/mock-iterativo (v2).html` e
`docs/redesign/proposta-nova-experiencia (v2).pdf`. Explicitou que o campo deve
ser unificado, sem lugares específicos para terrenos ou permanentes.
Essa instrução prevalece sobre as duas fileiras por tipo presentes na v2.

Evidência das aprovações na conversa:

- Q1–Q4: resposta **“sim pra todas”**.
- Q5–Q10: resposta **“ok pra tudo”**, depois de listar OK para cada pergunta.
- Q11–Q15: resposta **“Q11 - OK / Q12 - ok / Q13 - ok / q14 - ok / q15 ok”**.
- Q16: **“sim, confirmo”**, com pedido de registrar o entendimento como spec
  usando o GitHub como issue tracker e a skill to-spec.

Publicação dos requisitos: [issue 57](https://github.com/rafacvs/mtg4fun/issues/57), marcada `ready-for-agent`.

## Decisões aprovadas

| Pergunta | Decisão |
| --- | --- |
| Q1 | Posicionamento e agrupamentos manuais; sem separar por tipo ou empilhar terrenos automaticamente. |
| Q2 | Dois jogadores em faixas; três com dois oponentes acima e campo próprio abaixo; quatro em 2×2; cinco/seis em 3×2, com cinco ocupando três lugares acima e dois abaixo. Jogador próprio embaixo à esquerda na visão geral; foco amplia um campo mantendo os demais visíveis e a mão disponível. |
| Q3 | Celular vertical jogável: oponentes em faixas, campo próprio maior e expansão por toque. |
| Q4 | Validar zoom real do navegador em 100%, 125%, 150% e 200%, com referências desktop de 1366×768 e 1920×1080, considerando o espaço útil real. |
| Q5 | Grade invisível para alinhamento e agrupamento; nenhuma fileira obrigatória por tipo. |
| Q6 | Substituir a lateral fixa por informações compactas por jogador, prévia flutuante e registro sob demanda. No desktop, registro aberto reduz o espaço da grade. Marcadores de jogador aparecem quando não nulos, com edição acessível pelo jogador. Hover não abre modal. |
| Q7 | Mão própria sempre visível em faixa compacta, com sobreposição moderada, destaque da carta apontada/selecionada e rolagem quando necessário, inclusive ao observar oponente. |
| Q8 | Todos os campos orientados para o observador; não espelhar os superiores. Cartas viradas mantêm sua rotação de estado. |
| Q9 | Retirar Compacta/Confortável; tamanho automático conforme espaço disponível, com foco para ampliar. |
| Q10 | Redesenho de composição concentrado na mesa. Login, lobby, decks e preparação recebem ajustes de consistência, espaçamento, legibilidade e responsividade, preservando os fluxos atuais. |
| Q11 | Compactar visualmente grandes intervalos vazios, preservando ordem, agrupamentos, espaços próximos reconhecíveis e posições salvas. Não reorganizar por tipo nem migrar posições para resolver apresentação. |
| Q12 | Todas as cartas representadas na visão geral, sem rolagem interna dos campos nem pilhas automáticas. Reduzir tamanho e detalhes secundários progressivamente; usar foco/prévia/inspeção para leitura. |
| Q13 | Geometria estável durante arraste e seleção por área; recalcular ao terminar. Não ampliar automaticamente o campo ao iniciar arraste da mão. Atualizações de informações continuam. |
| Q14 | Carta própria: clique/toque seleciona; duplo clique no campo mantém virar/desvirar. Mouse oferece prévia; toque longo inspeciona. Carta adversária: clique/toque inspeciona. Botão explícito no cabeçalho amplia o campo. |
| Q15 | No celular, registro/jogador/ações usam painéis inferiores temporários, inicialmente limitados a cerca de 60% da tela, com fechamento visível e rolagem interna. Podem cobrir parte dos campos enquanto abertos. Consulta extensa do grimório mantém superfície maior. |

## Relação com decisões anteriores

Estas escolhas substituem os pontos conflitantes de apresentação e interação
da [decisão 35](35-nova-experiencia-da-mesa.md), especialmente faixa rolável de
oponentes, vertical restrito à mão, guias por tipo e densidades fixas.
O [plano](../redesign/plano-ajustes-v2.md) delimita as entregas e verificações.
Os requisitos consolidados ficam na [spec da mesa v2](../specs/06-mesa-v2-campo-unificado.md).

Os contratos de jogo existentes, inclusive consulta do grimório, valores
impressos/modificadores, permissões, privacidade, sincronização e encerramento,
não foram reabertos. A compactação aprovada é uma projeção visual, não uma
reescrita de dados persistidos. Novos contratos, migrations ou dependências que
determinem a arquitetura não estão autorizados por estas respostas.

## Implementação e validação

Planejamento, sem implementação de produto. A auditoria executou a aplicação
anterior às mudanças: os resultados estão resumidos no plano. Esses testes
não validam o redesign ainda inexistente e não substituem as aprovações acima.
