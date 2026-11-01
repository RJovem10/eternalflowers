# Notificações administrativas de encomendas pagas

## Causa e implementação

O settlement partilhado por Stripe e pagamentos externos criava apenas `order_confirmed`,
para o cliente. Agora cria também `admin_order_paid` no mesmo outbox e na mesma transação.
O email do cliente mantém conteúdo, destinatário, idioma e chave existentes.

A nova chave é `admin-order-paid:<id>`, distinta de `order-confirmed:<id>`. O lock existente
sobre a encomenda, o retorno `already_processed` e o índice único de `deduplication_key`
impedem duplicação por confirmações repetidas. O snapshot administrativo contém os
contactos, artigos, valores, pagamento, entrega, morada e ligação para o painel.
Os campos não registados são apresentados como tal; não são inferidos.

O processador existente continua a enviar fora da transação, a manter os estados e as
cinco tentativas por defeito, e a transmitir a chave de idempotência ao Resend.
Os dois registos têm estados e tentativas independentes. Uma falha de criação do registo
administrativo aborta a transação de settlement, tal como uma falha do outbox do cliente.
Não foram alterados o processamento Stripe, as reservas, os movimentos de stock ou as
regras de transição de estados.

## Falhas e recuperação dos pagamentos

`enqueueAdminOrderPaid` usa `ctx.req`; o enqueue aninhado reutiliza o transactionID.
Uma exceção de criação propaga até ao proprietário exterior, que faz rollback de
pagamento local, outbox, cupão e stock da mesma transação. O pagamento já executado
no Stripe não é revertido por este rollback. No webhook, uma falha normal de DB/config
propaga como HTTP 500; não é convertida num sucesso nem num reembolso por falta de stock.
Uma nova entrega pode concluir o settlement após a causa ser corrigida.
`runInTransactionWithRetry` apenas repete SQLITE_BUSY; não repete arbitrariamente
falhas PostgreSQL, configuração ou validação.

Os retries do outbox só se aplicam depois de existir um registo committed. Não recuperam
uma transação revertida. O lifecycle de manutenção deteta PaymentIntent succeeded e
não expira a encomenda, mas não chama o settlement para a confirmar. O ramo de
reutilização de PaymentIntent também não confirma a encomenda local. Não existe aqui
uma reconciliação periódica que garanta a recuperação de um pagamento pago no Stripe.

Se as entregas de webhook deixarem de chegar, é necessária investigação operacional
e reentrega autorizada do evento original após corrigir a causa. Não alterar estados
via SQL ou repetir cobranças. Se as reservas entretanto expirarem, o mecanismo existente
de late payment pode optar pelo reembolso em vez da confirmação; não se garante que
uma encomenda fique confirmada apenas por o Stripe ter cobrado. Para pagamentos manuais,
repetir a confirmação administrativa com a mesma evidência após corrigir a falha.
A lógica de pagamentos, reservas e reembolsos não foi alterada nesta auditoria.

## Ficheiros alterados

- `src/services/email/admin-order-paid.ts`: snapshot administrativo e recuperação histórica.
- `src/services/email/email-types.ts`: tipo e snapshot específicos.
- `src/services/email/email-notifications.ts`: chave administrativa, serialização do snapshot
  e pesquisas de deduplicação com o contexto transacional.
- `src/services/email/email-templates.ts`: template administrativo HTML/texto com escape.
- `src/services/payments/payment-settlement.ts`: enqueue adicional na transação existente.
- `src/payload.config.ts`: opção do tipo administrativo no outbox.
- `src/services/email/admin-order-paid.test.ts`: testes com dados sintéticos.
- `src/services/email/admin-email-config.ts` e respetivos testes: validação e proteção por ambiente.
- `src/services/email/admin-payment-recovery.test.ts`: webhook e helpers transacionais reais
  com persistência simulada.
- `src/instrumentation.ts`: validação de configuração no arranque do servidor.
- `scripts/validate-admin-email-config.ts`: preflight sem DB ou envio.
- `Dockerfile`: verificação de presença do script e do executor após prune.
- `docker-compose.production.yml` e `docker-compose.staging.yml`: identificação explícita
  do ambiente de notificações.
- `src/services/payments/manual-payment-settlement.test.ts` e
  `src/services/payments/payments.test.ts`: expectativas dos fluxos manual e Stripe.
