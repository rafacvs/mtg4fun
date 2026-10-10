# Estratégia de testes

Esta estratégia detalha as verificações exigidas em
[AGENTS.md](../AGENTS.md#organização-e-verificações). Ela serve para escolher
uma fronteira que possa refutar o comportamento entregue, não para multiplicar
testes de baixo valor.

## Escolher a fronteira

| Risco ou comportamento | Verificação principal |
| --- | --- |
| Cálculo, conversão, ordenação ou regra local determinística | Teste unitário junto do módulo. |
| HTTP, executável, autorização, banco, transação, reinício, cache ou contrato entre módulos | Teste de integração em `api/tests/integration/`, usando o executável ou a API pública. |
| Clique, toque, orientação, renderização, acessibilidade ou fluxo do jogador | Fluxo de navegador em `app/tests/e2e/` usando a API real. |
| Build, variáveis, volumes, proxy ou processo em contêiner | Verificação em `infra/tests/` ou smoke Docker equivalente. |
| Serviço HTTP de terceiro | Contrato controlado na integração e smoke manual ou opt-in contra o serviço real. |

Uma mudança pode requerer mais de uma linha. Por exemplo, uma imagem externa
em cache precisa de integração para a requisição de saída e persistência do
cache, navegador para abrir a consulta, e uma verificação real documentada
quando a fonte for adicionada.

## Evidência que não basta

**Tautological tests are considered harmful.** Um teste é tautológico quando
repete a implementação em vez de desafiar seu resultado: testar um mock que
sempre devolve sucesso para a única chamada relevante, conferir que um mock foi
invocado sem conferir o efeito público, ou afirmar somente estado interno que o
usuário não pode observar. Esses testes podem complementar uma fronteira real,
mas não comprovam o requisito que alegam cobrir.

Um teste de navegador não comprova uma rota quando intercepta essa mesma rota e
devolve a resposta de sucesso. Nesse caso, mantenha a interceptação somente
para testar uma falha visual específica e adicione outro cenário que use a API
real. De modo equivalente, um teste de integração com servidor controlado deve
fazer esse servidor validar a requisição recebida, em vez de responder sucesso
incondicionalmente.

## Dependências HTTP externas

Mantenha a suíte comum determinística e independente da disponibilidade da
Internet. Para cada integração externa, use uma fonte controlada que valide:

- método, caminho, parâmetros de consulta e cabeçalhos exigidos;
- redirecionamentos, status, tipo de conteúdo e limites de tamanho aceitos;
- falhas temporárias e respostas incompatíveis;
- efeito durável observado pelo cliente, como cache compartilhado após reinício.

Ao introduzir ou alterar o provedor, execute também um smoke explícito contra o
endpoint real, com uma entrada conhecida e sem gravar dados de produção. Registre
no PR a data, o recurso consultado, o status final, o tipo de conteúdo e o que
foi observado. Esse smoke é evidência operacional; não deve tornar testes locais
ou CI dependentes de rede externa.

## Revisão e relatório

No PR, relacione cada requisito observável novo à verificação que o cobre e
declare limites reais. Revisores devem perguntar qual defeito o teste detectaria
se a rota, dependência, persistência ou interface estivesse desconectada. Quando
a resposta for “nenhum”, substitua ou complemente o teste antes de aceitá-lo.
