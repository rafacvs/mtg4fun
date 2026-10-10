# 19: Substituir SQLite por um banco aprovado

**What to build:** Corrigir a escolha de persistência da primeira entrega, substituindo SQLite por um banco definido e aprovado explicitamente pelo usuário.

**Blocked by:** Nenhum; aprovação explícita registrada.

**Status:** in-progress

## Contexto e aprovação

A proposta e a autorização do usuário estão no
[registro MySQL/Docker](../decisions/19-20-mysql-e-docker.md).
MySQL 26.7.0 substitui SQLite; contas são recriadas em banco vazio,
preservando arquivos e volumes antigos. API e frontend ficam separados:
Air/Vite no desenvolvimento, Go compilado/Nginx em produção. Configuração
por ambiente prepara uma conexão externa futura, sem acessar produção.
A implementação e suas verificações estão em andamento.

## Critérios de aceite

- [ ] Registrar a proposta, a aprovação explícita do usuário e a solução implementada em `docs/decisions/`.
- [ ] Remover a dependência de SQLite do backend e adequar configuração, esquema e acesso ao banco aprovado, incluindo o comando de criação de contas.
- [ ] Configurar o banco no ambiente Docker conforme a arquitetura aprovada, sem exigir sua instalação manual no host.
- [ ] Preservar autenticação, hash de senhas, revogação de sessões e rejeição de contas duplicadas; documentar mudanças de contrato se aprovadas.
- [ ] Executar o tratamento aprovado dos dados existentes; não excluir nem recriar dados sem autorização explícita.
- [ ] Contas e sessões válidas permanecem utilizáveis após recriação dos serviços com o armazenamento persistente.
- [ ] Testes do executável/API usam o banco real escolhido e cobrem criação, duplicatas, login, logout, falhas de persistência e reinício; os fluxos de navegador permanecem funcionais.
- [ ] Verificação Docker usa projeto, porta e dados isolados e confirma durabilidade; atualizar a documentação operacional e o registro de acesso junto da implementação.

## Regras de execução

Seguir as specs de acesso e persistência e a
[política de decisões do AGENTS.md](../../AGENTS.md#requisitos-e-decisões).
Coordenar com a [issue 20](20-docker-dev-e-producao.md) os arquivos de infraestrutura.
Este ticket corrige a entrega 01 e não inclui implementar salas ou partidas.
