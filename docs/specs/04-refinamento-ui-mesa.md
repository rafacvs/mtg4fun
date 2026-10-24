# Refinamento premium da interface da mesa

**Estado:** a direção visual e o celular vertical plenamente jogável foram
substituídos pela [nova experiência](05-nova-experiencia-da-mesa.md). A edição
direta de vida e do modificador de poder/resistência continua valendo dentro
dessa superfície. Os cards locais do refactor registram a implementação
anterior. Não revalidam a experiência nova.

Esta especificação complementa a [mesa manual](02-mesa-e-interface.md), sem
substituir suas regras de jogo, permissões ou privacidade. A autorização e o
limite da atualização conjunta de P/R estão na
[decisão 29](../decisions/29-refinamento-ui-mesa.md). Onde esta spec pede
paleta original, zoom intocado ou celular vertical jogável, vale a nova
experiência.

## Problema

A mesa já foi reformulada, mas vida e ajustes de poder/resistência ainda exigem
navegação desnecessária. A vida fica distante do nome do jogador; menus e
controles precisam de acabamento mais consistente. Proporções, rolagens e
espaço vazio prejudicam a apresentação em celulares, dispositivos médios e
desktop. O jogador quer uma mesa bonita e premium, condizente com Magic, sem
perder clareza ou mudar a maneira de jogar.

## Solução

Agrupar nome e vida, permitir editar vida e P/R diretamente em seus painéis e
refinar composição, superfícies e controles da mesa com abordagem mobile-first.
Preservar a paleta original da master, com elementos temáticos suaves e foco
nas cartas. As únicas simplificações de fluxo são retirar a etapa de edição
de vida e a etapa de ajustes de P/R; marcadores e demais acessos permanecem.

## Histórias de usuário

1. Como jogador, quero ver vida ao lado do nome no cabeçalho do campo, para identificar rapidamente a quem pertence o total.
2. Como jogador, quero editar minha vida ao abrir meu menu, para não navegar para outra etapa.
3. Como jogador, quero digitar diretamente o total de vida, para fazer correções de qualquer tamanho.
4. Como jogador, quero diminuir ou aumentar minha vida em um ponto com botões, para registrar alterações pequenas rapidamente.
5. Como jogador, quero confirmar uma digitação por Enter ou ao sair do campo, para não publicar valores intermediários.
6. Como jogador, quero acessar marcadores separadamente, para manter compacto o menu inicial.
7. Como jogador, quero consultar a vida e os marcadores públicos dos oponentes sem poder editá-los, para acompanhar a partida com segurança.
8. Como jogador, quero encontrar poder e resistência editáveis ao abrir o detalhe da carta, para não acessar um submenu de ajustes.
9. Como jogador, quero editar poder e resistência independentemente, para registrar valores diferentes.
10. Como jogador, quero um controle no formato menos, poder, barra, resistência e mais, para reconhecer o par de valores.
11. Como jogador, quero que os botões desse controle alterem ambos os valores em um, para aplicar ajustes conjuntos rapidamente.
12. Como jogador, quero saber quando uma atualização conjunta ficou parcial, para corrigir o estado com informação clara.
13. Como jogador, quero evitar que uma tentativa de recuperação repita um incremento já confirmado, para não corromper meus valores.
14. Como jogador, quero continuar usando os valores manuais existentes, para não reinterpretar cartas, fichas ou cópias já em jogo.
15. Como jogador, quero que apenas quem tem permissão edite a carta, para preservar dono, controlador e informações privadas.
16. Como jogador no celular vertical, quero manter campo, mão e ações utilizáveis, para jogar sem girar o aparelho.
17. Como jogador no celular horizontal, quero menus e controles acessíveis mesmo com pouca altura, para não perder comandos.
18. Como jogador em um dispositivo médio, quero uma composição adequada ao espaço disponível, para não receber apenas um desktop comprimido.
19. Como jogador no desktop, quero proporções equilibradas entre campo, mão, prévia e registro, para aproveitar a tela.
20. Como jogador, quero consultar até seis participantes e focar qualquer campo sem perder minha mão, para acompanhar toda a mesa.
21. Como jogador, quero menus com cabeçalhos, controles e espaçamentos consistentes, para aprender um padrão único de interação.
22. Como jogador, quero uma mesa com estética de Magic e detalhes discretos, para ter uma experiência cuidada sem distrações.
23. Como jogador, quero preservar a paleta original e as cores funcionais, para reconhecer os estados e a identidade visual do projeto.
24. Como jogador que usa teclado ou toque, quero foco visível, nomes acessíveis e alvos confortáveis, para operar os mesmos comandos.
25. Como jogador, quero que mudanças de tamanho e orientação preservem o estado e as posições das cartas, para não interromper a partida.
26. Como jogador, quero que a leitura do registro e as regras de revelação permaneçam iguais, para confiar no refinamento visual.

## Decisões de implementação

