# Reserva de mana

- Exibir a reserva de cada jogador abaixo do exílio, com contadores e painel
  semelhantes à referência fornecida, visíveis para todos os participantes.
- Ao virar um terreno básico, adicionar automaticamente a mana correspondente;
  nos demais casos, o jogador escolhe manualmente a mana produzida.
- Permitir zerar a própria reserva e desvirar os próprios terrenos.
- Ao avançar o turno, zerar a reserva sem desvirar os terrenos.
- Persistir e sincronizar o estado e verificar os fluxos na API e no navegador.

Status: implementada; validação de navegador com dois participantes e banco
descartável cobre mana automática, ajuste manual, exibição para o outro jogador,
reset com terrenos e limpeza ao passar o turno.
