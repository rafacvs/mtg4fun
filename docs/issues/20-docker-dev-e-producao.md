# 20: Configurar Docker para desenvolvimento e produção

**What to build:** Oferecer modos Docker de desenvolvimento com hot reload e produção com build, cada um iniciado por um comando Compose a partir da raiz.

**Blocked by:** Nenhum; aprovação explícita registrada.

**Status:** completed

## Contexto e aprovação

A proposta e a autorização do usuário estão no
[registro MySQL/Docker](../decisions/19-20-mysql-e-docker.md).
MySQL 26.7.0 substitui SQLite; contas são recriadas em banco vazio,
preservando arquivos e volumes antigos. API e frontend ficam separados:
Air/Vite no desenvolvimento, Go compilado/Nginx em produção. Configuração
por ambiente prepara uma conexão externa futura, sem acessar produção.
A implementação e suas verificações foram concluídas; os resultados estão no registro acima.

## Critérios de aceite

- [x] Registrar a arquitetura aprovada e distinguir claramente os modos dev e produção.
- [x] Cada modo inicia todos os serviços necessários com um único comando Compose documentado, sem instalar Go/Node/banco nem executar builds manuais no host.
- [x] No modo dev, alterações em React/TypeScript aparecem no navegador por hot reload e alterações Go recompilam e reiniciam a API automaticamente; dependências e artefatos permanecem isolados do modo produção.
- [x] O modo dev não exige um build manual prévio de `app/dist` para iniciar a API.
- [x] O modo produção compila backend e frontend dentro do Docker e executa os artefatos resultantes, sem depender do Vite dev server ou de código montado do host.
- [x] Login, recarga de página e logout funcionam em ambos os modos, com encaminhamento de `/api` e cookies compatíveis com a origem usada pelo navegador.
- [x] Inicialização das dependências, portas e configuração são coerentes com o banco aprovado na issue 19; não fixar SQLite como solução definitiva.
- [x] Contas e dados persistem ao recriar serviços; projetos, portas, volumes e ambiente podem ser isolados por checkout.
- [x] Escrever a documentação dos modos implementados, incluindo inicialização, criação de conta por um comando com `--password`, logs, parada, atualização de imagem, persistência e verificações. Não criar um guia separado sem aprovação do usuário.
- [x] Verificar ambos os modos em ambientes isolados, incluindo hot reload de frontend, recarga do backend e durabilidade; registrar os comandos efetivamente executados.

## Regras de execução

Seguir a [política de decisões do AGENTS.md](../../AGENTS.md#requisitos-e-decisões)
e coordenar com a [issue 19](19-substituir-sqlite.md) as mudanças de infraestrutura.
Não incluir hospedagem externa ou mudanças funcionais de salas/decks/partidas.
