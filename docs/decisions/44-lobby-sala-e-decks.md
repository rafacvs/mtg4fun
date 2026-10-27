# Apresentação do lobby, preparação e decks

Issue: [44](https://github.com/rafacvs/mtg4fun/issues/44), parte da
[spec 39](../specs/05-nova-experiencia-da-mesa.md). A autorização de produto
está na [decisão 35](35-nova-experiencia-da-mesa.md); este registro descreve a
implementação, sem aprovar requisitos novos.

## Implementação

O lobby agrupa primeiro as mesas do usuário, depois as demais em preparação
e por último as demais em jogo. Partidas iniciadas mostram participantes,
sem vagas nem entrada para quem não participa. A preparação mostra quem falta
confirmar e só habilita iniciar quando todos estão prontos.

O painel de criação apresenta nome, formato, lugares, vida e deck como
exemplos locais, identificados nos rótulos e na explicação do painel. Não
envia esses campos: conserva `POST /api/rooms` com `{}`, nome automático,
capacidade atual e criador sentado sem prontidão automática. A vida inicial
continua vindo da configuração existente e o deck continua sendo confirmado
na preparação. Não há compra inicial nem comandante automático. Esse “não
salvar” vale para a entrega visual da issue 44; o contrato novo está na
[spec 06](../specs/06-preparacao-inicio-e-reinicio.md).

Na biblioteca, nome, quantidade, disponibilidade no catálogo, lista e prévia
continuam usando a API real. Comandante, cores, curva e tipos ficam numa
superfície explicitamente ilustrativa; não são calculados nem salvos.
Excluir exige confirmação, com cancelamento e explicação de que a partida já
iniciada não muda. Falha da exclusão mantém o diálogo e o erro disponíveis.

## Evidências de TDD e validação

Os testes novos usam navegador com API e MySQL reais, sem substituir as rotas
de criação, preparação, decks ou partidas. Antes da implementação, falharam
pela ausência do painel de criação, pela mesa própria aparecer depois de uma
aberta e pela ausência dos exemplos identificados da biblioteca.

Os três fluxos novos passaram no desktop. A rodada ampliada passou os fluxos
novos, importação, exclusão, consulta de cartas e navegação nas três
orientações. Ela também encontrou um seletor antigo de salas que pressupunha
a sala criada no fim da lista; o teste passou a identificar o título novo,
independentemente da ordenação. Após incorporar a integração até `fab59b4`, os nove cenários novos e as três
variantes desse cenário de salas passaram: **12/12**, usando
`npm test --prefix app -- lobby-redesign.spec.ts salas.spec.ts --grep
'monta uma mesa|prioriza|decks usam|preserva deck' --workers=1` com diretório
temporário isolado. A criação também confirma no navegador a habilitação de
iniciar após prontidão e na API a vida padrão 40, apesar do exemplo 20.

Build do frontend (incluindo typecheck) e `git diff --check` passaram.
Capturas de criação e biblioteca foram conferidas no desktop e no celular.
Não houve alteração de backend, infraestrutura ou integração externa.
