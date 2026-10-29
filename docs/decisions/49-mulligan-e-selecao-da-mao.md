# Mulligan e seleção múltipla da mão

## Aprovação explícita

Em 29/10/2026, o usuário pediu seleção de várias cartas da mão por retângulo
com o mouse e dois tipos de mulligan configuráveis na preparação. Depois da
análise, aprovou que somente o criador escolha o tipo e que o padrão seja a
opção inicial.

## Comportamento aprovado

- **Padrão:** cada mulligan devolve a mão ao grimório, embaralha e compra sete.
  O primeiro é gratuito. Ao manter depois de mulligans adicionais, uma
  superfície central mostra a nova mão; o jogador seleciona somente as cartas
  que vão ao fundo, uma por mulligan além do primeiro.
  O sétimo mulligan deixa uma carta na mão; esse é o limite do modo padrão.
- **Aconchegaz:** todos os mulligans devolvem a mão, embaralham e compram sete,
  sem redução ao manter.
- O botão **Mulligan** fica imediatamente à esquerda de **Comprar** durante o
  primeiro turno; no celular, Mulligan e Manter mão aparecem nos controles
  flutuantes, à esquerda de Comandos. O primeiro avanço de turno fecha a janela definitivamente;
  corrigir o indicador para trás não a reabre.
- A configuração, a janela, o número de mulligans e a decisão de manter são
  persistidos no snapshot. As ações usam o endpoint idempotente existente e
  não revelam o conteúdo da mão no registro público.
- Na mão, arrastar a partir do espaço vazio desenha um retângulo e seleciona
  todas as cartas atingidas, reutilizando a seleção e as ações coletivas locais.
- No painel do mulligan, manter o mouse sobre uma carta mostra sua prévia
  ampliada. No celular, toque curto abre a leitura da carta e pressão longa
  seleciona ou remove a carta destinada ao fundo; mover o dedo cancela a
  pressão para preservar a rolagem. Nomes longos usam reticências sem perder o
  nome completo para acessibilidade.

Não há migration: salas e partidas já persistem esses dados em snapshots JSON,
e snapshots anteriores adotam o modo padrão.
