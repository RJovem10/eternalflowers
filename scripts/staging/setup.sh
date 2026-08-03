#!/usr/bin/env bash
# scripts/staging/setup.sh — Provisionamento completo do ambiente de staging
#
# Uso:
#   bash scripts/staging/setup.sh
#
# Requer:
#   - Docker (postgres:16-alpine)
#   - Node.js 22+
#   - .env.staging.local com POSTGRES_PASSWORD, POSTGRES_USER, POSTGRES_DB, SOURCE_SQLITE
#
# Executa a cadeia completa:
#   1. Valida requisitos, branch, portas
#   2. Arranca PostgreSQL em Docker
#   3. Aplica baseline E1
#   4. Migra dados: SQLite → PostgreSQL (migrate-from-sqlite.ts)
#   5. Aplica E2–E4
#   6. Importa traduções
#   7. Cria Admin temporário
#   8. Cria cópia isolada dos Media
#   9. Build e arranque da aplicação
#  10. Smoke tests
#
set -euo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null || echo "${BASH_SOURCE[0]%/*}/../..")"
PROJECT_DIR="$PWD"
SCRIPT_DIR="$PROJECT_DIR/scripts/staging"

# ─── Cores ────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "  ${GREEN}✅${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠️${NC} $1"; }
fail() { echo -e "  ${RED}❌${NC} $1"; exit 1; }
info() { echo -e "  ${CYAN}→${NC} $1"; }
title(){ echo -e "\n${CYAN}═══════════════════════════════════════${NC}"; echo -e "${CYAN} $1${NC}"; echo -e "${CYAN}═══════════════════════════════════════${NC}"; }

# ─── Load env ─────────────────────────────────────
if [ -f .env.staging.local ]; then
  set -a
  source .env.staging.local
  set +a
  ok ".env.staging.local carregado"
else
  fail ".env.staging.local não encontrado. Criar a partir de .env.staging.example"
fi

# ─── Variáveis obrigatórias (sem default) ─────────
POSTGRES_USER="${POSTGRES_USER:?POSTGRES_USER não definido — definir em .env.staging.local}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD não definido — definir em .env.staging.local}"
POSTGRES_DB="${POSTGRES_DB:?POSTGRES_DB não definido — definir em .env.staging.local}"
SOURCE_SQLITE="${SOURCE_SQLITE:?SOURCE_SQLITE não definido — definir em .env.staging.local}"

# ─── Config derivada (em memória, sem duplicar password) ──
DATABASE_URI="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:55433/${POSTGRES_DB}"
export DATABASE_URI
STAGING_MEDIA_DIR="${STAGING_MEDIA_DIR:-$PROJECT_DIR/media-staging}"
CONTAINER_NAME="eternal-flowers-staging-db"
NETWORK_NAME="eternal-flowers-staging-network"
VOLUME_NAME="eternal-flowers-staging-postgres-data"
MEDIA_VOLUME="eternal-flowers-staging-media"

echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}  Eternal Flowers — Staging Setup      ${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo ""

SOURCE_HASH=$(sha256sum "$SOURCE_SQLITE" 2>/dev/null | cut -d' ' -f1)

# ═══════════════════════════════════════════════════
# 1. Validações
# ═══════════════════════════════════════════════════
title "1. Validações"

info "Branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'N/A')"
if ! git diff --quiet 2>/dev/null; then
  warn "Working tree suja — mudanças não commitadas"
fi

if command -v docker &>/dev/null; then ok "Docker disponível"; else fail "Docker não encontrado"; fi
NODE_MAJOR=$(node -e "console.log(process.version.slice(1).split('.')[0])" 2>/dev/null || echo "0")
if [ "$NODE_MAJOR" -ge 22 ]; then ok "Node.js $(node --version)"; else fail "Node.js 22+ necessário (atual: $(node --version))"; fi

if [ "$SOURCE_HASH" != "122d2af7639d26ff98224cefbc9eaefddf11ce78a5729a6d8154e49f5d3e90ee" ]; then
  fail "SHA-256 da SQLite não corresponde ao esperado. Obtido: $SOURCE_HASH"
fi
ok "SQLite source: hash verificado ($SOURCE_HASH)"

# Verificar portas
! ss -tlnp | grep -q ':55433 ' || fail "Porta PG 55433 já ocupada"
! ss -tlnp | grep -q ':3003 '  || fail "Porta App 3003 já ocupada"
ok "Portas livres"

# Segurança
if echo "$DATABASE_URI" | grep -qiE 'contabo|vps|prod'; then
  fail "URI contém referência a produção!"
fi
if [ "${NODE_ENV:-}" = "production" ]; then
  fail "NODE_ENV=production! Staging não deve usar production."
fi
ok "Segurança: ambiente isolado verificado"

if [ ! -d node_modules ]; then
  info "node_modules não encontrado — a instalar..."
  npm ci || fail "npm ci falhou"
fi
ok "Dependências instaladas"

# ═══════════════════════════════════════════════════
# 2. PostgreSQL
# ═══════════════════════════════════════════════════
title "2. PostgreSQL Container"

if ! docker network ls --format '{{.Name}}' | grep -q "^${NETWORK_NAME}$"; then
  docker network create "$NETWORK_NAME" >/dev/null
  ok "Rede ${NETWORK_NAME} criada"
else
  ok "Rede ${NETWORK_NAME} já existe"
fi

if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  warn "Container ${CONTAINER_NAME} já existe — a remover..."
  docker rm -f "$CONTAINER_NAME" >/dev/null
fi

docker run -d \
  --name "$CONTAINER_NAME" \
  --network "$NETWORK_NAME" \
  -e POSTGRES_USER="$POSTGRES_USER" \
  -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
  -e POSTGRES_DB="$POSTGRES_DB" \
  -p "127.0.0.1:55433:5432" \
  -v "${VOLUME_NAME}:/var/lib/postgresql/data" \
  postgres:16-alpine >/dev/null

ok "Container ${CONTAINER_NAME} arrancado"

info "A aguardar PostgreSQL..."
for i in $(seq 1 30); do
  if docker exec "$CONTAINER_NAME" pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
    ok "PostgreSQL disponível após ${i}s"
    break
  fi
  if [ "$i" -eq 30 ]; then
    fail "PostgreSQL não ficou disponível após 30s"
  fi
  sleep 1
done

# ═══════════════════════════════════════════════════
# 3. Baseline E1
# ═══════════════════════════════════════════════════
title "3. Baseline E1"

BASELINE_SQL=$(node -e "
const fs = require('fs');
const content = fs.readFileSync('src/migrations-pg/20260731_000000_baseline.ts', 'utf-8');
const match = content.match(/await db\.execute\(sql\`([\s\S]*?)\`\)/);
if (!match) { console.error('Baseline SQL not found'); process.exit(1); }
process.stdout.write(match[1].trim());
")

# Aplicar baseline (tolerar 'already exists' em nova execução)
echo "$BASELINE_SQL" | docker exec -i "$CONTAINER_NAME" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=0 2>&1 | grep -v 'already exists' | head -5
ok "Baseline E1 aplicada"

# Registar na payload_migrations
docker exec "$CONTAINER_NAME" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "INSERT INTO payload_migrations (name, batch, created_at, updated_at) VALUES ('20260731_000000_baseline', 1, now(), now()) ON CONFLICT DO NOTHING;" >/dev/null
ok "E1 registada na payload_migrations"

# ═══════════════════════════════════════════════════
# 4. Migrate SQLite → PostgreSQL
# ═══════════════════════════════════════════════════
title "4. Migração de Dados (SQLite → PostgreSQL)"

npx tsx scripts/postgresql/migrate-from-sqlite.ts \
  --source="$SOURCE_SQLITE" \
  --target="$DATABASE_URI" \
  --apply --confirm=MIGRATE_SQLITE_TO_POSTGRES 2>&1 | tail -3

ok "Dados migrados"

# ═══════════════════════════════════════════════════
# 5. E2–E4 (Localização do Schema)
# ═══════════════════════════════════════════════════
title "5. Migrations E2–E4"

PAYLOAD_SQLITE_PUSH="false" npx payload migrate 2>&1 | grep -E 'Migrating|Migrated|INFO|Done\.|error|Error'
ok "E2–E4 aplicadas"

# ═══════════════════════════════════════════════════
# 6. Importação das Traduções (modo PostgreSQL SQL)
# ═══════════════════════════════════════════════════
title "6. Importação de Traduções"

SNAPSHOT_DIR="/tmp/pg-import-$(date +%Y%m%d)"
mkdir -p "$SNAPSHOT_DIR"

DATABASE_URI="$DATABASE_URI" npx tsx scripts/translations/import-translations.ts \
  --apply-sql \
  --snapshot-dir="$SNAPSHOT_DIR" 2>&1 | tail -10
ok "Traduções importadas"

# ═══════════════════════════════════════════════════
# 7. Criação do Admin
# ═══════════════════════════════════════════════════
title "7. Admin"

# Limpar temp script mesmo em caso de erro
trap 'rm -f /tmp/create-admin.ts' EXIT

STAGING_ADMIN_EMAIL="${STAGING_ADMIN_EMAIL:?STAGING_ADMIN_EMAIL nao definido — definir em .env.staging.local}"
STAGING_ADMIN_PASSWORD="${STAGING_ADMIN_PASSWORD:?STAGING_ADMIN_PASSWORD nao definido — definir em .env.staging.local}"
echo "  A criar admin..."

# Criar admin via Payload run
cat <<'ADMIN_SCRIPT' > /tmp/create-admin.ts
import { getPayload } from 'payload'
import { config } from './src/payload.config'

async function main() {
  const payload = await getPayload({ config })
  const email = process.env.STAGING_ADMIN_EMAIL
  const password = process.env.STAGING_ADMIN_PASSWORD
  if (!email || !password) {
    console.error('STAGING_ADMIN_EMAIL e STAGING_ADMIN_PASSWORD obrigatorios')
    process.exit(1)
  }
  const existing = await payload.find({ collection: 'users', where: { email: { equals: email } } })
  if (existing.totalDocs > 0) {
    console.log('Admin ja existe, a ignorar')
    return
  }
  await payload.create({
    collection: 'users',
    data: { email, password },
  })
  console.log('Admin criado')
}
main().catch(console.error)
ADMIN_SCRIPT

DATABASE_URI="$DATABASE_URI" STAGING_ADMIN_EMAIL="$STAGING_ADMIN_EMAIL" STAGING_ADMIN_PASSWORD="$STAGING_ADMIN_PASSWORD" npx tsx /tmp/create-admin.ts 2>&1 | tail -3
rm -f /tmp/create-admin.ts
trap - EXIT
ok "Admin verificado"

# ═══════════════════════════════════════════════════
# 8. Cópia dos Media
# ═══════════════════════════════════════════════════
title "8. Media"

if [ -d "$STAGING_MEDIA_DIR" ]; then
  rm -rf "$STAGING_MEDIA_DIR"/*
else
  mkdir -p "$STAGING_MEDIA_DIR"
fi

cp "$PROJECT_DIR"/media/*.jpg "$STAGING_MEDIA_DIR/"
MEDIA_COUNT=$(ls "$STAGING_MEDIA_DIR"/*.jpg 2>/dev/null | wc -l)
ok "Media copiados: $MEDIA_COUNT ficheiros"

# ═══════════════════════════════════════════════════
# 9. Build
# ═══════════════════════════════════════════════════
title "9. Build"

DATABASE_URI="$DATABASE_URI" npm run build 2>&1 | grep -E '✓ Generating|pages|✓ Build|error|Error|FAIL'
ok "Build concluído"

# ═══════════════════════════════════════════════════
# 10. Arranque + Smoke Tests
# ═══════════════════════════════════════════════════
title "10. Arranque e Smoke Tests"

# Arrancar servidor em background
export DATABASE_URI
npm run staging:start 2>&1 | grep -E '✅|❌|disponível'

# Aguardar servidor
for i in $(seq 1 15); do
  if curl -s -o /dev/null -w '' http://127.0.0.1:3003/pt 2>/dev/null; then
    ok "Servidor disponível"
    break
  fi
  sleep 1
done

# Smoke tests
npm run staging:test 2>&1
echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}  Setup concluído com sucesso.         ${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo ""
echo "  Admin:  http://localhost:3003/admin"
echo "  Site:   http://localhost:3003"
echo "  PG:     localhost:55433"
echo ""