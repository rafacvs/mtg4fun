# Imagens compartilhadas de cartas

Issue: [04](../issues/04-consultar-cartas-e-imagens.md).

## Proposta e aprovação explícita

O catálogo Cockatrice versionado contém `uuid` nas impressões de cartas e
`picURL` nas fichas. Foram apresentadas duas opções para o cache: arquivos
binários persistentes no diretório da API, com chave estável, escrita atômica e
uma exclusão mútua por imagem; ou BLOBs no MySQL. A recomendação foi a primeira,
pois mantém MySQL para os dados de domínio e evita aumentar banco e backups com
arquivos de imagem. A fonte proposta foi Scryfall, no mesmo fluxo utilizado pelo
Cockatrice.

O usuário aprovou explicitamente a recomendação na conversa desta entrega:
**“aprovo ambas recomendações”**, respondendo às propostas das issues 04 e 05.
Esta aprovação autoriza Scryfall conforme o dataset Cockatrice e o cache binário
persistente da API; não autoriza uma fonte configurável por usuários, download
antecipado de todo o catálogo ou mudança no armazenamento dos dados de domínio.

## Implementação

A API lê o primeiro `picURL` da carta quando presente; caso contrário, transforma
o primeiro `uuid` em URL Scryfall de imagem frontal. `GET /api/cards/image?name=`
exige sessão, baixa a imagem somente na primeira consulta e armazena o binário
por hash SHA-256 da URL. Arquivos temporários recebem nome aleatório e são
renomeados somente após sincronização; consultas simultâneas da mesma imagem são
serializadas. JPEG, PNG, WebP e GIF são aceitos até 20 MiB.

O cache padrão fora do Docker é `data/images` relativo ao diretório de execução
(por exemplo, `api/data/images` com `go -C api`). `--image-cache` e
`IMAGE_CACHE` permitem informar outro diretório.
Nos dois modos Docker há o volume persistente `image-cache`; a entrada de
produção cria o diretório para o usuário não privilegiado antes de iniciar o
executável. Uma falha da fonte retorna mensagem PT-BR e não interfere nos dados
de texto já carregados do catálogo.