- `.env.example`, `.env.production.example`, `.env.staging.example`: variável administrativa.
- `scripts/recover-historical-admin-notification.ts`: CLI interna com simulação por defeito.
- `docs/admin-order-notifications.md`: configuração, publicação e recuperação.
- `src/payload-types.ts`: tipos regenerados localmente; ficheiro ignorado pelo Git.

## Configuração

Definir no ambiente de execução da aplicação:

```dotenv
NODE_ENV=production
ADMIN_ORDER_NOTIFICATION_ENV=production
ADMIN_ORDER_NOTIFICATION_EMAIL=shop@eternalflowers.pt
NEXT_PUBLIC_SERVER_URL=https://eternalflowers.pt
```

`ADMIN_ORDER_NOTIFICATION_EMAIL` aceita um único endereço com sintaxe validada.
Em produção é obrigatório configurar explicitamente o endereço oficial acima;
outros destinatários são rejeitados. O modo production exige também NODE_ENV=production
e a origem oficial https://eternalflowers.pt. NODE_ENV=production, isoladamente,
não autoriza envios reais.

Em desenvolvimento e staging:

```dotenv
ADMIN_ORDER_NOTIFICATION_ENV=sandbox
ADMIN_ORDER_NOTIFICATION_EMAIL=admin@example.invalid
```

O modo sandbox aceita apenas destinatários administrativos em domínios reservados
`.invalid` ou `.test`. O valor por defeito é `admin@example.invalid`. O Compose de
staging fixa sandbox, mesmo usando NODE_ENV=production. Em runtime production é
obrigatório declarar o modo; valores ausentes/desconhecidos impedem o arranque.
Atualizar configurações locais anteriores que ainda apontem para o endereço real.

O processador volta a verificar o destinatário persistido imediatamente antes do
provider, pelo que um outbox copiado de produção para staging também fica protegido.
Uma notificação bloqueada segue o tratamento de falha existente; o destinatário
persistido não é substituído. A proteção cobre especificamente `admin_order_paid`:
para testar os restantes emails, usar provider simulado e dados sintéticos.

`src/instrumentation.ts` valida no arranque Node.js do Next, fora de transações e
sem DB, pagamentos ou envio. O build e o runtime Edge não executam esta validação.
Existe também preflight para executar no ambiente correto, antes de iniciar a aplicação:

```bash
node_modules/.bin/tsx scripts/validate-admin-email-config.ts
```

A validação no enqueue mantém-se para proteger o caminho transacional; nenhuma
exceção é silenciada. O URL administrativo usa `/admin/collections/orders/<id>`,
sem tokens, e exige login. Fora de produção o URL por defeito é localhost.
Mantêm-se `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM` e, opcionalmente,
`EMAIL_REPLY_TO`. Nunca guardar valores secretos no repositório.

## Payload e PostgreSQL

Foi adicionada uma opção ao campo `type` de `EmailNotifications`. Regenerar os tipos
com `npm run generate:types` no build habitual (`src/payload-types.ts` é ignorado pelo Git).
As migrações versionadas PostgreSQL e SQLite já definem `type` como `varchar`, o snapshot
como JSON e a chave como única. Não é necessária uma migração nova para este esquema.
Não ativar schema push. Não foram executadas migrações nem consultas de produção.
Se a instalação tiver divergências ao esquema versionado, verificá-las antes da publicação.

## Publicação em produção — não executada

1. Rever o diff e os resultados das verificações. O typecheck global tem dois erros
   anteriores em testes e a suite geral tem falhas anteriores descritas abaixo.
2. Validar em ambiente isolado com Resend simulado. Confirmar que o esquema corresponde
   às migrações existentes, incluindo o índice único do outbox.
3. Após autorização para publicação, definir as variáveis acima no ambiente de produção.
   O serviço `app` do Compose já importa `.env.production` via `env_file` e fixa o modo
   production. Executar o preflight de configuração antes do arranque.
4. Gerar tipos, construir e publicar a imagem pelo procedimento habitual do projeto;
   reiniciar os processos da aplicação com o novo ambiente. Não aplicar nova migração
   por causa desta alteração; manter `PAYLOAD_PG_PUSH=false`.
5. Confirmar saúde da aplicação e funcionamento do scheduler de manutenção existente.
   Na próxima encomenda legitimamente paga, verificar os dois registos independentes
   no painel, respetivos estados e IDs do fornecedor, sem criar compras de teste reais.

## Recuperação exclusiva de EF-20261031-07835F61 — não executada

