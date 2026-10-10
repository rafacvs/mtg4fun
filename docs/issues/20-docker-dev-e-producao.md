# 20: Configurar Docker para desenvolvimento e produção

**What to build:** Oferecer modos Docker de desenvolvimento com hot reload e produção com build, cada um iniciado por um comando Compose a partir da raiz.

**Blocked by:** Aprovação explícita da arquitetura de serviços e alinhamento com a escolha de banco da issue 19.

**Status:** needs-user-decision

## Contexto e decisões pendentes

O Compose atual tem um único serviço `app`, cujo executável Go serve a API e
o React compilado. O Dockerfile já compila ambos dentro da imagem, mas não
há modo dev em containers. O Vite local oferece hot reload fora do Docker;
o backend exige `app/dist/index.html` para iniciar.

O usuário prefere API e frontend em serviços separados, mas a divisão final
não foi aprovada. Antes de implementar, apresentar a proposta dos serviços
por modo, a abordagem de recarga do backend e os comandos de inicialização,
com seus impactos. Obter aprovação explícita das decisões de grande impacto;
não tratar este ticket como autorização para escolher a arquitetura.

## Critérios de aceite

- [ ] Registrar a arquitetura aprovada e distinguir claramente os modos dev e produção.
- [ ] Cada modo inicia todos os serviços necessários com um único comando Compose documentado, sem instalar Go/Node/banco nem executar builds manuais no host.
- [ ] No modo dev, alterações em React/TypeScript aparecem no navegador por hot reload e alterações Go recompilam e reiniciam a API automaticamente; dependências e artefatos permanecem isolados do modo produção.
- [ ] O modo dev não exige um build manual prévio de `app/dist` para iniciar a API.
- [ ] O modo produção compila backend e frontend dentro do Docker e executa os artefatos resultantes, sem depender do Vite dev server ou de código montado do host.
- [ ] Login, recarga de página e logout funcionam em ambos os modos, com encaminhamento de `/api` e cookies compatíveis com a origem usada pelo navegador.
- [ ] Inicialização das dependências, portas e configuração são coerentes com o banco aprovado na issue 19; não fixar SQLite como solução definitiva.
- [ ] Contas e dados persistem ao recriar serviços; projetos, portas, volumes e ambiente podem ser isolados por checkout.
- [ ] Escrever a documentação dos modos implementados, incluindo inicialização, criação de conta por um comando com `--password`, logs, parada, atualização de imagem, persistência e verificações. Não criar um guia separado sem aprovação do usuário.
- [ ] Verificar ambos os modos em ambientes isolados, incluindo hot reload de frontend, recarga do backend e durabilidade; registrar os comandos efetivamente executados.

## Regras de execução

Seguir a [política de decisões do AGENTS.md](../../AGENTS.md#requisitos-e-decisões)
e coordenar com a [issue 19](19-substituir-sqlite.md) as mudanças de infraestrutura.
Não incluir hospedagem externa ou mudanças funcionais de salas/decks/partidas.
