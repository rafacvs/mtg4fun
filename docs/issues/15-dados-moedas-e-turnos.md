# 15: Rolar dados, moedas e administrar turnos

**What to build:** Participantes realizam rolagens manuais e acompanham ou corrigem o turno sem bloquear as ações de jogo.

**Blocked by:** 05: Preparar e iniciar uma partida persistente.

**Status:** ready-for-agent

- [ ] Rolar dados com número de faces escolhido, incluindo D20, e moedas com resultado produzido pelo servidor.
- [ ] Sincronizar resultado e registrar no log; reenvio da intenção não gera outro resultado.
- [ ] Mostrar jogador da vez e ordem circular definida no início.
- [ ] Qualquer participante pode avançar ou corrigir o turno; registrar alterações.
- [ ] Turno não restringe ações; não há fases, compra ou desvirada automáticas.
- [ ] Resultados/turno são persistidos antes de confirmação e mantidos após reinício.
- [ ] Controles PT-BR utilizáveis por toque/mouse; testes verificam permissões, ordem, reenvio e durabilidade.

## Regras de execução

- Seguir as specs locais de acesso/salas/decks, mesa/interface e servidor/persistência e seu vocabulário; não alterar o escopo para reproduzir a arquitetura do Cockatrice.
- Entregar comportamento completo com armazenamento, contrato público, interface e testes pertinentes; preferir testes de comportamento na API pública e fluxos de navegador para interação.
- Toda nova ação compartilhada deve validar permissão, filtrar informação privada e preservar estado/log após reinício. Não deixar segurança ou persistência para uma etapa posterior.
- Escolhas de banco, bibliotecas, contratos e estrutura interna devem ser documentadas durante implementação, com poucas camadas e dependências.
- Estes tickets compõem uma única primeira versão; entregas intermediárias não são declaração de que o produto completo já está pronto.
