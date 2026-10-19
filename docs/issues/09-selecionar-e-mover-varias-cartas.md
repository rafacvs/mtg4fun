# 09: Selecionar e mover várias cartas

**What to build:** Jogadores selecionam múltiplas cartas e as movem juntas sem criar agrupamento permanente.

**Blocked by:** 08: Posicionar e sobrepor cartas em fileiras.

**Status:** implementação desktop em revisão na branch `review/issue-09-selecao-e-acoes`; seleção múltipla por toque pendente no estado atual.

- [ ] Desktop seleciona por arraste de área (implementado); celular tem modo explícito de seleção e adiciona/remove cartas por toque (indisponível nesta revisão).
- [x] Estado visual distingue seleção e permite limpar/sair do modo.
- [x] Mover seleção preserva disposição relativa compatível com fileiras e atualiza as cartas como uma ação coletiva consistente.
- [x] Verificar permissão para todas as cartas; falha não deixa movimento parcialmente confirmado.
- [x] Sobreposição anterior não força seleção conjunta e movimento não cria vínculo permanente.
- [x] Posições resultantes sincronizam e são persistidas com log; seleção local não precisa integrar snapshot compartilhado.
- [ ] Testes por mouse/toque verificam seleção, movimento e manipulação individual posterior; teste público verifica atomicidade. Mouse e atomicidade cobertos; seleção por toque pendente.

## Adaptação à mesa atual

As tasks, autorização, compatibilidade e verificações estão no
[registro da adaptação dos PRs 23 e 24](../decisions/26-adaptar-selecao-e-controle.md).
A implementação usa a paleta e os fluxos atuais; a validação dos PRs antigos
permanece histórica.

Na revisão de 19/10/2026, a seleção atual usa apenas retângulo com mouse;
clique no espaço vazio ou Escape limpa a seleção. O duplo clique coletivo e
os ajustes do menu estão descritos na [revisão final](../decisions/27-duplo-clique-na-selecao.md#revisão-para-publicação).
Essa limitação impede considerar todos os critérios desta issue concluídos.

## Regras de execução

- Seguir as specs locais de acesso/salas/decks, mesa/interface e servidor/persistência e seu vocabulário; não alterar o escopo para reproduzir a arquitetura do Cockatrice.
- Entregar comportamento completo com armazenamento, contrato público, interface e testes pertinentes; preferir testes de comportamento na API pública e fluxos de navegador para interação.
- Toda nova ação compartilhada deve validar permissão, filtrar informação privada e preservar estado/log após reinício. Não deixar segurança ou persistência para uma etapa posterior.
- Seguir a [política de decisões do AGENTS.md](../../AGENTS.md#requisitos-e-decisões): decisões de grande impacto exigem consulta e aprovação explícita do usuário antes de implementar; documentar a escolha não substitui aprovação.
- Estes tickets compõem uma única primeira versão; entregas intermediárias não são declaração de que o produto completo já está pronto.
