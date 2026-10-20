# 01: Jogador — vida junto ao nome e edição direta

**What to build:** Ver a vida à esquerda, ao lado do nome no cabeçalho do
campo, e editar a própria vida imediatamente ao abrir o menu do jogador, sem
navegar para outra etapa. O acesso a marcadores permanece separado.

**Blocked by:** Nenhum (pode começar imediatamente).

**Status:** ready-for-agent

Requisitos: [spec do refinamento](../../specs/04-refinamento-ui-mesa.md).
Integra o [refactor local](README.md), sem modificar a issue da entrega anterior.

- [ ] Nome e vida permanecem agrupados à esquerda no cabeçalho, inclusive com nomes longos e telas estreitas; focar o campo continua sendo um acesso separado.
- [ ] Menu próprio mostra uma linha compacta e identificada de vida com menos, input do total e mais; não há botão Vida que leve a outra etapa nem bloco redundante do total.
- [ ] Digitação confirma por Enter ou perda de foco, sem enviar valores intermediários, inválidos ou duplicar uma confirmação; preservar zero, negativos e limites existentes.
- [ ] Menos e mais alteram imediatamente a vida em um; envio e erro têm estados claros e não permitem disparos conflitantes.
- [ ] Marcadores continuam em acesso separado; voltar deles retorna ao menu com vida editável.
- [ ] Oponente permanece somente para leitura e nenhuma permissão ou informação privada muda.
- [ ] Reutilizar o editor numérico existente, extraindo compartilhamento se necessário sem alterar contratos ou outros comportamentos dos contadores.
- [ ] Fluxos de navegador com servidor real comprovam edição, botões, sincronização, persistência após recarga, ausência de envio duplicado e consulta do oponente.
- [ ] Revisar prints e interação em celular vertical/horizontal, dispositivo médio e desktop; manter controles acessíveis por teclado/toque e alvos de pelo menos 44 por 44 pixels.
- [ ] Registrar verificações efetivamente executadas e eventuais limites, sem tratar resultados históricos como validação nova.
