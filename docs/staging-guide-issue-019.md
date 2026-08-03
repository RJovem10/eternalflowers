# ISSUE-019 — Ambiente de Staging Isolado

**Branch:** `feature/issue-019-isolated-staging`
**HEAD:** `$(git rev-parse HEAD)`
**Data:** 2026-08-02
**Estado:** ✅ VALIDADO
**Push:** ❌ | **Merge:** ❌ | **Produção:** ❌

---

## Arquitectura

```
127.0.0.1:3003     ← Aplicação Next.js (modo produção)
127.0.0.1:55433    ← PostgreSQL 16 (Docker)
       └── Container: eternal-flowers-staging-db
       └── Volume:   eternal-flowers-staging-postgres-data
       └── Volume:   eternal-flowers-staging-media

Rede: eternal-flowers-staging-network (bridge)

Docker Compose: docker-compose.staging.yml
```

### Isolamento

| Recurso | Prefixo | Exemplo |
|---|---|---|
| Containers | `eternal-flowers-staging-*` | `eternal-flowers-staging-db` |
| Rede | `eternal-flowers-staging-network` | — |
| Volumes | `eternal-flowers-staging-*` | `eternal-flowers-staging-postgres-data` |
| Portas | 3003 (app), 55433 (PG) | Apenas `127.0.0.1` |
| Media | `./media-staging/` | Cópia isolada, não a original |

### Diferenças para Produção

| Característica | Staging | Produção (Contabo VPS) |
|---|---|---|
| PostgreSQL | Docker local | Docker ou instalado |
| Porta app | 3003 | 443 (via reverse proxy) |
| URL | `http://localhost:3003` | `https://floresmarina.pt` |
| NODE_ENV | `production` | `production` |
| Media | `./media-staging/` | `./media/` |
| Admin | `staging@eternalflowers.pt` | A definir |
| Pagamentos | Stripe vazio (sem pagamentos) | Stripe real |
| Instagram | Sem token | Com token real |
| dados | Cópia da SQLite aprovada | Dados reais |

---

## Ficheiros Criados

### Compose e Config

| Ficheiro | Propósito |
|---|---|
| `docker-compose.staging.yml` | Compose completo: PostgreSQL + App |
| `.env.staging.example` | Template versionado (placeholders apenas) |
| `.env.staging.local` | Valores reais (em .gitignore — NUNCA versionar) |

### Scripts (`scripts/staging/`)

| Script | Propósito |
|---|---|
| `setup.sh` | Provisionamento completo: PG → baseline → migrate → E2-E4 → import → Admin → Build |
| `start.sh` | Arrancar PostgreSQL + servidor Next.js |
| `stop.sh` | Parar tudo, preservar dados |
| `status.sh` | Estado actual de todos os componentes |
| `smoke-test.sh` | 27 testes HTTP (locales, rotas, Admin, 404, conteúdo) |
| `teardown.sh` | Remover containers. `--purge` remove volumes + dados |
| `backup.sh` | pg_dump do PostgreSQL de staging |
| `restore.sh` | pg_restore com confirmação explícita |

### Package Scripts

| Comando | Acção |
|---|---|
| `npm run staging:setup` | Setup completo |
| `npm run staging:start` | Arrancar serviços |
| `npm run staging:stop` | Parar serviços |
| `npm run staging:status` | Mostrar estado |
| `npm run staging:test` | Smoke tests |
| `npm run staging:logs` | Ver logs PostgreSQL |
| `npm run staging:backup` | Backup da BD |
| `npm run staging:restore -- <dump>` | Restaurar backup |
| `npm run staging:teardown` | Teardown (preserva dados) |
| `npm run staging:purge` | Teardown com purge |

---

## Setup

### Pré-requisitos

- Docker (postgres:16-alpine)
- Node.js 22+
- SQLite original em `~/backups/eternalflowers/testing/e2/e2-validation.sqlite`
  - SHA-256: `122d2af7639d26ff98224cefbc9eaefddf11ce78a5729a6d8154e49f5d3e90ee`
- 11 ficheiros Media em `./media/`

### Passos

```bash
# 1. Criar .env.staging.local a partir do exemplo
cp .env.staging.example .env.staging.local
# Editar SOURCE_SQLITE e caminhos se necessário

# 2. Setup completo (cadeia aprovada)
npm run staging:setup
```

O setup executa automaticamente:

1. ✅ Valida requisitos, branch, portas
2. ✅ Arranca PostgreSQL em Docker
3. ✅ Aplica baseline E1
4. ✅ Migra dados: SQLite → PostgreSQL (52 registos)
5. ✅ Aplica E2–E4 (localização do schema)
6. ✅ Importa 272 traduções (68 fontes PT)
7. ✅ Cria Admin `staging@eternalflowers.pt` (password in .env.staging.local)
8. ✅ Cria cópia isolada dos 11 Media
9. ✅ Build de produção
10. ✅ Arranca servidor em `127.0.0.1:3003`
11. ✅ Smoke tests (27/27)

