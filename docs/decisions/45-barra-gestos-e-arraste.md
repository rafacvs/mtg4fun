# Barra, gestos e arraste

## Autorização

Implementa o card [45](https://github.com/rafacvs/mtg4fun/issues/45) da
[spec aprovada](../specs/05-nova-experiencia-da-mesa.md), conforme a
[decisão 35](35-nova-experiencia-da-mesa.md). A seleção imediata e o mapa de
gestos da spec substituem o atraso de clique descrito no registro histórico
[27](27-duplo-clique-na-selecao.md). Não há mudança de contrato do servidor.

## Implementação

Clique ou toque seleciona imediatamente; Shift e o modo **Selecionar**
permitem compor um conjunto. A seleção por área permanece no mouse. O duplo
clique continua virando o conjunto selecionado no campo, enquanto T e a barra
oferecem o mesmo comando. O mouse mantém a prévia e segurar no toque abre a
inspeção sem alterar o conjunto. O clique sintético da soltura não fecha essa
inspeção; o próximo toque deliberado continua imediato.

A barra muda conforme a zona e o menu completo tem um nível, compartilhado
por **Mais** e clique direito. O menu reutiliza os editores existentes de
modificador, marcadores e controle. Cartas recebidas continuam exigindo a
escolha explícita de uma zona do dono. Mudanças de controlador por polling
invalidam a seleção correspondente.

D/U/N permanecem, T vira, H/G/E movem para mão/cemitério/exílio, + acrescenta
um marcador vermelho (primeira das cinco cores manuais), R abre dado/moeda e
F abre fichas. Ocultar reveladas fica no menu. Atalhos não agem em campos de
texto, diálogos, com modificadores ou durante uma ação pendente.

O arraste apresenta sete destinos nomeados e destaca o alvo com a cor de
 ação. O conjunto pode sair para uma zona junto. A projeção pendente de
movimento/reposicionamento pertence ao cliente; a confirmação da API substitui
essa projeção e uma recusa restaura o estado anterior. O sinal pendente está
na carta e na mesa. Isso não é desfazer persistido nem muda as permissões.

## Validação

TDD na fronteira aprovada de navegador com API real. Os REDs mostraram a
barra ausente, o menu plano ausente, destinos ausentes, modo de seleção por
toque ausente e a carta parada enquanto a resposta era retida. O fluxo real
de toque também encontrou o fechamento indevido da inspeção ao soltar o dedo.

- Cinco fluxos novos passaram: barra/mão/campo/duplo clique; menu/atalhos;
  Shift/arraste coletivo; múltiplos toques/inspeção; pendência/rollback.
- Sete regressões passaram: editores de vida/modificador, permissão, falha
  parcial, confirmação incerta, selo, transferência de controle e seleção por
  área/duplo clique coletivo. Total de 12 cenários desktop, incluindo um
  contexto de toque Chromium real de 1024 × 768.
- No teste de pendência, somente latência e uma entrada inválida são
  controladas na requisição. As respostas de sucesso e de recusa são decididas
  pela API real. O sucesso persistido é confirmado também após recarregar.
- Build, typecheck e `git diff --check` passaram. Nenhum backend foi alterado;
  não foi repetida a suíte Go. A experiência móvel completa pertence ao
  card 48; o contexto de toque acima não equivale aos dois projetos de celular.
