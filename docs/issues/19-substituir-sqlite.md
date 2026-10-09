# 19: Substituir SQLite por um banco aprovado

**What to build:** Corrigir a escolha de persistência da primeira entrega, substituindo SQLite por um banco definido e aprovado explicitamente pelo usuário.

**Blocked by:** Aprovação explícita do banco substituto e do tratamento dos dados existentes.

**Status:** needs-user-decision

## Contexto e decisões pendentes

A issue 01 foi implementada com SQLite sem consulta prévia. O usuário rejeitou
essa escolha como inviável para o projeto. Não há banco substituto aprovado;
este ticket não autoriza o agente a escolher um por conta própria.

Antes de implementar, analisar alternativas à luz das specs de persistência,
operação Docker e evolução de salas/partidas. Apresentar os impactos e obter
aprovação do banco, das dependências relevantes e do tratamento dos dados
existentes. Confirmar se há contas/sessões a preservar e definir migração ou
recriação com o usuário; não presumir descarte nem compatibilidade automática.

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
