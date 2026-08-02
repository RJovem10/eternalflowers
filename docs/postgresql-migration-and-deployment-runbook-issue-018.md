# ISSUE-018 — Runbook de Migração SQLite → PostgreSQL e Deployment

**Estado:** Planeamento  
**Branch:** `feature/issue-018-postgresql-deployment-runbook`  
**HEAD:** `$(git rev-parse HEAD)`  
**Data:** 2026-08-02  

---

## A. Pré-requisitos

### A.1 Ambiente
- Node.js 22+
- Docker + Docker Compose (VPS)
- PostgreSQL 16 (local para ensaio; VPS para produção)
- Acesso ao servidor VPS (Contabo) via SSH
- Git (branch `feature/issue-016-payload-localization` ou `main` após merge)

### A.2 Variáveis de ambiente obrigatórias (.env no VPS)

```bash
# Base de dados PostgreSQL (VPS)
DATABASE_URI=postgresql://loja:<password>@<host>:5432/loja_flores

# Payload
PAYLOAD_SECRET=<segredo-forte-64-chars>
PAYLOAD_PG_PUSH=false              # NUNCA true em produção

# Site
NEXT_PUBLIC_SITE_URL=https://floresmarina.pt
NEXT_PUBLIC_SERVER_URL=https://floresmarina.pt

# Stripe (se ativo)
STRIPE_SECRET_KEY=<stripe-secret>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<stripe-publishable>

# Instagram (se ativo)
INSTAGRAM_BUSINESS_ID=<id>
INSTAGRAM_ACCESS_TOKEN=<token>
```

### A.3 Portas
| Serviço | Local | VPS |
|---------|-------|-----|
| Aplicação Next.js | 3001 | 3000 |
| PostgreSQL | 55432 (ensaio) | 5432 |
| WhatsApp bridge | 3000 (local) | — |

---

## B. Backups Obrigatórios

### B.1 SQLite (origem)

```bash
# Backup da base SQLite
cp loja.sqlite "backups/loja-$(date +%Y%m%d_%H%M%S).sqlite"

# Validar hash
sha256sum loja.sqlite backups/loja-*.sqlite

# Backup do diretório media/
cp -r media/ "backups/media-$(date +%Y%m%d_%H%M%S)/"

# Backup de configuração
cp .env "backups/env-$(date +%Y%m%d_%H%M%S).bak"
```

### B.2 PostgreSQL (VPS, antes de qualquer migração)

```bash
pg_dump -U loja -h localhost -d loja_flores \
  --no-owner --no-acl \
  -f "backups/pg-pre-migration-$(date +%Y%m%d_%H%M%S).dump"
```

### B.3 Antes de cada passo
Cada passo destrutivo (migração de dados, importação de traduções) deve ser precedido de um backup completo.

---

## C. Preparação PostgreSQL

### C.1 Container local (ensaio)

```bash
docker run -d \
  --name pg-018-ensaio \
  -e POSTGRES_USER=loja \
  -e POSTGRES_PASSWORD=loja_ensaio_2026 \
  -e POSTGRES_DB=loja_flores \
  -p 55555:5432 \
  postgres:16-alpine
```

### C.2 Schema baseline (E1)

A baseline E1 cria todo o schema inicial com as colunas localizadas ainda nas tabelas base.

```bash
# Aplicar via SQL direto (ver secção C.3)
# Ou via npx payload migrate com a migration a funcionar
```

**Aplicar E1 manualmente:**

```bash
# Extrair SQL da migration
cd loja-flores-marina
npx tsx -e "
const fs = require('fs');
const content = fs.readFileSync('src/migrations-pg/20260731_000000_baseline.ts', 'utf-8');
const match = content.match(/await db\\.execute\\(sql\`([\\s\\S]*?)\`\\)/);
fs.writeFileSync('/tmp/e1-baseline.sql', match[1].trim());
"

# Executar contra PostgreSQL
psql -U loja -h localhost -d loja_flores < /tmp/e1-baseline.sql
```

### C.3 Registar E1 na payload_migrations

```bash
psql -U loja -h localhost -d loja_flores -c "
INSERT INTO payload_migrations (name, batch, created_at, updated_at)
VALUES ('20260731_000000_baseline', 1, now(), now());
"
```

