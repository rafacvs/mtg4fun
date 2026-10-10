# 02: Importar e reutilizar decks .cod

**What to build:** Cada usuário envia, guarda, escolhe e exclui decks .cod, resolvidos contra um catálogo único no servidor.

**Blocked by:** 01: Criar contas e acessar a aplicação.

**Status:** implementado; aguardando revisão do PR

- [x] Servidor carrega catálogo de cartas e fichas seguindo os formatos e fontes funcionais do Cockatrice; nenhum usuário precisa configurar um dataset no navegador.
- [x] Upload de .cod reproduz nomes, quantidades e seção principal com fixtures representativas do Cockatrice; arquivos inválidos retornam erro compreensível.
- [x] Seções não utilizadas não criam reserva/sideboard; documentar o tratamento escolhido sem adicionar edição de deck.
- [x] Deck fica vinculado ao usuário no banco até exclusão e pode ser reutilizado sem novo upload.
- [x] Listagem, upload e exclusão funcionam em desktop e celular em PT-BR; somente o titular modifica seus decks.
- [x] Upload não permite alterar o catálogo global ou recursos de outros usuários.
- [x] Decks e catálogo permanecem disponíveis após reinício; atualização do catálogo não obriga reupload dos decks.
- [x] Testes públicos verificam importação, isolamento entre contas, exclusão e reutilização com catálogo controlado.

## Regras de execução

- Seguir as specs locais de acesso/salas/decks, mesa/interface e servidor/persistência e seu vocabulário; não alterar o escopo para reproduzir a arquitetura do Cockatrice.
- Entregar comportamento completo com armazenamento, contrato público, interface e testes pertinentes; preferir testes de comportamento na API pública e fluxos de navegador para interação.
- Toda nova ação compartilhada deve validar permissão, filtrar informação privada e preservar estado/log após reinício. Não deixar segurança ou persistência para uma etapa posterior.
- Seguir a [política de decisões do AGENTS.md](../../AGENTS.md#requisitos-e-decisões): decisões de grande impacto exigem consulta e aprovação explícita do usuário antes de implementar; documentar a escolha não substitui aprovação.
- Estes tickets compõem uma única primeira versão; entregas intermediárias não são declaração de que o produto completo já está pronto.

Implementação e contexto de aprovação: [decks e catálogo](../decisions/02-decks-e-catalogo.md).