O script `scripts/recover-historical-admin-notification.ts` é uma ferramenta interna,
sem endpoint público. Executar a partir da raiz da aplicação, com o código publicado e
o ambiente correto carregado. Usar o `tsx` instalado na aplicação; não descarregar um
executor durante a operação. Em contentor, executar os comandos no serviço `app` pelo
procedimento de operações existente. O Dockerfile copia `scripts`, `src` e `node_modules`
para o runtime. `tsx@4.22.4` é dependência de produção do Payload no lockfile e é
preservado por `npm prune --omit=dev`; o build agora verifica a presença do executável
e do script. A imagem Docker completa foi entretanto construída e validada no ensaio final descrito abaixo.

Primeiro, após autorização para acesso ao ambiente de destino:

```bash
node_modules/.bin/tsx scripts/recover-historical-admin-notification.ts --dry-run
```

A simulação é também o modo por defeito. Bloqueia/lê a encomenda 12 numa transação e
valida número, data de criação 2026-10-31, total 34 EUR, pagamento `paid` e estado
confirmado ou posterior. Não cria registos. Não imprime dados do cliente nem credenciais.
O script valida a configuração antes de ligar à DB e desativa explicitamente schema
push nos dois adaptadores.

Depois de rever a simulação e obter autorização para a recuperação:

```bash
node_modules/.bin/tsx scripts/recover-historical-admin-notification.ts --apply
```

Cria apenas `admin_order_paid`, com `admin-order-paid:12`. Se a chave já existir,
devolve `already_queued`, sem alterar o registo existente, mesmo que já esteja enviado.
Não altera a encomenda, pagamentos, stock, nem cria/reenvia `order_confirmed`.
O script nunca chama o fornecedor de email. **O scheduler ativo pode enviar o novo
registo logo após o commit.** O envio usa o processamento assíncrono normal; não
executar um processamento global do outbox para recuperar apenas esta encomenda.
Se o registo já existir como `failed`, seguir o retry existente; não eliminar nem
substituir a chave, não reiniciar contadores automaticamente.

## Verificações locais

- 208 testes relevantes passaram: email, pagamentos, manutenção, lifecycle e configuração Payload.
  Incluem Resend com SDK simulado, ambos os sentidos de falha independente, retries,
  duplicação de confirmações, recuperação idempotente e recusa de encomendas não pagas.
- Suite geral da auditoria: 1009 testes, 1001 passaram e 8 falharam.
  Sete falhas foram reproduzidas numa cópia do commit original: seis em
  `src/app/api/payments/session/session.test.ts` (mock sem `initTransaction`) e uma em
  `src/migrations/manual-orders-migration.test.ts` (binding SQLite indisponível).
  A falha de `backup-architecture.test.ts` era restrição EPERM do sandbox; os seus
  89 testes passaram na repetição autorizada fora do sandbox.
- `tsc --noEmit --incremental false`: dois erros anteriores, reproduzidos no commit
  original, em `src/app/api/catalog-assistant/[...slug]/route.test.ts:385` e
  `src/components/__tests__/CategoriesSection.test.tsx:42`.
- `npm run lint`: indisponível; não há script lint nem ESLint instalado/configurado.
- `npm run build`: passou com fonte descarregada pela rede e ambiente isolado,
  fornecedor de email desativado e URI SQLite em `/tmp`, com schema push desativado.
- Os testes unitários do outbox/settlement usam mocks. O ensaio final acrescentou
  concorrência em PostgreSQL real com a imagem Docker e o código de produção.
- `git diff --check`: passou. `git status --short` e `git diff --stat` inspecionados;
  o stat contabiliza apenas ficheiros já versionados, excluindo os ficheiros novos ainda não versionados.
- Não foram usados emails reais, serviços de pagamento reais ou bases de produção.

## Resultado da auditoria final de segurança

Problemas concretos encontrados e corrigidos:

1. O fallback e os exemplos de dev/staging apontavam para o destinatário real.
   Foram substituídos por sandbox com domínios reservados e uma identificação
   explícita de ambiente. A validação da sintaxe também passou a recusar pontos
   consecutivos e labels de domínio inválidos.
2. Um outbox copiado para staging podia manter um destinatário de produção.
   Foi adicionada proteção no processamento, antes da chamada ao provider.
3. A validação apenas no enqueue podia revelar um erro de configuração depois
   da cobrança Stripe. Foi adicionada validação no arranque e um preflight sem DB;
   a validação transacional continua ativa, sem omitir a notificação ou alterar
   as regras de settlement.
4. A disponibilidade de tsx dependia implicitamente das dependências transitivas.
   Foi confirmada por npm ls --omit=dev e pelo lockfile; o Dockerfile passou a
   exigir o executável e o script após o prune, sem instalar novas dependências.