### Arranque manual (após setup)

```bash
npm run staging:start
```

### Parar

```bash
npm run staging:stop
```

### Estado

```bash
npm run staging:status
```

### Smoke Tests

```bash
npm run staging:test
```

---

## Cadeia de Dados Validada

```
SQLite original (122d2af7…)
  │
  ├─ 1. Baseline E1 (schema PostgreSQL)
  ├─ 2. migrate-from-sqlite.ts → 52 registos
  │      media: 11, categories: 5, collections: 6,
  │      flowers: 10, flowers_rels: 19, homepage: 1
  ├─ 3. E2–E4 (flowers_locales, categories_locales,
  │      collections_locales, homepage_locales)
  ├─ 4. import-translations.ts (68 fontes, 272 traduções)
  ├─ 5. Admin: staging@eternalflowers.pt
  ├─ 6. Media: 11 ficheiros copiados (hashes preservados)
  └─ 7. Build: 0 erros, 35 páginas estáticas
```

---

## Backup e Restore

### Backup

```bash
npm run staging:backup
# Cria: backups/staging-<timestamp>.dump
```

### Restore

```bash
npm run staging:restore -- backups/staging-20260802_224900.dump
```

**O restore substitui TODOS os dados actuais** — pede confirmação explícita.

---

## Teardown

### Preservar dados (default)

```bash
npm run staging:teardown
# Remove containers e rede. Dados no volume mantêm-se.
```

### Purge (remove dados)

```bash
npm run staging:purge
# Remove containers, rede, volumes, media-staging, .env.staging.local
# NUNCA usa docker system prune ou docker volume prune.
# Pede confirmação explícita (escrever PURGE).
```

---

## Segurança

| Medida | Descrição |
|---|---|
| Portas `127.0.0.1` | Sem exposição externa |
| Prefixo staging | Nenhum recurso colide com dev ou prod |
| `NODE_ENV` guard | Setup recusa `NODE_ENV=production` pré-existente |
| URI guard | Setup recusa URIs com `contabo`, `vps`, `prod` |
| Remote guard | Setup recusa URIs PostgreSQL não locais |
| `.env.staging.local` | Em `.gitignore` — nunca versionado |
| Dados reais | Nenhum dado real de produção é usado |
| Teardown seguro | `--purge` pede confirmação explícita |

---

## Troubleshooting

### Servidor não arranca

Verificar logs:

```bash
cat /tmp/eternal-staging-server.log
```

### PostgreSQL não disponível

```bash
docker logs eternal-flowers-staging-db
```

### Porta ocupada

Verificar:

```bash
ss -tlnp | grep -E ':(3003|55433)'
```

### Build falha

```bash
npm run build 2>&1 | tail -20
```

### Media não servidos

Verificar que `media-staging/` existe e tem 11 ficheiros:

```bash
ls -la media-staging/
```

### Corrigir após restore

Após restore, o servidor precisa de ser reiniciado:

```bash
npm run staging:stop
npm run staging:start
```

---

## Critérios GO/NO-GO

### GO apenas se TODOS os seguintes passarem:

| # | Critério | Verificação |
|---|----------|-------------|
| 1 | ✅ PostgreSQL arranca | `docker ps` |
| 2 | ✅ Baseline E1 aplicada | `payload_migrations` regista E1 |
| 3 | ✅ 52 registos migrados | `media=11, cat=5, col=6, fl=10, rels=19, hp=1` |
| 4 | ✅ E2–E4 aplicadas | 4 locales tables existem |
| 5 | ✅ 68/68 sourceHash | Validate sem erros |
| 6 | ✅ 272/272 traduções | Import verification |
| 7 | ✅ Idempotência | 0 writes, 272 skips |
| 8 | ✅ Admin criado | Login funcional |
| 9 | ✅ 11/11 Media copiados | Hashes preservados |
| 10 | ✅ Build | `npm run build` exit 0 |
| 11 | ✅ HTTP 5 locales | 200, html lang correcto |
| 12 | ✅ Rotas principais | 200 (home, catalog, about, flower, cart, checkout) |
| 13 | ✅ 404 | Rota inexistente → 404 |
| 14 | ✅ Admin HTTP | /admin → 200 |
| 15 | ✅ Conteúdo localizado | 5 idiomas com texto próprio |
| 16 | ✅ Backup/Restore | Dump + Restore mantém contagens |
| 17 | ✅ Stop/Start | Dados persistem após reinício |