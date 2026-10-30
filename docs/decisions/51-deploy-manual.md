# Deploy manual pelo GitHub Actions

## Contexto

A VM de produção na OCI tem 1 GB de RAM e sem swap; `docker compose build`
compila Go e React na própria máquina e a trava. O acesso é por SSH com chave
`.key`; o banco é o HeatWave externo ([decisão 32](32-heatwave-tls-required.md)).

## Pedido do usuário

O usuário pediu, em conversa: “crie, em uma nova branch, um CI/CD MANUAL (sem
merge automatico) para fazer deploy para produção”, “quero algo simples: builda
backend e api, e depois envia o build para produção”, comparando com o deploy
Docker e os arquivos de `infra/`. O pedido define gatilho manual, compilação
fora da VM e envio do resultado. Os detalhes abaixo são a implementação
proposta neste PR e dependem da revisão do usuário.

## Implementação proposta

- `.github/workflows/deploy.yml`, somente `workflow_dispatch`, no environment
  `prod`, um deploy por vez. Sem gatilho em push ou PR e sem merge.
- O runner compila os alvos `api-production` e `frontend-production` do
  `infra/Dockerfile` existente, sem alterar Dockerfile nem Compose.
- Envio direto por SSH (`docker save | gzip | docker load`), sem registro de
  imagens: não exige login na VM nem pacote no GHCR.
- `infra/deploy.sh` roda na VM: confere a arquitetura, marca a imagem como
  `<projeto>-api:latest`, executa `migrate up`, depois marca o frontend e faz
  `docker compose up -d --no-build api app`. Se a migration falhar, restaura a
  tag anterior e mantém os containers em execução. Guarda três versões.
- O Compose usa `<projeto>-<serviço>:latest` para serviços com `build` e não
  precisa do contexto de build com `--no-build`; por isso a VM só precisa do
  `.env` e do `infra/compose.yaml`, enviado a cada deploy.
- Segredos ficam no environment do GitHub; a chave do host é fixada em
  `SSH_KNOWN_HOSTS` (`StrictHostKeyChecking yes`).

Isto substitui, para o deploy, a proposta registrada em
`docs/fluidez-e-cicd.md` (commit 895e512, fora da `master`), que previa GHCR
e deploy a cada push na `master` e não foi implementada.

## Deploy local

A pedido do usuário (“se eu quiser fazer deploy do projeto da minha maquina [...]
segue os mesmos passos, garantindo que o docker em prod funciona como esperado”),
`scripts/deploy.sh` repete os passos do workflow com o Docker local e `.env.deploy`,
compilando o conteúdo do commit. `infra/deploy.sh`, comum aos dois caminhos, passou a
verificar as imagens em execução e as respostas de `/` e `/api/session` pelo Nginx.
Uma falha encerra com erro e logs, sem reversão automática, pois migrations
aplicadas podem impedir a versão anterior de iniciar.

## Verificação

Simulação local: imagens compiladas do checkout, transferidas por
`docker save | gzip | docker load` e ativadas por `infra/deploy.sh` num
diretório contendo só `.env` e `infra/compose.yaml`, com MySQL local.

Depois disso, o workflow concluiu com sucesso contra a VM; o log da execução
40997212784 mostra `mtg4fun-api-1` e `mtg4fun-app-1` recriados e em execução.

`scripts/deploy.sh` foi testado localmente com `ssh` substituído por um executor
local: alteração não commitada não publicada, verificação aprovada, falha detectada
com imagem incorreta e recuperação no deploy seguinte. Nesse teste, a execução pelo
stdin parava depois de `migrate up` com código 0, o que levou a envolver o script em
`main` com stdin em `/dev/null`. O script ainda não foi executado contra a VM real.