Verificações adicionais: preflight de produção com endereço oficial e sem qualquer
ligação à DB/envio passou; o build Next.js isolado passou; os testes do webhook
usam assinatura/evento simulados, initTransaction real do Payload e os helpers
transacionais reais, com persistência simulada. A falha de criação administrativa
produziu 500 e rollback; a reentrega criou apenas um registo de cada tipo.
Os 89 testes de backup passaram novamente fora do sandbox.

Preparação para publicação: a alteração pode seguir para revisão e publicação
após autorização e configuração explícita validada no destino. Não constitui
validação de produção nem uma declaração de suite global/typecheck verdes.
A imagem Docker completa e a concorrência PostgreSQL foram posteriormente validadas
no ensaio final abaixo.
A lógica Stripe, de reservas e de stock não recebeu alterações nesta auditoria.
A recuperação da encomenda histórica não foi executada.

A identificação correta do ambiente continua a ser necessária: staging usa o seu
Compose com sandbox e URL local. Copiar integralmente uma identidade/configuração
de produção para outro ambiente remove essa distinção operacional.

## Estado Git no final da auditoria

`git status --short`

```text
 M .env.example
 M .env.production.example
 M .env.staging.example
 M Dockerfile
 M docker-compose.production.yml
 M docker-compose.staging.yml
 M src/payload.config.ts
 M src/services/email/email-notifications.ts
 M src/services/email/email-templates.ts
 M src/services/email/email-types.ts
 M src/services/payments/manual-payment-settlement.test.ts
 M src/services/payments/payment-settlement.ts
 M src/services/payments/payments.test.ts
?? docs/admin-order-notifications.md
?? scripts/recover-historical-admin-notification.ts
?? scripts/validate-admin-email-config.ts
?? src/instrumentation.ts
?? src/services/email/admin-email-config.test.ts
?? src/services/email/admin-email-config.ts
?? src/services/email/admin-order-paid.test.ts
?? src/services/email/admin-order-paid.ts
?? src/services/email/admin-payment-recovery.test.ts
```

`git diff --stat`

```text
 .env.example                                       |  4 ++
 .env.production.example                            |  6 ++-
 .env.staging.example                               |  6 ++-
 Dockerfile                                         |  2 +
 docker-compose.production.yml                      |  1 +
 docker-compose.staging.yml                         |  1 +
 src/payload.config.ts                              |  1 +
 src/services/email/email-notifications.ts          | 23 ++++++-----
 src/services/email/email-templates.ts              | 44 +++++++++++++++++++++-
 src/services/email/email-types.ts                  | 12 ++++++
 .../payments/manual-payment-settlement.test.ts     |  7 ++--
 src/services/payments/payment-settlement.ts        |  3 ++
 src/services/payments/payments.test.ts             |  5 +++
 13 files changed, 96 insertions(+), 19 deletions(-)
```

`git diff --check`

```text
(sem saída; exit 0)
```


## Atualização da VPS — comandos preparados, não executados

Não foi efetuado acesso SSH. O host, utilizador SSH e diretório atual da instalação
não foram verificados. `/opt/loja-flores` aparece no runbook como exemplo, não como
localização confirmada. Executar a partir do checkout de produção já existente,
com o mesmo projeto Compose e os volumes atuais. Substituir o SHA abaixo pelo commit
revisto e publicado após autorização; este trabalho ainda não foi committed.

```bash
ssh <UTILIZADOR_DEPLOY>@<VPS>
cd <CHECKOUT_ATUAL_DE_PRODUCAO>
set -e

# Parar se houver alterações locais versionadas ou ficheiros novos.
test -z "$(git status --porcelain)"
git rev-parse HEAD
./scripts/production/compose.sh ps

# Inspecionar apenas montagens, sem mostrar variáveis/segredos dos contentores.
docker inspect eternal-flowers-postgres eternal-flowers-app \
  --format '{{.Name}} {{range .Mounts}}{{.Name}}:{{.Destination}} {{end}}'

# Backup completo usando o mecanismo existente, sem remover backups antigos.
MIN_SETS=2147483647 ./scripts/production/backup.sh
./scripts/production/backup.sh --verify

# Atualizar apenas para o commit previamente revisto e publicado.
git fetch origin
RELEASE_SHA='<SHA_APROVADO_PUBLICADO>'
git cat-file -e "$RELEASE_SHA^{commit}"
git switch --detach "$RELEASE_SHA"
```

