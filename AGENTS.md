# Trabalho neste repositório

- Leia `docs/specs/README.md` e as especificações relevantes antes de implementar
  uma issue em `docs/issues/`.
- Mantenha a separação de projetos: `api/` para Go (incluindo `go.mod` e
  `go.sum`), `app/` para React/TypeScript e `infra/` para Docker. Documentação
  fica em `docs/` e ferramentas de desenvolvimento em `scripts/`.
- Organize módulos por funcionalidade, com arquivos nomeados por
  responsabilidade. No backend, mantenha a entrada em `api/cmd/mtg4fun/` e
  os módulos em `api/internal/`. No frontend, funcionalidades ficam em
  `app/src/features/`; apresentação, estado e chamadas HTTP têm arquivos
  distintos. Extraia responsabilidades compartilhadas quando houver uso real.
- Não concentre banco, autenticação, HTTP e apresentação em arquivos genéricos
  como `app.go`. Não crie pastas vazias para funcionalidades futuras ou pastas
  genéricas de utilitários. Preserve nomes claros e formatação legível.
- Testes de integração do executável/HTTP ficam em `api/tests/integration/`,
  testes de navegador em `app/tests/e2e/` e verificação Docker em `infra/tests/`.
  Testes menores, quando necessários, ficam junto do módulo exercitado.
- Artefatos gerados ficam dentro do projeto correspondente (`api/bin/`,
  `api/data/`, `app/dist/` e relatórios do frontend), ignorados pelo Git.
- Execute Go a partir de `api/` ou com `go -C api`. Execute Docker pela raiz
  com `docker compose -f infra/compose.yaml -p <projeto> ...`, preservando o
  nome do projeto ao reiniciar para reutilizar o volume persistente.
- Toda tarefa deve ter uma branch própria, mesmo quando não houver trabalho
  paralelo. Use a branch atribuída pelo usuário; se não houver, crie uma antes
  de editar. **Jamais faça commits na `master`.**
- Para tarefas paralelas, use também uma worktree por tarefa. Os comandos e o
  fluxo de desenvolvimento estão no `README.md` e em `scripts/worktree.sh`.
- Antes de editar e antes de cada commit, confira `pwd`, `git status` e
  `git branch --show-current`. Se estiver na `master`, troque para a branch da
  tarefa antes de prosseguir. Faça alterações e conventional commits somente
  no checkout da tarefa atribuída, incluindo apenas os arquivos dessa tarefa.
- Coordene alterações em arquivos compartilhados entre tarefas. Revise e
  verifique o resultado antes de publicar a branch.
- Ao concluir, envie a branch ao remoto e abra um PR com base na `master`,
  descrevendo a mudança e as verificações realizadas. **Deixe o PR aberto,
  sem merge, para o usuário revisar.** Não faça merge local, merge do PR ou
  habilite auto-merge. A integração é responsabilidade do usuário.
- Não exclua a branch da tarefa enquanto o PR aguarda revisão. Uma worktree
  temporária pode ser removida depois que suas alterações estiverem commitadas
  e publicadas, preservando a branch.
- Quando houver serviços locais, mantenha portas, configuração de ambiente,
  bancos e volumes independentes por worktree.
