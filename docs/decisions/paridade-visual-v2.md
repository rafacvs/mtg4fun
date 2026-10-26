# Paridade visual obrigatória com o HTML V2

## Estado

Requisitos aprovados explicitamente na conversa de 25/10/2026 e publicados na
[issue 70](https://github.com/rafacvs/mtg4fun/issues/70), com `ready-for-agent`.
A implementação corretiva foi entregue tecnicamente na branch de integração
da issue #70. O aceite visual explícito do usuário continua pendente na
issue #81; ele não é substituído por testes automatizados nem pela revisão do
agente.
A fonte consolidada é a [spec de paridade](../specs/07-paridade-visual-v2.md);
este registro documenta a autorização, sem duplicar todos os requisitos.

## Contexto investigado

A [issue 57](https://github.com/rafacvs/mtg4fun/issues/57) foi entregue pelo
[PR 69](https://github.com/rafacvs/mtg4fun/pull/69), mas não exigia paridade
visual 1:1 com inventário e aceite por tela. A auditoria usou Chromium headless
via Playwright na aplicação local, sala 4, e renderizou as pranchas HTML.
As capturas documentam o estado anterior à correção, não aprovação do produto.

Os documentos V2 locais já tinham cópias idênticas versionadas na branch de
planejamento, com nomes diferentes, referenciadas pela issue 57. Esta entrega
incorpora os dois arquivos com nomes normalizados à documentação integrada;
a origem e os hashes estão na spec. Não atribuir a divergência visual apenas
a uma suposta ausência completa de referências versionadas.

## Evidência da aprovação explícita

| Rodada | Resposta e alcance |
| --- | --- |
| Q1 | “OK”: HTML principal, PDF complementar, nove pranchas de interface; login/lobby/decks/preparação sem alvo 1:1 nesses documentos. |
| Q2 | “ok”: preservar campo único manual, sem fileiras obrigatórias ou pilhas automáticas. |
| Q3 | “siga em tudo, mas em campo mantenha a imagem da carta inteira para facilitar”: acabamento V2 com carta inteira. |
| Q4 | “ok”: capturas comparáveis nos quatro viewports, layouts de 2–6, testes funcionais e revisão visual do usuário. |
| Q5 | “ok”: preservar ações existentes nos menus/painéis correspondentes da V2. |
| Q6 | “sim, mas vou pedir explicitamente apos terminarmos o refinamento”: aguardar pedido para formalizar spec/issues. |
| Q7 | “ok”: quatro playmats reutilizados, associação estável ao participante e repetição para cinco/seis com identidade distinta. |
| Q8 | “sim”: adaptação de encaixe e alturas sem ocultar campos ou sobrepor controles; campo próprio maior no vertical. |
| Q9 | “sim”: confirmação do resumo e encerramento do refinamento. |

Após Q9, o usuário pediu explicitamente transformar o refinamento em nova spec
via to-spec no GitHub, enfatizando a referência do HTML para garantir paridade
visual. Esse pedido autorizou a publicação dos requisitos, mas não constituiu
aprovação antecipada das telas entregues. A aprovação visual permanece uma
etapa humana posterior, registrada na issue #81.

## Relação com decisões anteriores

A paridade substitui a liberdade de calibração visual da issue 57 nos estados
com referência. Mantém suas exceções funcionais de campo manual e suas
invariantes de posição, privacidade, permissão e sincronização. Substitui a
espera por novas artes da [decisão 35](35-nova-experiencia-da-mesa.md): os
quatro fundos do HTML estão disponíveis e serão reutilizados.

A [spec da mesa V2 anterior](https://github.com/rafacvs/mtg4fun/blob/201def94d0ec94a704360ddc91e5380a6f90eabb/docs/specs/06-mesa-v2-campo-unificado.md)
e seu [registro de decisões](https://github.com/rafacvs/mtg4fun/blob/201def94d0ec94a704360ddc91e5380a6f90eabb/docs/decisions/mesa-v2-campo-unificado.md)
permanecem referências históricas. Os pontos conflitantes da apresentação
anterior cedem ao HTML V2 e às exceções explícitas da nova spec. Arquitetura,
banco, API, infraestrutura e regras de jogo não foram reabertos.

## Implementação e validação

Esta tarefa publica requisitos e referências, não código da interface.
Nenhum resultado histórico de teste foi convertido em validação nova.
O aceite futuro requer os fluxos reais e comparativos definidos na spec,
seguidos de revisão visual explícita do usuário.
