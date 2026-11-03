# Leaderboard e troféus da zoeira

Solicitação de 03/11/2026: página baseada no HTML local
`Leaderboard · MTG4FUN.html`, mantendo o padrão das páginas existentes e
responsividade. Base solicitada: último PR para a master, #120, commit
`cedc882`. Ambiente de revisão na porta 8080.

- Pódio, classificação, troféus, hall da vergonha e últimas vitórias.
- Dados reais de vida perdida, tempo total dos turnos passados e outras
  estatísticas recuperáveis dos registros existentes.
- Homenagem fixa a **agiotagem**, “Top 1 mais omisso”, por nunca ter jogado.
- Períodos desde sempre, mês e semana, com carregamento, erro e estado vazio.
- Nenhum resultado fictício apresentado como estatística do banco.
- Verificações na API com MySQL real e no navegador em desktop e celular.

As regras explicitamente aprovadas e a implementação estão na
[decisão](../decisions/leaderboards.md).
