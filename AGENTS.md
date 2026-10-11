# Trabalho neste repositório

## Requisitos e decisões

- Leia `docs/specs/README.md`, as especificações relevantes e a issue em
  `docs/issues/` antes de implementar. Consulte os registros relacionados em
  `docs/decisions/` e respeite as instruções do usuário na conversa.
- **Toda decisão de grande impacto exige consulta e aprovação explícita do
  usuário antes de implementar. Nunca assuma essa aprovação.** Isso inclui
  escolha ou troca de banco, arquitetura/divisão de serviços, infraestrutura
  de desenvolvimento ou produção, segurança/autenticação, dependências que
  determinem a arquitetura, contratos que afetem compatibilidade e mudanças
  de requisitos ou comportamento do produto.
- Antes de perguntar, investigue o estado existente e apresente as alternativas
  viáveis, a recomendação e os impactos em operação, dados, segurança e escopo,
  conforme pertinente. Aguarde a resposta antes de implementar a escolha;
  continue apenas o trabalho independente dela.
- Silêncio, ausência de requisito, “a definir na implementação”, “escolher e
  documentar”, preferência por simplicidade ou presença de código existente
  **não são aprovação**. Registrar uma escolha depois de implementá-la não
  substitui consultar o usuário antes. Na dúvida sobre o impacto, consulte.
- Aprovações explícitas na conversa continuam válidas dentro do escopo aprovado;
  não peça confirmação novamente sem mudança relevante de escopo ou impacto.
- Decisões locais de baixo impacto, como nomes de arquivos e organização de
  código dentro da arquitetura aprovada, podem ser resolvidas autonomamente.
  Não transforme esses ajustes em escolhas de arquitetura ou requisitos.
- Registre decisões relevantes em `docs/decisions/`, distinguindo proposta,
  aprovação explícita (com contexto da autorização) e implementação existente.
  Não atribua aprovação ao usuário sem evidência. Testes aprovam comportamentos
  observados, não escolhas de arquitetura.
- SQLite foi rejeitado pelo usuário e deve ser substituído conforme a issue 19.
  Não o adote como decisão aprovada para funcionalidades futuras. O usuário
  aprovou MySQL 26.7.0 e serviços separados de API/frontend, dev com Air/Vite e
  produção com Go compilado/Nginx nas issues 19 e 20. O banco novo começa vazio,
  preservando arquivos e volumes SQLite antigos. Consulte o estado e o contexto
  da autorização em `docs/decisions/19-20-mysql-e-docker.md`; novas decisões de
  grande impacto continuam exigindo aprovação explícita.

## Escopo da documentação

- `README.md` apresenta o projeto, seu estágio, requisitos e operação disponível.
  Não coloque nele instruções de conduta de agentes ou fluxo de commits/PRs.
- `AGENTS.md` centraliza as regras para agentes neste repositório, inclusive
  decisões, organização e fluxo de trabalho.
- `docs/specs/` descreve requisitos; `docs/issues/` descreve entregas e critérios
  de aceite; `docs/decisions/` registra escolhas e seu estado de aprovação.
- Mantenha referências entre documentos em vez de duplicar políticas. Documente
  somente comandos e capacidades existentes como disponíveis; identifique
  propostas e limitações pendentes. Preserve resultados históricos de testes
  como históricos, sem apresentá-los como nova validação ou aprovação do usuário.

## Organização e verificações

- O projeto é privado, para jogar entre amigos. Prefira comandos de operação
  simples e diretos; não imponha leitura oculta de senha ou pipelines para
  criar contas. O usuário autorizou senha por argumento `--password`.

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
- Entregue comportamento completo com segurança e persistência pertinentes.
  Prefira testes observáveis do contrato público e fluxos reais de navegador;
  não deixe essas garantias para uma etapa posterior.
- Ao testar um comportamento, exercite a fronteira que o usuário ou outra
  integração realmente usa. Não considere suficiente uma asserção sobre
  detalhes internos, uma resposta fabricada pelo próprio teste ou uma
  simulação que substitui justamente o componente sob verificação.
  **Tautological tests are considered harmful.** Eles criam confiança falsa,
  ocultam que o contrato público não foi exercitado e não substituem teste de
  unidade, integração ou navegador apropriado.