Isto é necessário para que `npx payload migrate` saiba que E1 já foi aplicada e não tente reaplicá-la. As restantes (E2–E4) serão detectadas como pendentes.

---

## D. Migração SQLite → PostgreSQL

### D.1 Abordagem

A migração de dados é feita por script Node.js/TypeScript que:

1. Lê dados da SQLite via `better-sqlite3`
2. Escreve no PostgreSQL via Payload Local API
3. Preserva IDs quando as tabelas de destino usam `serial` (PK auto-increment)
4. Respeita a ordem: media → categorias → coleções → flores → homepage → relações

**Porquê Payload Local API em vez de SQL directo:**
- Respeita hooks, validações e transformações do Payload
- Lida com o formato de dados (arrays, relações, uploads)
- Garante que os dados inseridos são consistentes com o schema do Payload
- Evita escrita direta em tabelas que o Payload gere automaticamente

### D.2 Script de migração (proposto)

Ficheiro alvo: `scripts/postgresql/migrate-from-sqlite.ts`

```typescript
// Estrutura proposta
// 1. VALIDAÇÕES INICIAIS
//    - Verificar que SQLite de origem existe e tem dados
//    - Verificar que PostgreSQL de destino está vazio (ou já tem baseline)
//    - Comparar contagens esperadas
//    - Abortar se produção

// 2. LER DA SQLITE
//    - media (11 registos)
//    - categories (5)
//    - collections (6)
//    - flowers (10)
//    - homepage (1 global)
//    - flowers_rels (19 relações M:N)

// 3. INSERIR NO POSTGRESQL
//    - ORDEM: media → categories → collections → flowers → homepage → flowers_rels
//    - Transactions: uma transação por collection
//    - Preservar IDs explícitos onde possível
//    - Actualizar sequências (SELECT setval(...))

// 4. VALIDAÇÕES
//    - Contagens iguais
//    - IDs correspondentes
//    - Relações válidas
//    - Media referenciado correctamente

// 5. SEGURANÇA
//    - isProdDB() guard (mesmo padrão do importador)
//    - --confirm flag obrigatória
//    - --dry-run mode
//    - Snapshot do estado antes/depois
```

### D.3 Ordem de migração

| Passo | Origem | Destino | IDs | Transação |
|-------|--------|---------|-----|-----------|
| 1 | sqlite: `media` | PG: `media` | Preservar (insert explícito) | Sim |
| 2 | sqlite: `categories` | PG: `categories` | Preservar | Sim |
| 3 | sqlite: `collections` | PG: `collections` | Preservar | Sim |
| 4 | sqlite: `flowers` | PG: `flowers` | Preservar | Sim |
| 5 | sqlite: `homepage` | PG: `homepage` | id=1 | Sim |
| 6 | sqlite: `flowers_rels` | PG: `flowers_rels` | Automático | Sim |
| 7 | Reset sequences | `setval(...)` | — | Sim |

O script de migração **não faz**:
- Importação de traduções (passo separado, secção G)
- Migração de media files (passo separado, secção H)
- Aplicação de migrations E2–E4 (passo separado, secção F)

### D.4 Protecção

```typescript
// O script deve abortar se:
if (isProdDB(uri)) abort('Base de produção detectada')
if (mode !== '--apply') { /* dry-run */ }
if (!confirmToken) abort('Falta --confirm=MIGRATE_SQLITE_TO_PG')
```

---

## E. Aplicação das Migrations E2–E4

Depois de migrados os dados monolingues PT, aplicar E2–E4:

```bash
# E2-E4 backfill + DROP COLUMN
DATABASE_URI="postgres://loja:..." npx payload migrate
```

### Ordem das migrations

| Migration | Nome | Acção |
|-----------|------|-------|
| E2 | flowers_story_localized | Cria `flowers_locales`, backfill PT story, DROP COLUMN story |
| E3A | categories_localized | Cria `categories_locales`, backfill PT, DROP COLUMN name, description |
| E3B | collections_localized | Cria `collections_locales`, backfill PT, DROP COLUMN name, description |
| E4 | homepage_localized | Cria `homepage_locales`, backfill PT, DROP COLUMN 16 campos |

### Verificação

