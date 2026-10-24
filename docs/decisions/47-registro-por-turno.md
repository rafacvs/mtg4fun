# Registro por turno

Issue: [47](https://github.com/rafacvs/mtg4fun/issues/47), parte da
[spec 39](../specs/05-nova-experiencia-da-mesa.md).

## Autorização

A apresentação por turno, os filtros e a união de ações consecutivas foram
aprovados na [decisão 35](35-nova-experiencia-da-mesa.md). Esta implementação
não altera o contrato nem a filtragem privada do log no servidor.

## Implementação

`MatchLog` apresenta o log autorizado recebido da API. Cada mudança de turno
registrada inicia um bloco; os blocos e suas ações aparecem do mais recente
para o mais antigo. O bloco atual começa aberto; os anteriores podem ser
expandidos por clique ou teclado. Os números identificam a sequência desses
blocos, sem interpretar fases ou rodadas de Magic.

O filtro inicial **Jogo** exclui reposicionamento, abertura, reordenação e
fechamento de consulta. **Ajustes** mostra essas ações e **Tudo** reúne ambas
as categorias. A filtragem ocorre depois de agrupar eventos consecutivos,
para não unir ações separadas por um ajuste que ficou oculto.

Eventos consecutivos do mesmo jogador, da mesma espécie e com destinos e
resultados compatíveis se juntam em uma linha. Quantidades são somadas;
referências visíveis de cartas são reunidas sem duplicar a mesma instância.
As descrições sem quantidade conservam o resultado e indicam quantas ações
foram reunidas. Mudanças de turno e eventos de encerramento não se juntam.
As referências continuam vindo apenas da visão autorizada atual, de modo que
uma carta que voltou a uma zona privada deixa de oferecer nome e prévia ao
oponente, inclusive dentro de uma linha agrupada.

A rolagem acompanha as novas ações no topo enquanto o jogador está lendo o
início do registro. Ao ler entradas antigas, **Novas ações** permite retornar
ao topo sem tirar o jogador do trecho que estava lendo.

## Validação em 24/10/2026

- RED observado no navegador com API real: filtros ausentes e ausência de
  agrupamento por turno na implementação anterior.
- `npm test --prefix app -- --workers=1 match-log.spec.ts ajustes-mesa.spec.ts
  --grep registro`: nove cenários passaram, nas três orientações. Cobrem o
  filtro inicial, ajustes, reordenação privada, agrupamento de viradas,
  recolhimento dos turnos anteriores e privacidade/prévia após recarga.
- A regressão existente de prévia passou a selecionar a jogada de cemitério
  pela descrição, preservando a garantia de privacidade após a inversão da
  ordem visual do registro.
- `npm run build --prefix app`, TypeScript, links locais e
  `git diff --check`: passaram. Nenhum teste Go foi necessário ou executado
  neste card, que não altera o servidor.
