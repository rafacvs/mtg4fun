# 02: Carta — edição direta de poder/resistência

**What to build:** Editar os dois valores manuais diretamente no detalhe da
carta no formato `[−] [Poder] / [Resistência] [+]`, sem abrir o submenu Ajustes.
Os inputs são independentes; os botões alteram ambos os valores em um.

**Blocked by:** Nenhum (pode começar imediatamente).

**Status:** implementado

Requisitos: [spec do refinamento](../../specs/04-refinamento-ui-mesa.md).
Limite aprovado: [atualização sequencial](../../decisions/29-refinamento-ui-mesa.md).
Integra o [refactor local](README.md).

- [x] Os inputs de Poder e Resistência aparecem ao abrir o detalhe editável, separados por barra, com apenas um botão menos antes do par e um mais depois; não há submenu Ajustes.
- [x] Inputs têm nomes acessíveis e editam cada valor independentemente, confirmando por Enter/perda de foco sem enviar intermediários inválidos ou duplicar confirmação.
- [x] Menos e mais alteram ambos os valores em um, mantendo diferenças prévias entre eles, zero, negativos e limites atuais.
- [x] Usar as duas operações existentes em sequência, verificando sucesso antes de seguir e bloqueando novos cliques durante o envio; não usar chamadas concorrentes nem mudar a API.
- [x] Falha parcial identifica qual atributo foi confirmado e qual ficou pendente. Recuperação não repete o incremento já confirmado; confirmação incerta preserva a intenção existente em vez de criar um novo incremento às cegas.
- [x] Não reinterpretar valores como totais calculados: preservar a semântica manual, inclusive números já presentes em fichas e cópias, sem inferir o texto impresso ou o tipo da carta.
- [x] Preservar permissões por dono/controlador, privacidade, marcadores, movimento, estados e revelação ao fechar; consultas não editáveis não oferecem edição.
- [x] Reaproveitar os controles numéricos e apresentação compartilhada necessários, mantendo o card independente da entrega de vida.
- [x] Navegador com servidor real verifica inputs independentes, ambos os botões, valores distintos, recarga, sincronização e permissões. Adicionar cenário de falha parcial/confirmação incerta com falha controlada específica, conferindo o efeito público e ausência de repetição.
- [x] Revisar prints e interação em celular vertical/horizontal, dispositivo médio e desktop, com teclado/toque, valores legíveis e botões de pelo menos 44 por 44 pixels.
- [x] Registrar verificações e a limitação explícita de que o par não é atualizado atomicamente.

## Verificação

Em 19/10/2026, na branch `refactor/game-ui`:

- `npm run build` em `app/` passou.
- `npx playwright test tests/e2e/contadores.spec.ts tests/e2e/game-ui.spec.ts tests/e2e/ajustes-mesa.spec.ts tests/e2e/fichas.spec.ts --project=desktop` passou (12 testes).
- Os mesmos quatro arquivos em celular e celular horizontal: 20 passaram e 4 foram ignorados. Os ignorados já existiam: hover só no desktop e a matriz extra de larguras só no desktop.
- A falha parcial devolve 500 só na resistência, com o poder indo ao servidor real. O estado público fica com poder incrementado uma vez; o clique seguinte completa só a resistência. A confirmação incerta aborta a requisição: o retry da resistência reutiliza o mesmo intent, e abortar o poder não envia resistência.
- Revisão visual em `http://127.0.0.1:8080` em 320×700, 390×844, 768×1024, 1280×800 e 844×390. O par cabe na linha, os alvos mediram pelo menos 44×44 px, não há botão Ajustes e `+2/-1` seguido de mais chegou a `+3/+0`, que permaneceu após recarregar.

Limitação: o par não é atômico. Se o poder confirma e a resistência falha, a carta fica pela metade até o próximo clique no par, que envia só a resistência pendente. Se a falha incerta é a do poder, o retry confirma só essa etapa e não envia a resistência; a diferença entre os dois pode mudar em um até um novo ajuste. Trocar de carta descarta o restante local dessa recuperação.
