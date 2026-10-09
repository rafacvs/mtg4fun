# 04: Consultar cartas com imagens compartilhadas

**What to build:** O usuário consulta cartas de seus decks, com texto e imagens carregadas sob demanda e reutilizadas entre usuários.

**Blocked by:** 02: Importar e reutilizar decks .cod.

**Status:** ready-for-agent

- [ ] Biblioteca permite consultar texto e imagem ampliada de cartas, usando o idioma do dataset.
- [ ] Downloads seguem as fontes funcionais do Cockatrice e usam cache compartilhado no servidor, sem baixar todas as imagens antecipadamente.
- [ ] Requisições de diferentes usuários para recurso já armazenado reutilizam o cache.
- [ ] Falha ou indisponibilidade de imagem tem apresentação compreensível e não impede consulta dos dados da carta.
- [ ] Consulta funciona por mouse e toque, em interface PT-BR.
- [ ] Atualização do catálogo mantém decks existentes utilizáveis; partidas futuras usam dados resolvidos de forma consistente.
- [ ] Testes com fontes controladas verificam consulta, falha de download e reutilização do cache sem depender da rede externa.

## Regras de execução

- Seguir as specs locais de acesso/salas/decks, mesa/interface e servidor/persistência e seu vocabulário; não alterar o escopo para reproduzir a arquitetura do Cockatrice.
- Entregar comportamento completo com armazenamento, contrato público, interface e testes pertinentes; preferir testes de comportamento na API pública e fluxos de navegador para interação.
- Toda nova ação compartilhada deve validar permissão, filtrar informação privada e preservar estado/log após reinício. Não deixar segurança ou persistência para uma etapa posterior.
- Escolhas de banco, bibliotecas, contratos e estrutura interna devem ser documentadas durante implementação, com poucas camadas e dependências.
- Estes tickets compõem uma única primeira versão; entregas intermediárias não são declaração de que o produto completo já está pronto.