```sql
-- 4 locales tables devem existir
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_name LIKE '%_locales';

-- Colunas antigas devem ter sido removidas
SELECT column_name FROM information_schema.columns
WHERE table_name='flowers' AND column_name='story';
-- Deve retornar 0 rows

-- Backfill PT deve ter sido feito
SELECT COUNT(*) FROM flowers_locales WHERE _locale='pt';  -- 10
SELECT COUNT(*) FROM categories_locales WHERE _locale='pt';  -- 5
SELECT COUNT(*) FROM collections_locales WHERE _locale='pt';  -- 6
SELECT COUNT(*) FROM homepage_locales WHERE _locale='pt';  -- 1
```

---

## F. Importação das Traduções

### F.1 Validar manifestos

```bash
npm run translations:validate
```

Esperado: 4 entidades, 16 mirrors, 68 fontes, 272 traduções, zero erros.

### F.2 Dry-run

```bash
npx tsx scripts/translations/import-translations.ts \
  --dry-run \
  --snapshot-dir=/tmp/pg-import-$(date +%Y%m%d)
```

Esperado: 272 PLANNED_WRITE, 0 SKIP, 0 CONFLICT.

### F.3 Apply

```bash
npx tsx scripts/translations/import-translations.ts \
  --apply \
  --confirm=IMPORT_TRANSLATIONS \
  --snapshot-dir=/tmp/pg-import-$(date +%Y%m%d)
```

Esperado: 272/272 verified, 98 ops, committed.

### F.4 Idempotência

```bash
npx tsx scripts/translations/import-translations.ts --dry-run
```

Esperado: 0 WRITES, 272 SKIP_IDENTICAL.

---

## G. Migração dos Media

### G.1 Localização actual

Os ficheiros media estão em `./media/` (raiz do projecto), referenciados na tabela `media` da SQLite.

```bash
# Estrutura no repositório
./media/hero.jpg
./media/colar-lagrima.jpg
... (11 ficheiros)

# .gitignore
public/media/
```

No VPS, o Payload com `staticDir: 'media'` serve ficheiros de `./media/`.

### G.2 Copiar para o VPS

```bash
# Local → VPS (após rsync ou scp)
rsync -avzP ./media/ usuario@vps:/opt/loja-flores/media/
```

### G.3 Validar

```bash
# No VPS
sha256sum /opt/loja-flores/media/*.jpg | sort > /tmp/media-hashes-vps.txt
# Comparar com hashes locais
diff /tmp/media-hashes-local.txt /tmp/media-hashes-vps.txt
```

### G.4 Volume Docker

No `docker-compose.yml` do VPS, mapear o directório media:

```yaml
volumes:
  - ./media:/app/media
```

---

## H. Build e Arranque

### H.1 Build

```bash
export DATABASE_URI="postgres://loja:..."
export PAYLOAD_SQLITE_PUSH="false"
npm run build
```

Esperado: 0 erros, todas as páginas geradas nos 5 locales.

### H.2 Arranque (dev mode para validação)

```bash
npm run dev
```

### H.3 Arranque (produção)

```bash
npm run start
# ou via Docker Compose:
docker compose up -d --build
```

---

## I. Smoke Tests

### I.1 HTTP

```bash
# Testar todos os locales
for locale in pt en es it de; do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/$locale)
  echo "/$locale: $code"
done

# Testar rotas principais
for path in /pt /pt/catalog /pt/flower/1 /pt/about /pt/cart /pt/checkout /pt/nonexistent; do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000$path)
  echo "$path: $code"
done
```

Esperado: todos 200 excepto `/pt/nonexistent` (404).

### I.2 html lang

```bash
for locale in pt en es it de; do
  lang=$(curl -s http://localhost:3000/$locale | grep -o '<html[^>]*lang="[^"]*"' | head -1)
  echo "/$locale: $lang"
done
```

### I.3 Payload Admin

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/admin
# Esperado: 200 (ou redirect para login)
```

### I.4 API

```bash
# API Payload
curl -s http://localhost:3000/api/flowers?locale=pt | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Flowers: {d[\"totalDocs\"]} docs')"

