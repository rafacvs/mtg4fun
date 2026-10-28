# Leitura e responsividade do trilho desktop

## Contexto

Esta entrega refina a apresentação da mesa no computador após a revisão visual
de uma partida Commander com quatro participantes. O escopo permanece dentro
da composição aprovada da mesa: quatro campos de mesma área, mão e comandos
sempre disponíveis e trilho de zonas integrado a cada campo.

O usuário aprovou nesta conversa aumentar a legibilidade do trilho e substituir
o símbolo da ação **Comprar** pelo desenho de dois cards sobrepostos com um
carrinho. Não há mudança de regra de jogo, contrato HTTP, persistência,
autenticação, infraestrutura ou dependência.

Durante a revisão também apareceu uma área cinza à direita e abaixo da mesa. A
causa não estava no layout da aplicação: a janela Chromium usada para a
simulação havia sido criada com viewport virtual fixo de `1440×900`, dentro de
uma janela maior do macOS. A simulação foi reaberta sem emulação e passou a
receber a área útil real do monitor (`1800×1043`). Por isso esta entrega não
adiciona larguras baseadas na resolução física do Mac; o navegador continua
fornecendo o viewport CSS, que é a fronteira correta para responsividade web.

## Mudanças visuais

### Trilho lateral dos jogadores

- A faixa lateral cresce de 53/55 px para 61 px no desktop.
- O fundo que separa identidade, vida e zonas cresce de 65 px para 73 px.
- O campo de batalha e as cartas reveladas deslocam-se oito pixels para manter
  separação consistente em relação ao trilho ampliado.
- O escudo de posição passa de 24×28 px para 26×30 px e recebe fonte de 11 px.
- A vida cresce de 22 px para 24 px no layout desktop final.
- Ícones de zonas passam para 22 px, contagens para 13 px e o ícone vazio do
  comando para 26 px.
- A contagem da mão usa ícone de 20 px e texto de 13 px.
- O comandante pode chegar a 64 px; as demais células chegam a 38 px quando a
  altura disponível comporta esses valores.

Os limites continuam usando `clamp()` e unidades relativas ao contêiner
(`cqh`). Assim, campos baixos reduzem as células antes de provocar corte, e
campos altos respeitam os máximos de leitura. O cálculo é local a cada campo,
portanto abrir a crônica ou redimensionar a janela recalcula o trilho sem
persistir posições nem alterar o estado da partida.

### Marcadores de jogador

Quando existem marcadores coloridos, o painel deixa de disputar a região da
vida e é posicionado abaixo da última zona do trilho. A posição usa a altura do
próprio campo e possui limite superior para manter o agrupamento perto das
zonas em campos altos. As células do trilho recebem uma variante mais compacta
somente nesse estado, preservando todas as zonas sem rolagem ou sobreposição.

Os pontos de marcador passam a 17×17 px, são centralizados dentro de um painel
com fundo e borda próprios e continuam abrindo o mesmo diálogo público do
jogador. Permissões e edição de vida/marcadores não mudam.

### Ícone da ação Comprar

O antigo símbolo de seta para baixo foi substituído pelo arquivo PNG fornecido
explicitamente pelo usuário. A imagem representa:

- dois cards sobrepostos;
- um destaque circular em primeiro plano;
- um carrinho dentro do círculo.

A imagem correta não possui moldura externa: mostra somente os dois cards e o
carrinho sobre o fundo escuro. A borda continua sendo fornecida pelo próprio
botão. O asset mantém a proporção original com `object-fit: contain`, ocupa
36×36 px no botão desktop de 42×42 px e usa 30×30 px nos demais contextos. O
texto alternativo é vazio porque o botão já possui o rótulo acessível
**Comprar**. A ação, o atalho `D` e o comportamento de compra continuam
inalterados.

## Responsividade

A tela da partida permanece presa ao viewport do navegador por `position:
fixed` e `inset: 0`. No desktop, a grade usa frações flexíveis e a crônica ocupa
sua coluna de referência. O trilho de cada jogador responde à altura do campo,
não à resolução física ou ao fator de escala do sistema operacional.

Para testes manuais ou automação visual, o navegador deve ser aberto sem
viewport emulado quando o objetivo for validar adaptação à janela real. Um
viewport fixo continua válido para capturas reproduzíveis, mas intencionalmente
não acompanha o redimensionamento da janela que o contém.

## Verificações

- `npm run build --prefix app`: passou, incluindo TypeScript e build Vite.
- Verificação manual com API real e MySQL local: sala Commander com quatro
  participantes e cópias do deck **Bate na massa** aberta no Chromium.
- Verificação operacional sem emulação: viewport reportado pelo navegador em
  `1800×1043` para área útil de monitor com 1800 px de largura.
- `git diff --check`: deve ser executado antes do commit.
- `desktop-table.spec.ts` exige trilho com pelo menos 60 px e ícones de zona com
  pelo menos 22 px no cenário real de quatro jogadores.
- `contadores.spec.ts` verifica que o painel de marcadores fica abaixo do
  exílio no desktop.

A tentativa de executar `desktop-table.spec.ts` nesta sessão não iniciou os
cenários porque o executável `go` não estava disponível no `PATH`
(`spawnSync go ENOENT`). Essa limitação deve ser declarada no PR; não é uma
falha observada da implementação.

## Arquivos alterados

- `app/src/features/rooms/desktop-table.css`: dimensões responsivas do trilho,
  vida, zonas, comandante e marcadores.
- `app/src/assets/theme/draw-cards.png`: imagem fornecida para a ação de compra.
- `app/src/features/rooms/TableQuickActions.tsx`: uso direto da imagem no botão.
- `app/src/features/rooms/match.css`: encaixe compartilhado do novo asset.
- `app/tests/e2e/desktop-table.spec.ts`: mínimos observáveis de largura e ícone.
- `app/tests/e2e/contadores.spec.ts`: regressão de posição dos marcadores.
- `docs/issues/desktop-responsive-rail/README.md`: contexto, escopo, impactos e
  evidências desta entrega.

## Fora do escopo

- alterar o número, ordem ou área relativa dos quatro campos;
- mudar regras de compra, turno, zonas ou marcadores;
- detectar resolução física, modelo do monitor ou plataforma do usuário;
- persistir dimensões ou preferências de layout no servidor;
- modificar a experiência mobile além do redimensionamento normal dos
  componentes compartilhados.
