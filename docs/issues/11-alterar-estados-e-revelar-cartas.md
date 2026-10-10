# 11: Alterar estados e revelar cartas

**What to build:** Jogadores viram/desviram, escolhem faces, ocultam ou revelam cartas para representar seus estados na mesa.

**Blocked by:** 06: Comprar e mover cartas entre zonas.

**Status:** ready-for-agent

- [ ] Oferecer virar/desvirar individualmente e desvirar todas as cartas aplicáveis do próprio campo.
- [ ] Selecionar face de carta com múltiplas faces independentemente de colocá-la virada para baixo.
- [ ] Revelação é explícita; definir/documentar seu escopo e duração sem interpretar texto da carta.
- [ ] Cartas ocultas em zona pública não expõem identidade, URLs de imagem, faces ou metadados a observadores não autorizados.
- [ ] Servidor valida permissão e sincroniza apenas a visão permitida, com log filtrado.
- [ ] Persistir estados/revelações necessários à retomada antes de confirmar; interface funciona por toque/mouse.
- [ ] Testes públicos e de navegador distinguem virar/desvirar, frente/verso e face para baixo e verificam privacidade e reinício.

## Regras de execução

- Seguir as specs locais de acesso/salas/decks, mesa/interface e servidor/persistência e seu vocabulário; não alterar o escopo para reproduzir a arquitetura do Cockatrice.
- Entregar comportamento completo com armazenamento, contrato público, interface e testes pertinentes; preferir testes de comportamento na API pública e fluxos de navegador para interação.
- Toda nova ação compartilhada deve validar permissão, filtrar informação privada e preservar estado/log após reinício. Não deixar segurança ou persistência para uma etapa posterior.
- Seguir a [política de decisões do AGENTS.md](../../AGENTS.md#requisitos-e-decisões): decisões de grande impacto exigem consulta e aprovação explícita do usuário antes de implementar; documentar a escolha não substitui aprovação.
- Estes tickets compõem uma única primeira versão; entregas intermediárias não são declaração de que o produto completo já está pronto.