Editar o `.env.production` existente, preservando todas as credenciais e definições
atuais. Não substituir o ficheiro pelo exemplo. Garantir estes valores públicos:

```dotenv
ADMIN_ORDER_NOTIFICATION_ENV=production
ADMIN_ORDER_NOTIFICATION_EMAIL=shop@eternalflowers.pt
NEXT_PUBLIC_SERVER_URL=https://eternalflowers.pt
NEXT_PUBLIC_SITE_URL=https://eternalflowers.pt
PAYLOAD_PG_PUSH=false
```

Os valores NEXT_PUBLIC são usados também durante o build, pelo wrapper Compose.
O modo production é explicitamente fixado no serviço app. Não introduzir variáveis
com o prefixo NEXT_PUBLIC para segredos.

```bash
# Construir apenas a aplicação, mantendo a instância anterior ativa.
./scripts/production/compose.sh build app

# O preflight só lê configuração: não liga à DB nem envia emails.
# --no-deps não inicia/recria PostgreSQL ou outros serviços.
./scripts/production/compose.sh run --rm --no-deps app \
  node_modules/.bin/tsx scripts/validate-admin-email-config.ts

# Atualizar apenas app, preservando as montagens e os outros serviços.
./scripts/production/compose.sh up -d --no-deps app
./scripts/production/compose.sh ps

# Health dentro do contentor, sem credenciais em stdout.
./scripts/production/compose.sh exec -T app node -e \
  'fetch("http://127.0.0.1:3000/api/health").then(async r=>{console.log(r.status,await r.text());if(r.status!==200)process.exit(1)}).catch(()=>process.exit(1))'

docker inspect eternal-flowers-postgres eternal-flowers-app \
  --format '{{.Name}} {{range .Mounts}}{{.Name}}:{{.Destination}} {{end}}'
```

Verificar que as montagens antes/depois continuam a referir
`eternal-flowers-postgres-data:/var/lib/postgresql/data` e
`eternal-flowers-media-data:/app/media`. O Compose usa nomes de volumes fixos e
a recriação apenas de app volta a montar o mesmo media_data; PostgreSQL não é
recriado por `up --no-deps app`. Caddy, certificados e scheduler permanecem ativos.
O build não monta nem altera os volumes de dados existentes.
Não executar down, down -v, prune, bootstrap, seed, restore ou migrações como parte
desta atualização. Não executar a recuperação histórica nesta fase. A passagem de
health não prova conteúdo, autenticação ou entrega real de email; monitorizar o outbox
na próxima encomenda legítima e os resultados normais do scheduler.

Não se verificou a lista de migrações aplicada na VPS: uma eventual divergência da
instalação em relação ao esquema versionado exige investigação própria antes da
publicação. Esta alteração não modifica ficheiros de migração nem acrescenta campos
SQL; acrescenta apenas um valor permitido pelo select Payload, já armazenado em varchar.

## Ensaio final da imagem e PostgreSQL — 01/11/2026

Resultado: imagem e arranque aprovados em isolamento; a implementação está tecnicamente
preparada para publicação após autorização, commit/publicação do código e preflight no
destino. A configuração e os dados da VPS não foram inspecionados. Não foi executado
qualquer commit, push, deploy, recuperação histórica, cobrança ou envio de email real.
Nesta fase apenas foi atualizada documentação; não foi alterado código da aplicação.

### Imagem de produção

Construída com o Dockerfile existente:

```bash
docker build --progress=plain \
  --build-arg NEXT_PUBLIC_SERVER_URL=https://eternalflowers.pt \
  --build-arg NEXT_PUBLIC_SITE_URL=https://eternalflowers.pt \
  --build-arg NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY= \
  --tag eternal-flowers-admin-validation:20261101 .
```

- Build concluído com exit 0, incluindo Next build, prune e verificação de tsx.
- ID inspecionado: `sha256:0ccf63b54c899d48626437366ea5cb48d4cd773a999547e7e022dd1b8343f2df`.
- Tamanho reportado: 595035918 bytes; utilizador de runtime: `appuser`.
- Runtime verificado: Node 22.23.4, tsx 4.22.4, `.next/BUILD_ID`, tipos Payload,
  código de settlement/outbox, migrações, script de recuperação e preflight presentes.
- `.env.production`, `.env.local` e `public/media` local ausentes da imagem.
  Credenciais reais e ficheiros de uploads existentes não foram usados no build.
- O preflight foi executado em contentor com `--network none` e passou com a configuração
  oficial. Foram recusados modo ausente, destinatário incorreto e URL de staging.