# API cupão
curl -s -X POST http://localhost:3000/api/coupon -H 'Content-Type: application/json' -d '{"code":"TEST"}' | head -1
```

---

## J. Critérios Go/No-Go

### GO apenas se TODOS os seguintes passos passarem:

| # | Critério | Verificação |
|---|----------|-------------|
| 1 | ✅ Backup SQLite OK | sha256sum, md5sum, data/hora registados |
| 2 | ✅ Backup media OK | 11 ficheiros, hashes conferidos |
| 3 | ✅ Backup PostgreSQL OK | pg_dump concluído, ficheiro >0 bytes |
| 4 | ✅ Cópia de ensaio válida | SHA-256 igual à origem |
| 5 | ✅ Baseline E1 aplicada | payload_migrations regista E1 |
| 6 | ✅ Dados PT migrados | Contagens: hp=1, cat=5, col=6, fl=10, media=11 |
| 7 | ✅ E2-E4 aplicadas | 4 locales tables, 21 colunas removidas |
| 8 | ✅ 68/68 sourceHash | translations:validate sem erros |
| 9 | ✅ 272/272 traduções | Import verification 272/272 |
| 10 | ✅ Idempotência | 0 writes, 272 skips |
| 11 | ✅ Media copiados | 11 ficheiros, hashes iguais |
| 12 | ✅ Build | npm run build exit 0 |
| 13 | ✅ HTTP 5 locales | 200, lang correcto |
| 14 | ✅ HTTP rotas | 200/404 correctos |
| 15 | ✅ Admin Payload | /admin responde |
| 16 | ✅ Rollback ensaiado | Testado em ensaio local |

Qualquer falha = **NO-GO**. Corrigir e re-testar.

---

## K. Rollback

### K.1 Falha antes do cutover
Se a migração falhar antes de qualquer tráfego ser redirecionado:
- Parar o novo container PostgreSQL
- Restaurar o DNS/proxy para apontar para a aplicação SQLite antiga
- Diagnosticar e corrigir

### K.2 Falha durante a migração de dados
```bash
# 1. Parar o script de migração
Ctrl+C

# 2. Descartar base PostgreSQL
dropdb -U loja -h localhost loja_flores
createdb -U loja -h localhost loja_flores

# 3. Restaurar baseline
psql -U loja -h localhost -d loja_flores < /tmp/e1-baseline.sql

# 4. Corrigir o script e recomeçar
```

### K.3 Falha durante importação de traduções
```bash
# Se o importador abortar antes do commit:
#   → Nada a fazer. A transação foi rolled back.

# Se o importador abortar depois do commit (apenas verificação falhou):
#   → As traduções podem estar parcialmente aplicadas.
#   → Executar dry-run para ver estado actual.
#   → Se necessário, recomeçar com base limpa (secção K.2).
```

### K.4 Falha depois do deployment
```bash
# 1. Parar a aplicação nova
docker compose down

# 2. Restaurar DNS/proxy para SQLite

# 3. Restaurar base PostgreSQL a partir do dump
dropdb -U loja -h localhost loja_flores
createdb -U loja -h localhost loja_flores
pg_restore -U loja -h localhost -d loja_flores backups/pg-pre-migration-*.dump

# 4. Reverter docker-compose para apontar para SQLite
#    (comentar DATABASE_URI, usar SQLite local)

# 5. Reconstruir e reiniciar
docker compose up -d --build

# 6. Confirmar que a aplicação antiga funciona
curl -s http://localhost:3000/pt | grep -o '<title>[^<]*</title>'
```

### K.5 Rollback de media
```bash
# Restaurar media do backup
cp -r backups/media-2026*/ media/
```

### K.6 Evitar escritas durante rollback
- Desligar o load balancer / proxy reverso
- Colocar o site em modo de manutenção (página estática 503)
- Só depois executar rollback

---

## L. Plano de Ensaio Local

### L.1 Preparação

```bash
# 1. Criar diretório de ensaio
mkdir -p /tmp/eternal-flowers-migration-rehearsal
cd /tmp/eternal-flowers-migration-rehearsal