- Use testes unitários para lógica determinística e decisões locais; use
  integração para HTTP/executável, banco, persistência, permissões e cache; e
  use navegador para interação e renderização. Todo requisito observável deve
  ter ao menos uma dessas fronteiras que poderia falhar se a implementação
  estivesse desconectada do requisito. Consulte [a estratégia de testes](docs/testing.md)
  para escolher a combinação mínima.
- Para uma dependência HTTP externa, o teste com fonte controlada deve verificar
  a forma da requisição de saída relevante (método, URL, cabeçalhos,
  redirecionamentos e limites) e suas respostas de sucesso/falha. Um mock pode
  cobrir uma falha específica da interface, mas não pode ser a única evidência
  de que o fluxo completo funciona. Antes de entregar uma integração nova,
  execute e registre uma verificação manual ou opt-in contra o provedor real;
  ela não entra na suíte determinística nem torna a disponibilidade externa um
  requisito do CI.
- Artefatos gerados ficam dentro do projeto correspondente (`api/bin/`,
  `api/data/`, `app/dist/` e relatórios do frontend), ignorados pelo Git.
- Execute Go a partir de `api/` ou com `go -C api`. Execute Docker pela raiz
  com `docker compose ...`; o `.env` seleciona arquivos e perfil conforme o README.
  Os serviços operacionais são `api`, `app` e `mysql`; `api` inicia o banco local
  como dependência quando o perfil `local-db` está habilitado.
  O projeto padrão é `mtg4fun`; use `-p <projeto>` para ambientes isolados e
  preserve o nome ao reiniciar para reutilizar o volume persistente.
- Execute as verificações pertinentes ao que mudou e descreva o que foi efetivamente
  verificado. Para alterações somente documentais, confira links, comandos e
  consistência; não declare testes da aplicação que não foram executados.

## Branch, commits e PR

- Toda tarefa deve ter uma branch própria, mesmo sem trabalho paralelo. Use a
  branch atribuída pelo usuário; se não houver, crie uma antes de editar.
  **Jamais faça commits na `master`.** Escolha a base conforme a tarefa:
  use a branch atual quando a correção depender de sua implementação; para
  tarefa independente, use `master`.
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
- Não exclua a branch da tarefa enquanto o PR aguarda revisão.

## Worktrees e ambientes independentes

- Para tarefas paralelas, use uma worktree por tarefa. `scripts/worktree.sh`
  cria branches `work/<nome>`, checkouts em `../mtg4fun-worktrees/<nome>` e
  um banco novo no MySQL local já em execução. O servidor principal deve estar
  no ar:

  ```bash
  ./scripts/worktree.sh create <nome> master
  ./scripts/worktree.sh list
  ./scripts/worktree.sh remove <nome>
  ```

- Sem base explícita, `create` usa o `HEAD` atual. Só arquivos commitados na
  base aparecem no novo checkout. Se o script não existir na base, invoque-o
  pelo caminho do checkout que o contém. Para reabrir uma branch preservada,
  execute `create` com o mesmo nome e sem base; uma branch só pode estar aberta
  em uma worktree por vez.
- Uma worktree temporária pode ser removida depois que suas alterações estiverem
  commitadas e publicadas e o PR estiver aberto, preservando a branch. `remove`
  recusa checkouts com alterações locais ou bloqueados; não use força para
  contornar essa proteção.
- Instale dependências por checkout. Quando houver serviços locais, mantenha
  portas e arquivos de ambiente independentes por worktree. O MySQL é o da
  raiz; cada worktree usa o banco criado por `worktree.sh`. Use o `.env`
  gerado por ele: ele define o projeto Compose, a porta HTTP e o banco.
  Não o substitua pela cópia do `.env` principal. As worktrees existentes
  podem ser preparadas com `scripts/worktree.sh isolate <nome>`.
  Configuração e histórico do Git são compartilhados entre worktrees; dados
  alterados depois da cópia do banco não são sincronizados.
