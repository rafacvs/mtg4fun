# 02: Carta — edição direta de poder/resistência

**What to build:** Editar os dois valores manuais diretamente no detalhe da
carta no formato `[−] [Poder] / [Resistência] [+]`, sem abrir o submenu Ajustes.
Os inputs são independentes; os botões alteram ambos os valores em um.

**Blocked by:** Nenhum (pode começar imediatamente).

**Status:** ready-for-agent

Requisitos: [spec do refinamento](../../specs/04-refinamento-ui-mesa.md).
Limite aprovado: [atualização sequencial](../../decisions/29-refinamento-ui-mesa.md).
Integra o [refactor local](README.md).

- [ ] Os inputs de Poder e Resistência aparecem ao abrir o detalhe editável, separados por barra, com apenas um botão menos antes do par e um mais depois; não há submenu Ajustes.
- [ ] Inputs têm nomes acessíveis e editam cada valor independentemente, confirmando por Enter/perda de foco sem enviar intermediários inválidos ou duplicar confirmação.
- [ ] Menos e mais alteram ambos os valores em um, mantendo diferenças prévias entre eles, zero, negativos e limites atuais.
- [ ] Usar as duas operações existentes em sequência, verificando sucesso antes de seguir e bloqueando novos cliques durante o envio; não usar chamadas concorrentes nem mudar a API.
- [ ] Falha parcial identifica qual atributo foi confirmado e qual ficou pendente. Recuperação não repete o incremento já confirmado; confirmação incerta preserva a intenção existente em vez de criar um novo incremento às cegas.
- [ ] Não reinterpretar valores como totais calculados: preservar a semântica manual, inclusive números já presentes em fichas e cópias, sem inferir o texto impresso ou o tipo da carta.
- [ ] Preservar permissões por dono/controlador, privacidade, marcadores, movimento, estados e revelação ao fechar; consultas não editáveis não oferecem edição.
- [ ] Reaproveitar os controles numéricos e apresentação compartilhada necessários, mantendo o card independente da entrega de vida.
- [ ] Navegador com servidor real verifica inputs independentes, ambos os botões, valores distintos, recarga, sincronização e permissões. Adicionar cenário de falha parcial/confirmação incerta com falha controlada específica, conferindo o efeito público e ausência de repetição.
- [ ] Revisar prints e interação em celular vertical/horizontal, dispositivo médio e desktop, com teclado/toque, valores legíveis e botões de pelo menos 44 por 44 pixels.
- [ ] Registrar verificações e a limitação explícita de que o par não é atualizado atomicamente.
