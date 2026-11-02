# Destino por carta ao olhar o topo e ícone do site

## Autorização

Na conversa de 02/11/2026, o usuário pediu controles Topo/Fundo por carta
somente no popup de **Olhar cartas do topo**, preservando a usabilidade e o
visual existentes. Após testar localmente, disse que gostou do resultado.
Também forneceu a imagem do ícone, aprovou sua inclusão e pediu o recorte
totalmente circular. Autorizou abrir um PR para a master, verificando a
compatibilidade com os PRs #113 (playmats) e #114 (queda de braço).

O escopo complementa a [interface do grimório](10-interface-do-grimorio.md)
e o [quadro fixo](grimorio-menu-fixo.md). Não autoriza alterações nos demais
fluxos de consulta nem nos contratos da API.

## Implementação

Cada carta da consulta privada do topo recebe botões Topo/Fundo e o rodapé
mostra o resumo dos destinos. O seletor existente define o padrão para cartas
sem escolha individual. Seleção, inspeção e reordenação continuam disponíveis;
a ordem exibida é preservada dentro de cada destino.

As escolhas individuais são locais ao popup, mantidas ao minimizar e retomar,
mas não após recarregar a página. Fechar sem embaralhar usa as operações
existentes: primeiro move o bloco com destino diferente do padrão, depois
fecha a consulta com o restante no destino padrão. Se uma operação falhar,
o popup permanece aberto; operações confirmadas já estão persistidas.
Embaralhar e fechar usa diretamente o embaralhamento existente.

Busca, consulta do fundo e resultado de Revelar não recebem os novos botões.
O favicon usa a imagem fornecida, incorporada em SVG com recorte circular e
transparência externa; não depende de um serviço de imagens.

## Ambiente e publicação

A branch local de teste mantém a base com playmats e queda de braço, compatível
com o banco local na versão 3 e a porta 8080. Inicialmente, usar a master como
base nesse checkout interrompeu a API porque ela esperava a versão 2; a base
foi corrigida sem rebaixar ou apagar o banco.

Ao preparar a publicação, o usuário pediu explicitamente levar todas as
atualizações desta branch no mesmo PR para a master, incluindo playmats e
queda de braço. O PR portanto inclui os commits dos PRs #113 e #114, além
deste ajuste, preservando ambos os PRs abertos. Resultados das verificações
efetivamente executadas ficam na descrição do PR.
