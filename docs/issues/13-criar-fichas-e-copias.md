# 13: Criar fichas e cópias

**What to build:** Jogadores criam fichas do catálogo, fichas personalizadas e cópias independentes para representar efeitos.

**Blocked by:** 04: Consultar cartas com imagens compartilhadas; 06: Comprar e mover cartas entre zonas.

**Status:** ready-for-agent

- [ ] Escolher ficha do catálogo compartilhado com texto/imagem.
- [ ] Ficha personalizada recebe nome, descrição, poder/resistência opcionais e imagem padrão.
- [ ] Copiar carta cria instância independente; documentar atributos copiados sem automatizar regras de Magic.
- [ ] Fichas/cópias recebem identidade, dono/controlador e zona e usam movimentos já disponíveis.
- [ ] Alterar ou mover original não altera automaticamente sua cópia.
- [ ] Persistir criação e atributos com log; recuperar instâncias sem duplicá-las após reinício/reenvio.
- [ ] Interface PT-BR disponível por toque/mouse; testes verificam catálogo, personalização, independência e recuperação.
- [ ] Não adicionar upload de imagens customizadas por usuário como requisito.

## Regras de execução

- Seguir as specs locais de acesso/salas/decks, mesa/interface e servidor/persistência e seu vocabulário; não alterar o escopo para reproduzir a arquitetura do Cockatrice.
- Entregar comportamento completo com armazenamento, contrato público, interface e testes pertinentes; preferir testes de comportamento na API pública e fluxos de navegador para interação.
- Toda nova ação compartilhada deve validar permissão, filtrar informação privada e preservar estado/log após reinício. Não deixar segurança ou persistência para uma etapa posterior.
- Seguir a [política de decisões do AGENTS.md](../../AGENTS.md#requisitos-e-decisões): decisões de grande impacto exigem consulta e aprovação explícita do usuário antes de implementar; documentar a escolha não substitui aprovação.
- Estes tickets compõem uma única primeira versão; entregas intermediárias não são declaração de que o produto completo já está pronto.