# 2. Copiar código
cp -r /home/jovem/workspace/loja-flores-marina/* .

# 3. Copiar SQLite de ensaio
cp /home/jovem/workspace/loja-flores-marina/loja.sqlite .

# 4. Copiar media
cp -r /home/jovem/workspace/loja-flores-marina/media/ .

# 5. PostgreSQL descartável
docker run -d \
  --name pg-018-ensaio \
  -e POSTGRES_USER=loja \
  -e POSTGRES_PASSWORD=loja_ensaio \
  -e POSTGRES_DB=loja_flores \
  -p 55555:5432 \
  postgres:16-alpine
```

### L.2 Execução da cadeia completa

```bash
# 1. Baseline E1 (SQL directo)
psql -U loja -h localhost -p 55555 -d loja_flores < /tmp/e1-baseline.sql

# 2. Registar E1
psql -U loja -h localhost -p 55555 -d loja_flores \
  -c "INSERT INTO payload_migrations (...) VALUES ('20260731_000000_baseline', 1, now(), now());"

# 3. Migrar dados PT (script de migração SQLite → PG)
DATABASE_URI="postgres://loja:loja_ensaio@localhost:55555/loja_flores" \
  npx tsx scripts/postgresql/migrate-from-sqlite.ts \
  --source=loja.sqlite \
  --apply --confirm=MIGRATE_SQLITE_TO_PG

# 4. E2-E4
DATABASE_URI="..." PAYLOAD_SQLITE_PUSH="false" npx payload migrate

# 5. Validar sourceHash + importar traduções
# ... (seguir secção F)

# 6. Build
DATABASE_URI="..." npm run build

# 7. Smoke tests

# 8. Backup PG
pg_dump -U loja -h localhost -p 55555 -d loja_flores > pg-ensaio-final.dump

# 9. Rollback ensaio
# Descartar base, recomeçar do backup
```

### L.3 Validações obrigatórias do ensaio

| Item | Antes | Depois |
|------|-------|--------|
| Homepage | 1 row | 1 row |
| Categorias | 5 | 5 |
| Colecções | 6 | 6 |
| Flores | 10 | 10 |
| Media | 11 | 11 |
| Flores Rels | 19 | 19 |
| Categorias Locales PT | — | 5 |
| Traduções EN | — | 272 valores |
| IDs flores | 1-10 | 1-10 |
| IDs categorias | 1-5 | 1-5 |
| Preços | originais | originais |
| SKUs | originais | originais |

---

## M. Lista de Decisões Pendentes

| # | Decisão | Opções | Impacto |
|---|---------|--------|---------|
| 1 | Quando fazer merge da feature para main? | Após ISSUE-018 ou antes? | Ordem de deployment |
| 2 | Substituir ou preservar a loja.sqlite no VPS? | Manter read-only vs remover | Rollback |
| 3 | Migrar com Payload Local API vs SQL directo? | API (+seguro) vs SQL (+rápido) | Método de migração |
| 4 | Fazer cutover com downtime ou gradual? | Parar vs migração a quente | Disponibilidade |
| 5 | Preservar IDs das flores no PostgreSQL? | Sim (igual SQLite) vs Não (auto) | URLs de produto |
| 6 | Staging no VPS antes de produção? | Subdomínio vs mesmo VPS | Risco |
| 7 | Volume media: bind mount ou volume Docker? | Bind (+simples) vs Volume (+isolado) | Persistência |

---

## N. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Media em falta no VPS | Média | Alto | Rsync + verificação de hashes |
| Dados inconsistentes pós-migração | Baixa | Alto | Validação de contagens + relações |
| Traduções não aplicadas | Baixa | Médio | Dry-run + idempotência |
| Build falha no VPS | Média | Alto | Testar build local com PG |
| PostgreSQL incompatível | Baixa | Alto | Usar 16-alpine (mesmo que dev) |
| Falha de rollback | Baixa | Crítico | Backup + dump antes de cada passo |
| Perda de media no Docker | Média | Alto | Volume persistente + backup |

---

## O. Ficheiros a Criar/Modificar

| Ficheiro | Acção | Conteúdo |
|----------|-------|----------|
| `docs/postgresql-migration-and-deployment-runbook-issue-018.md` | **NOVO** | Este documento |
| `scripts/postgresql/migrate-from-sqlite.ts` | **NOVO** | Script de migração de dados |
| `scripts/postgresql/e2e-migration-rehearsal.sh` | **NOVO** | Script de ensaio completo |

---

## P. Resumo do Processo

```
SQLite (loja.sqlite)
  │
  ├── 1. Backup + hashes
  ├── 2. Baseline E1 no PostgreSQL vazio
  ├── 3. Migrar dados PT (media → cats → cols → flowers → hp → rels)
  ├── 4. E2-E4 (backfill + DROP COLUMN)
  ├── 5. Importar traduções (dry-run → apply → idempotence)
  ├── 6. Copiar media files
  ├── 7. Build
  ├── 8. Smoke tests
  └── 9. GO/NO-GO → Cutover
```
