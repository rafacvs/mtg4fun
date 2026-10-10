# 08: Posicionar e sobrepor cartas em fileiras

**What to build:** Jogadores arrastam cartas para organizar o campo com liberdade horizontal, alinhamento vertical e sobreposição visual.

**Blocked by:** 06: Comprar e mover cartas entre zonas.

**Status:** ready-for-agent

- [ ] Arraste com mouse/toque posiciona cartas com coordenada horizontal livre e encaixe vertical em fileiras fixas invisíveis.
- [ ] Definir/documentar quantidade e espaçamento das fileiras; preservar significado das posições entre telas de tamanhos diferentes.
- [ ] Permitir extremos do campo e sobreposição, com ordem visual reproduzível para os outros participantes.
- [ ] Sobrepor não cria grupo, anexo ou vínculo permanente; cada carta continua independente.
- [ ] Servidor verifica permissões e persiste posição, fileira e sobreposição com log antes de confirmar.
- [ ] Reconexão/reinício e mudança de viewport preservam organização lógica.
- [ ] Testes de navegador cobrem mouse/toque, alinhamento, sobreposição e independência; testes públicos cobrem durabilidade e permissões.

## Regras de execução

- Seguir as specs locais de acesso/salas/decks, mesa/interface e servidor/persistência e seu vocabulário; não alterar o escopo para reproduzir a arquitetura do Cockatrice.
- Entregar comportamento completo com armazenamento, contrato público, interface e testes pertinentes; preferir testes de comportamento na API pública e fluxos de navegador para interação.
- Toda nova ação compartilhada deve validar permissão, filtrar informação privada e preservar estado/log após reinício. Não deixar segurança ou persistência para uma etapa posterior.
- Seguir a [política de decisões do AGENTS.md](../../AGENTS.md#requisitos-e-decisões): decisões de grande impacto exigem consulta e aprovação explícita do usuário antes de implementar; documentar a escolha não substitui aprovação.
- Estes tickets compõem uma única primeira versão; entregas intermediárias não são declaração de que o produto completo já está pronto.