- Escopo restrito à mesa e seus painéis. Não alterar lobby, decks, login ou preparação.
- Vida fica à esquerda, junto ao nome no cabeçalho do campo; abrir o menu do jogador continua separado de focar o campo.
- Menu próprio apresenta uma única linha compacta de vida: menos, input do total e mais. Remover o bloco redundante de leitura e o botão que levava à etapa Vida.
- Marcadores continuam em acesso separado. Oponentes permanecem somente para leitura.
- Detalhe da carta apresenta imediatamente dois inputs independentes no formato `[−] [Poder] / [Resistência] [+]`, com nomes acessíveis claros e sem o submenu Ajustes.
- Cada input confirma seu inteiro por Enter ou perda de foco. Os botões aplicam imediatamente; não enviar uma alteração por tecla nem duplicar o envio de Enter seguido de perda de foco. Entradas intermediárias vazias ou inválidas não são enviadas. Preservar zero, negativos e os limites atuais.
- Os botões centrais diminuem ou aumentam poder e resistência em um. A API existente recebe um atributo por ação: enviar em sequência, conferindo sucesso antes de seguir e bloqueando novos cliques enquanto a operação estiver em andamento.
- A atualização conjunta não é atômica. Uma falha parcial deve identificar o atributo confirmado e o pendente; não repetir automaticamente a etapa já confirmada. Preservar o mecanismo existente de recuperação de intenção sem confirmação.
- Preservar a semântica e os valores manuais existentes, inclusive em fichas e cópias. Não inferir valores impressos, tipos de carta ou efeitos de regras. A ausência de um valor continua seguindo a interpretação atual de zero.
- Reutilizar os controles numéricos, painéis, cabeçalhos, itens de comando e ícones existentes, extraindo apenas o compartilhamento necessário. Refatorações preparatórias ficam dentro dos cards que as utilizam, com comportamento verificável.
- Preservar os tokens da paleta original, o dourado seletivo e as cores funcionais. Elementos arcanos, texturas e profundidade devem ser suaves e secundários às cartas e informações.
- Padronizar hierarquia tipográfica, espaçamentos, raios, bordas e estados de foco, hover, desabilitado, envio e erro dentro da mesa, sem impor um redesign global.
- Reequilibrar visualmente campo, zonas laterais, mão, ações rápidas, prévia e registro, reduzindo espaço desperdiçado e rolagens desnecessárias. Não alterar coordenadas, fileiras, zoom ou posicionamento persistido para obter essa redução.
- Manter os modos existentes de visão geral e campo em foco, a própria mão ao observar oponente e os menus adaptados ao viewport. Não eliminar rolagens necessárias para alcançar cartas e controles.
- Não adicionar dependências, modificar contratos, backend, banco, autenticação, infraestrutura ou transporte.

## Decisões de teste

- Fronteira principal aprovada: fluxos de navegador com API Go real e MySQL descartável, usando a estrutura existente de testes da mesa. Não usar o banco ou contas pessoais para semear cenários.
- Cada card inclui sua própria verificação observável; a padronização final não substitui testes dos editores entregues antes.
- Reaproveitar os cenários existentes de contadores, interface da mesa, grimório, estados de cartas, posicionamento e transferência de controle. Testar o efeito público, não apenas chamadas internas ou classes CSS.
- Vida: abertura sem etapa extra, posição junto ao nome, edição por Enter/perda de foco, botões, ausência de envios intermediários/duplicados, sincronização, persistência após recarga e consulta de oponente sem edição.
- P/R: inputs imediatos e independentes, incremento/decremento conjunto, bloqueio durante envio, persistência, permissões e valores de fichas/cópias preservados.
- Para falha parcial e confirmação incerta, controlar a falha específica da requisição sem substituir o fluxo de sucesso real. Conferir estado público e registro para detectar repetição de incremento confirmado; não fabricar o sucesso que o teste pretende provar.
- Validar larguras de 320, 390, 768, 1024, 1280 e 1920 pixels, com alturas representativas e ao menos um cenário de celular horizontal de pouca altura. Mudança de orientação não perde estado nem acesso às ações.
- Exercitar toque em dispositivos móveis e teclado/mouse no desktop; conferir foco, nomes acessíveis, leitura dos valores, ausência de cortes e alvos de ação de pelo menos 44 por 44 pixels.
- Conferir ausência de rolagem horizontal da página, aceitando rolagens internas necessárias; abrir painéis junto às bordas, alcançar zonas, navegar por mão cheia e observar até seis jogadores.
- Produzir e revisar prints da mesa, jogador, carta, grimório, ações e visão geral nas categorias de tela; registrar ajustes encontrados, limitações e evidências. Prints isolados não provam jogabilidade.
- Executar build, TypeScript e regressões pertinentes na implementação. Esta entrega de especificação/cards não executa nem declara nova validação da aplicação.

## Fora do escopo

- Novas funcionalidades de jogo ou mudanças de fluxos além dos editores explicitamente aprovados.
- Cálculo automático de P/R, motor de regras, novos tipos de marcador ou restrição de P/R por tipo de carta.
- Atualização atômica do par P/R, ações batch, transações novas ou alterações de contrato/backend.
- Alterar gestos, seleção múltipla, permissões, visibilidade, revelação ao fechar ou recuperação de intenções existentes.
- Redesenhar telas fora da mesa, trocar a paleta, adicionar fontes/dependências externas ou alterar infraestrutura.
- Publicação remota, push ou execução dos cards nesta entrega documental.

## Notas adicionais

O usuário aprovou a divisão em quatro cards e a estratégia de testes após o
refinamento por perguntas. Todos começam pendentes; a aprovação da descrição
não representa implementação nem testes executados. A issue original da mesa
e os resultados históricos de sua entrega permanecem inalterados.
