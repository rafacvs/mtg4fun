# Setas de alvo

O usuário solicitou setas de cartas para cartas ou vida de jogadores, visíveis
para todos, sem limite de quantidade. Em conversa, definiu o gesto de arrastar
com o botão direito e que Escape remove as setas individuais de quem o pressiona.
Autorizou a escolha do método de sincronização. A implementação proposta reutiliza
as ações HTTP, o snapshot persistido e a atualização periódica da partida; assim,
setas confirmadas sobrevivem a recargas e reinícios e chegam aos demais junto
das atualizações da partida. Os alvos aceitos são cartas no campo e jogadores
da partida; ao sair do campo, a carta deixa de participar de setas. O usuário
também pediu que as setas fossem curvadas. Detalhes na
[issue local](../issues/setas-de-alvo.md).

O usuário definiu depois que cada seta usa a cor atribuída ao jogador que a
criou, incluindo a prévia durante o arraste.
