# Experiência mobile da mesa

## Autorização

Em 20/10/2026, o usuário solicitou uma branch nova, sem worktree, para corrigir
a experiência mobile: recolher mão e ações, navegar pela mão com arraste em
vez de setas, manter a leitura de cartas após toque longo e melhorar os painéis
de prévia, jogadores e registro. Autorizou liberdade artística e técnica no
layout e código para esses objetivos, com prints, conventional commits e PR
aberto para revisão. Essa autorização complementa a
[mesa compacta](31-mesa-compacta.md) e a
[especificação da mesa](../specs/02-mesa-e-interface.md).

## Implementação em andamento

- Controle explícito para recolher/restaurar mão e ações, devolvendo espaço ao
  campo sem desmontar a mão.
- Navegação horizontal nativa por toque. “Organizar” separa a intenção de
  reordenar cartas da intenção de deslizar. A ordem visual é local à mesa
  aberta, sem alterar snapshot, contratos ou registro da partida.
- Toque longo fixa a carta no painel de prévia, que permanece após mover ou
  levantar o dedo. Toque curto continua abrindo os controles da carta.
- Abas mobile permanecem na mesma posição; conteúdo ocupa a largura do campo,
  com rolagem limitada ao painel e rolagem própria do registro.

Sem mudanças de banco, dependências, infraestrutura, autenticação ou regras.

## Validação

Em andamento. Resultados serão registrados após execução e revisão dos prints.
