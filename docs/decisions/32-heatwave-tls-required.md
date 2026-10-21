# TLS obrigatório sem validação de certificado no HeatWave

## Proposta e aprovação explícita

No primeiro deploy Oracle, o usuário confirmou conexão da VM com o HeatWave
26.7.0-cloud em rede privada, usando o administrador `mtg4fun` e
`--ssl-mode=REQUIRED`. O teste seguinte com `VERIFY_IDENTITY` e as CAs do
Ubuntu falhou com `certificate verify failed`.

Foram apresentados dois caminhos: configurar CA/hostname/certificado para
preservar a validação completa, ou acrescentar um modo equivalente a
`--ssl-mode=REQUIRED`, com TLS obrigatório e sem validar o certificado.
Foi explicado que o segundo caminho mantém criptografia, mas não autentica
a identidade do servidor. À pergunta de autorização explícita para adicionar
`DB_TLS=required`, o usuário respondeu: “sim, siga pela mais simples e me
passe o que for preciso fazer na vm”.

O usuário também escolheu explicitamente usar o administrador do HeatWave
para este projeto entre amigos, em vez de criar outro usuário. Esse
administrador se chama `mtg4fun`; a escolha não significa que exista um login
MySQL chamado `root` no serviço gerenciado. O usuário decidiu não adicionar
swap por enquanto. Essas escolhas são limitadas ao deploy acompanhado nesta
conversa; não representam um padrão novo para outros projetos.

## Implementação

- `DB_TLS=false`: comportamento existente, sem TLS.
- `DB_TLS=true`: comportamento existente, com validação de certificado e
  hostname; CA própria continua opcional em `DB_TLS_CA`.
- `DB_TLS=required`: exige conexão criptografada sem validar o certificado.
  Usa o modo `skip-verify` do driver MySQL, sem fallback para conexão aberta.
- Valores desconhecidos continuam sendo rejeitados. `DB_TLS_CA` somente é
  aceito com `DB_TLS=true`, evitando ignorar silenciosamente uma CA fornecida.
- `.env.example` e README documentam os modos. O modelo local ignorado
  `.env.oracle` foi atualizado para `required`, sem senha real e sem alterar
  o `.env` do desenvolvimento.

Sem dependências novas, alteração de contratos HTTP, dados ou migrations.
A configuração é passada pelo Compose existente; não exige alterar a Oracle
nem desativar a exigência de TLS do servidor. Esta decisão complementa a
[configuração MySQL/Docker](19-20-mysql-e-docker.md).

## Verificação

- `go -C api test ./internal/database -count=1`: passou; valida o DSN consumido
  pelo driver, TLS habilitado sem fallback e rejeição de valores/CA ambíguos.
- `go -C api test ./tests/integration -run '^TestTLS' -count=1 -v`: passou em
  MySQL 26.7.0 descartável. O modo `true` rejeitou o certificado sem confiança;
  `required` criou e persistiu conta usando um usuário MySQL configurado com
  `REQUIRE SSL`; a tentativa sem TLS para esse usuário foi recusada.
- Compose com `.env.oracle`: configuração válida e somente `api`/`app`
  selecionados. Nenhum acesso ao banco Oracle foi executado pelo agente.

A verificação real contra o HeatWave será feita pelo usuário na VM com a
imagem atualizada e `DB_TLS=required`. O teste anterior de CLI não substitui
essa verificação da API/configuração Go.
