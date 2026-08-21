# 🌸 Eternal Flowers

Plataforma de e-commerce da **Eternal Flowers**, dedicada a peças botânicas artesanais, flores eternizadas e joalharia em resina.

O projeto reúne loja, catálogo, conteúdos, encomendas, pagamentos e operações de produção numa aplicação construída à medida com Next.js e Payload CMS.

**Produção:** [https://eternalflowers.pt](https://eternalflowers.pt)

## Funcionalidades

- catálogo de produtos, categorias e coleções;
- conteúdos e navegação em cinco idiomas;
- stock, disponibilidade e reservas temporárias;
- carrinho, checkout, cupões e encomendas;
- pagamentos através de Stripe;
- email transacional através de Resend;
- conteúdos do Instagram através da Meta API;
- uploads de imagens e conteúdos editoriais;
- Painel de administração fornecido pelo Payload CMS.

## Stack

### Aplicação

- **Next.js 15** (App Router)
- **React 19**
- **TypeScript**
- **Tailwind CSS 3**
- **Payload CMS 3**

### Dados e infraestrutura

- **SQLite** em desenvolvimento local
- **PostgreSQL 16** em produção
- **Docker Compose** para orquestração dos serviços
- **Caddy** como reverse proxy e terminação HTTPS
- volumes persistentes para PostgreSQL, uploads e dados do Caddy

### Integrações

- **Stripe** para pagamentos e webhooks
- **Resend** para email transacional
- **Instagram / Meta API** para conteúdos sociais

## Internacionalização

A loja suporta Português, Inglês, Espanhol, Italiano e Alemão. As páginas públicas usam rotas com o segmento `[locale]`, e o conteúdo administrável pode ter variantes localizadas no Payload CMS.

| Idioma | Locale | Exemplo |
| --- | --- | --- |
| Português | `pt` | `/pt/catalog` |
| Inglês | `en` | `/en/catalog` |
| Espanhol | `es` | `/es/catalog` |
| Italiano | `it` | `/it/catalog` |
| Alemão | `de` | `/de/catalog` |

Os dicionários da interface estão em `src/i18n/`; os conteúdos traduzíveis e os respetivos utilitários de importação encontram-se em `translations/` e `scripts/translations/`.

## Desenvolvimento local

### Pré-requisitos

- Node.js 22 ou superior
- npm

### Arranque

```bash
npm install
cp .env.example .env.local
npm run dev
```

Antes de iniciar, ajuste `.env.local` para desenvolvimento: use uma ligação SQLite, defina um `PAYLOAD_SECRET` local e mantenha as credenciais opcionais vazias quando não precisar das respetivas integrações. Nunca versione segredos.

Com a aplicação em execução:

- loja: [http://localhost:3000](http://localhost:3000) (redireciona para o locale predefinido);
- Painel de administração: [http://localhost:3000/admin](http://localhost:3000/admin).

Na primeira utilização do Painel de administração, o Payload CMS permite criar o utilizador inicial.

## Pagamentos e encomendas

O checkout cria e acompanha encomendas, aplica cupões, gere reservas de stock e inicia pagamentos através de Stripe. A confirmação assíncrona é recebida pelo webhook de Stripe, e os estados de pagamento e de cumprimento são mantidos no Payload CMS.

O processamento de notificações transacionais usa Resend. As credenciais de Stripe e Resend são exclusivamente variáveis de ambiente e não devem ser expostas ao cliente ou incluídas no repositório.

## Estrutura do projeto

```text
src/
├── app/
│   ├── (frontend)/[locale]/  # Loja e páginas públicas localizadas
│   ├── (payload)/            # Painel de administração e API do Payload
│   └── api/                  # Checkout, pagamentos, webhooks e health check
├── components/               # Componentes da interface e do backoffice
├── content/                  # Conteúdo estático estruturado
├── i18n/                     # Locales e dicionários da interface
├── migrations/               # Migrações SQLite
├── migrations-pg/            # Migrações PostgreSQL
├── services/                 # Encomendas, stock, pagamentos, email e manutenção
└── payload.config.ts         # Configuração do Payload CMS

scripts/
├── production/               # Compose, preflight, backups, restore e smoke tests
├── staging/                  # Operações do ambiente de staging
└── translations/             # Validação e importação de traduções

docs/                         # Arquitetura, operação, padrões e guias do projeto
translations/                 # Conteúdos localizados para importação
```

## Arquitetura de produção

A produção é composta por quatro serviços isolados numa rede Docker interna:

```text
Internet
   │
   ▼
Caddy (:80 / :443)
   │
   ▼
App (:3000) ─────► PostgreSQL (:5432)
   ▲
   │
maintenance-scheduler
```

- `app`: aplicação Next.js e Payload CMS;
- `postgres`: PostgreSQL 16 com armazenamento persistente;
- `caddy`: reverse proxy, HTTPS automático e único serviço com portas públicas;
- `maintenance-scheduler`: invoca tarefas internas de manutenção sem expor portas nem receber credenciais desnecessárias.

A aplicação, a base de dados e o scheduler comunicam apenas pela rede interna. Só o Caddy publica as portas HTTP/HTTPS no host.

## Operação em produção

A configuração versionada está em `docker-compose.production.yml`. Os valores reais devem ser guardados em `.env.production`, criado a partir de `.env.production.example` e nunca versionado.

Use sempre o wrapper de produção, que seleciona o ficheiro Compose e carrega explicitamente `.env.production`:

```bash
./scripts/production/compose.sh up -d
./scripts/production/compose.sh ps
./scripts/production/compose.sh logs -f app
```

Antes de alterações operacionais, consulte o [runbook de produção](docs/production-runbook-issue-016-019.md). O script `scripts/production/preflight.sh` executa verificações prévias de configuração e segurança; `scripts/production/smoke-test.sh` cobre verificações essenciais após o arranque.

## Backups e restauro

Os backups incluem a base de dados PostgreSQL e os uploads persistentes. A automação e os procedimentos de recuperação estão implementados em:

- `scripts/production/backup.sh`;
- `scripts/production/restore.sh`;
- `scripts/production/install-backup-timer.sh`;
- `configs/systemd/eternalflowers-backup.service` e `configs/systemd/eternalflowers-backup.timer`.

Os backups só são úteis se forem monitorizados e restauráveis. Valide regularmente a retenção, a integridade dos artefactos e o processo de restauro segundo o runbook.

## Testes e verificações

```bash
# testes unitários e de integração
npx vitest run

# verificação TypeScript
npx tsc --noEmit

# validação das traduções
npm run translations:validate

# build de produção
npm run build

# executar no ambiente de produção após alterações/deploy
./scripts/production/smoke-test.sh
```

Os testes ficam junto do código (`*.test.ts` e `*.test.tsx`) e cobrem, entre outros, checkout, pagamentos, encomendas, stock, email, manutenção, componentes e SEO.

## Segurança

- segredos e credenciais vivem apenas em ficheiros de ambiente não versionados;
- `.env.production` é obrigatório nas operações de produção;
- apenas o Caddy expõe portas públicas;
- PostgreSQL, a aplicação e o maintenance scheduler permanecem na rede interna;
- o scheduler recebe apenas o segredo necessário para autenticar chamadas internas;
- endpoints internos, webhooks e operações administrativas exigem autenticação apropriada;
- alterações de esquema em produção devem usar migrações versionadas e ser precedidas por backup.

## Documentação

A documentação técnica e operacional está em [`docs/`](docs/). Os principais pontos de entrada são:

- [contexto do projeto](docs/PROJECT_CONTEXT.md);
- [modelo de domínio](docs/DOMAIN_MODEL.md);
- [normas de desenvolvimento](docs/development-standards.md);
- [runbook de produção](docs/production-runbook-issue-016-019.md);
- [guia de staging](docs/staging-guide-issue-019.md);
- [guia de marca](docs/BRAND_GUIDE.md).

Consulte estes documentos antes de alterar arquitetura, dados, deployment ou identidade visual.