- Arranque com configuração inválida produziu erro de instrumentation e health HTTP 500.
  O Next pode imprimir Ready antes de completar a instrumentation e manter o PID ativo:
  validar preflight e HTTP 200, não apenas mensagens de log ou estado running.

### PostgreSQL e concorrência reais

Foi criada a rede Docker `ef-admin-validation-20261101` com `--internal`, sem acesso
externo. O PostgreSQL 16 Alpine foi executado num contentor novo, em tmpfs, sem montar
volumes existentes e sem expor portas. Todas as credenciais e linhas eram sintéticas.
Stripe/Resend ficaram sem chaves, o provider desativado e nenhum scheduler foi iniciado.

As 23 migrações versionadas foram aplicadas numa base vazia, exclusivamente temporária.
O script usou o Payload instalado e `settleOrderPayment` reais, incluindo transações e
SELECT FOR UPDATE, sem mocks. Foram testadas cinco encomendas manuais e cinco encomendas
website com pagamento Stripe sintético e itens made_to_order. Não houve chamadas ao SDK
Stripe ou ao Resend. O fluxo de reservas de artigos em stock não foi exercitado aqui.

```text
10 encomendas x 12 confirmações simultâneas = 120 confirmações
Por encomenda: 1 processed + 11 already_processed
Por encomenda: 1 order_confirmed + 1 admin_order_paid
Total: 10 encomendas paid; 20 notificações pending; attemptCount=0
Emails enviados: 0
```

O teste terminou com exit 0. O esquema antes/depois do Payload e dos settlements
manteve o SHA-256 `f69ffbbabf77c185486e11af9b3904407f6f1ff045e02d631801dc41a57ef9c7`,
calculado sobre colunas/defaults e índices ordenados. O catálogo PostgreSQL confirmou
`email_notifications.type` como character varying e o índice único de deduplication_key.
O novo valor admin_order_paid foi persistido sem alterar o esquema ou criar migrações.
Não é necessária migração por causa desta funcionalidade, para o esquema versionado.

O primeiro ensaio de criação direta via Payload omitiu o campo legado `orders.email`
e falhou no NOT NULL herdado da baseline. O modelo atual permite omiti-lo, mas o serviço
normal `src/services/orders.ts` já escreve `email: customerSnapshot.email || ''`.
A fixture foi corrigida para preencher o campo, sem alterar o esquema ou o código de
produção. Trata-se de uma diferença preexistente entre modelo e constraint legada,
que chamadas diretas à Local API devem respeitar; não foi ocultada por schema push.

A aplicação arrancou a partir da imagem final na mesma rede interna, ligada apenas à
base sintética, com produção/URL/destinatário oficiais, segredos de teste e chaves de
pagamentos/email vazias. `/api/health` respondeu HTTP 200 com `{"status":"ok"}`.
O aviso existente de Payload sobre configuração de sharp/redimensionamento também
apareceu; uploads, transformação de imagens e funcionalidades editoriais não foram
exercitados neste ensaio.

Os 208 testes relevantes foram repetidos e passaram (11 ficheiros). As ressalvas
anteriores do typecheck global e da suite completa continuam documentadas acima.
Os contentores temporários foram parados. Não foram eliminados volumes ou dados
preexistentes; o contentor de staging já existente continuou healthy. A imagem, cache
de build e rede interna de validação permanecem locais; não foi executado prune.

### Evidência local

- Build: `/tmp/eternal-docker-build.log`.
- Artefactos/preflights e aplicação das migrações: `/tmp/eternal-docker-validation.log`
  (contém também a primeira falha da fixture legada; não é um resultado final de sucesso).
- Ensaio concluído e health: `/tmp/eternal-docker-validation-pg.log`.
- Contagens SQL, testes negativos e paragem: `/tmp/eternal-docker-validation-final.log`.
- Testes relevantes: `/tmp/eternal-release-relevant-tests.log`.
- Harness sintético: `/tmp/eternal-admin-pg-validation.ts` (montado apenas no contentor
  de teste, não integra a imagem nem o código de produção).

Os comandos concretos de atualização segura da VPS estão na secção anterior. Esta
verificação não contactou a VPS nem a base de dados de produção, e não confirma o
estado real das migrações, volumes, autenticação ou entrega Resend nesse ambiente.
Continua a existir o risco operacional de pagamentos Stripe sem confirmação local
se as reentregas do webhook cessarem: não há reconciliação periódica automática.
