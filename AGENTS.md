# Trabalho neste repositório

- Leia `docs/specs/README.md` e as especificações relevantes antes de implementar
  uma issue em `docs/issues/`.
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
