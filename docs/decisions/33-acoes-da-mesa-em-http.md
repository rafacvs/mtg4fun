# Identificadores de ações da mesa em HTTP

Relaciona-se às issues [10](../issues/10-consultar-e-embaralhar-grimorio.md)
e [15](../issues/15-dados-moedas-e-turnos.md) e ao
[contrato de intenções aprovado](15-dados-moedas-e-turnos.md).

## Contexto e autorização

No deploy acessado por IP público via HTTP, os botões da mesa falhavam antes
de enviar a requisição. O navegador não disponibiliza `crypto.randomUUID()`
nessa origem, embora o disponibilize em localhost. SSE não participa desse
erro: as ações usam POST e a mesa sincroniza por polling.

Depois de considerar HTTPS por IP, o usuário pediu explicitamente corrigir o
código para evitar configurar VM, Oracle e Nginx neste momento. A autorização
cobre a compatibilidade das ações com HTTP; não altera autenticação, transporte,
infraestrutura ou contratos da API.

## Implementação

Todas as ações em `useMatch` usam um gerador de UUID v4 que prefere
`crypto.randomUUID()` e, quando ausente, usa `crypto.getRandomValues()` com os
bits de versão e variante do UUID. Não há dependência nova nem uso de
`Math.random()`. O identificador continua sendo criado uma vez por intenção,
antes da operação que pode ser reenviada.

`COOKIE_SECURE` mantém seu comportamento existente: em HTTP, deve permanecer
`false`; em HTTPS, pode ser `true`. Essa configuração controla o envio do
cookie por conexão segura e o esquema esperado na validação de origem. Ela
não habilita APIs do navegador nem fornece criptografia para HTTP.

## Verificação

O teste de navegador `app/tests/e2e/acoes-http.spec.ts` cobre compra,
embaralhamento, consulta privada e dado contra a API e MySQL reais, com
identificadores distintos por ação e reutilizados no reenvio. Exercita tanto
localhost com `randomUUID` nativo quanto uma origem HTTP que o Chromium resolve
para o mesmo servidor, sem substituir a API Crypto. Confere explicitamente que
a segunda origem não é segura e não disponibiliza `randomUUID`.

Validação em 2026-10-20: `npm run build` passou. O teste foi executado nos
projetos `desktop`, `celular` e `celular-horizontal`, com os seis cenários
aprovados contra a API e MySQL reais. Não houve alteração nem teste na VM de
produção.
