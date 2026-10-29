# Fluidez da partida e deploy

## Fluidez da mesa

### Problema

A partida não usa SSE. O canal existente só atualiza a lista de salas. Cada gesto da mesa é um POST e, até a resposta voltar, a interface inteira fica bloqueada. Mover e reposicionar antecipam o desenho, mas exibem o aviso “Ação pendente · aguardando confirmação” e marcam a carta como pendente. Virar e virar de lado só mudam depois da resposta. Os outros jogadores recebem o estado por uma consulta completa a cada segundo. No servidor, a transação segura o lock da partida enquanto relê o log inteiro. Ações rápidas ficam com uma pausa visível entre elas.

### Solução

O servidor continua autoridade: snapshot, log e intenção seguem gravados na mesma transação antes de confirmar. O cliente guarda o snapshot confirmado e uma fila das próprias jogadas ainda sem resposta. A mesa desenha o confirmado com essa fila aplicada. Mover, reposicionar, virar e virar de lado entram na fila e aparecem na hora, sem aviso de pendência e sem bloquear a mesa. Os POST seguem em ordem, com o identificador de intenção já existente. A resposta substitui o snapshot confirmado, retira essa intenção e reaplica o restante da fila. Se o servidor recusar, a jogada sai da fila, o restante é reaplicado e o erro aparece.

Os demais jogadores recebem a visão filtrada por SSE depois do commit. A API, em um único processo, avisa as conexões da sala; cada uma envia só o que aquele jogador pode ver. Ao conectar, vai o snapshot atual. Um número de revisão impede que um evento atrasado substitua uma resposta mais nova. O lobby permanece no SSE atual. A leitura do log sai de dentro do lock; a gravação do snapshot, do evento e da intenção permanece na mesma transação.

## Build e deploy

### Problema

A imagem de produção é compilada na VM da OCI, com 1 GB de RAM e sem swap. `docker compose build` compila o Go e o frontend nessa máquina, e o sistema trava.

### Solução

O GitHub Actions, no plano Free, compila. Pull request roda os testes e não publica imagem. Push na `master` constrói as imagens `linux/amd64`, publica no GHCR com a tag do commit e entra por SSH na VM. Lá o deploy faz `docker compose pull`, `migrate up` com a imagem nova e `up -d`. Se a migration falhar, os containers antigos continuam. O `.env` fica só na VM. O Compose de produção passa a usar a imagem publicada em vez de construir no host. O limite de gastos da conta fica em US$ 0, para o workflow parar ao estourar a cota gratuita em vez de cobrar.
