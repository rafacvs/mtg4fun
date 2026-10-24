# Consulta como vista do grimório

Issue: [41](https://github.com/rafacvs/mtg4fun/issues/41), parte da
[spec aprovada](../specs/05-nova-experiencia-da-mesa.md). A autorização de
produto está na [decisão 35](35-nova-experiencia-da-mesa.md); este registro
descreve a implementação desse contrato, sem nova decisão de produto.

## Implementação

O snapshot mantém as cartas na sequência `library`; a janela aberta guarda
somente `consultationIds` e `consultationFrom`. A API mantém `consulted` como
vista privada da janela, para o dono, e acrescenta `consulting` público para
avisar os outros participantes sem transmitir a origem, os nomes ou a ordem.
A contagem inclui a janela. O aviso e o bloqueio de compra continuam quando
a janela é minimizada ou fica vazia após mover suas cartas.

Reordenar altera os lugares ocupados pela janela no próprio monte. Mover
retira a carta da sequência e da janela; topo e fundo podem reposicionar a
seleção dentro do monte. Fechar posiciona o restante no topo ou no fundo, na
ordem exibida; embaralhar e fechar embaralha o monte inteiro. Revelar mantém
a carta no monte e usa a exposição pública existente, sem duplicá-la na vista.

Snapshots anteriores com cartas em `consulted` ou `revealed` são normalizados
na leitura: as cartas voltam à sequência do monte, preservando a ordem da
janela, a origem registrada e a exposição. Snapshots antigos sem origem usam
uma janela de busca, sem afirmar que o trecho veio do topo ou do fundo.
A próxima ação persiste a representação nova. Não há migração de tabelas.

## Verificação

A integração HTTP exercita contagem para dono/oponente, privacidade, bloqueio
de compra, revelação, cinco destinos, ordem no topo/fundo, retomada após
reinício e embaralhamento persistente. O navegador usa API real para verificar
a contagem estável e os fluxos da consulta. Os resultados executados ficam
registrados no PR da integração.

Em 24/10/2026, `go vet ./...`, os testes de `api/internal/...`, typecheck e
build do frontend passaram neste card. Os 15 cenários de
`grimorio.spec.ts` passaram em desktop, celular vertical e horizontal, com
API e MySQL reais. O primeiro teste HTTP da contagem falhou antes da mudança
(consulta de três cartas reduziu o monte de sete para quatro) e passou após
esta implementação.

A suíte HTTP completa terminou com uma falha em
`TestTransferredSelectionPreservesZoneRulesAndRollsBack`, fora deste card:
o teste espera posições 400/520 para duas cartas que estão empilhadas e
recebe 400/400. A mesma falha foi reproduzida isoladamente na base `2f0ab39`.
O comportamento de posicionamento e esse teste não foram alterados aqui.
