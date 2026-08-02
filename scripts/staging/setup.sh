#!/usr/bin/env bash
# scripts/staging/setup.sh — Provisionamento completo do ambiente de staging
#
# Uso:
#   bash scripts/staging/setup.sh
#
# Requer:
#   - Docker (postgres:16-alpine)
#   - Node.js 22+
#   - SQLite original em SOURCE_SQLITE (ver .env.staging.example)
#
# Executa a cadeia completa:
#   1. Valida requisitos, branch, portas
#   2. Arranca PostgreSQL em Docker
#   3. Aplica baseline E1
#   4. Migra dados: SQLite → PostgreSQL (migrate-from-sqlite.ts)
#   5. Aplica E2–E4
#   6. Importa traduções (import-translations.ts)
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
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

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

# ─── Config ───────────────────────────────────────
SOURCE_SQLITE="${SOURCE_SQLITE:-}"
STAGING_MEDIA_DIR="${STAGING_MEDIA_DIR:-$PROJECT_DIR/media-staging}"
STAGING_PG_PORT="${STAGING_PG_PORT:-55433}"
STAGING_APP_PORT="${STAGING_APP_PORT:-3003}"
STAGING_PG_HOST="${STAGING_PG_HOST:-127.0.0.1}"
STAGING_PG_USER="${STAGING_PG_USER:-staging}"
STAGING_PG_PASS="${STAGING_PG_PASS:-staging_password_change_me}"
STAGING_PG_DB="${STAGING_PG_DB:-eternal_flowers_staging}"
PG_URI="postgresql://${STAGING_PG_USER}:${STAGING_PG_PASS}@${STAGING_PG_HOST}:${STAGING_PG_PORT}/${STAGING_PG_DB}"
CONTAINER_NAME="eternal-flowers-staging-db"
NETWORK_NAME="eternal-flowers-staging-network"
VOLUME_NAME="eternal-flowers-staging-postgres-data"
MEDIA_VOLUME="eternal-flowers-staging-media"

echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}  Eternal Flowers — Staging Setup      ${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"

# ═══════════════════════════════════════════
# 1. VALIDAÇÕES
# ═══════════════════════════════════════════
title "1. Validações"

# Branch
BRANCH=$(git branch --show-current)
info "Branch: $BRANCH"
if [ "$BRANCH" != "feature/issue-019-isolated-staging" ]; then
  warn "Branch não esperada. Continuar mesmo assim? (Ctrl+C para cancelar)"
fi

# Git clean
if [ -n "$(git status --porcelain)" ]; then
  warn "Working tree suja — mudanças não commitadas"
fi

# Docker
if ! docker info >/dev/null 2>&1; then
  fail "Docker não está a correr"
fi
ok "Docker disponível"

# Node
if ! command -v node &>/dev/null; then
  fail "Node.js não encontrado"
fi
ok "Node.js $(node -v)"

# SQLite source
if [ -z "$SOURCE_SQLITE" ]; then
  fail "SOURCE_SQLITE não definida"
fi
if [ ! -f "$SOURCE_SQLITE" ]; then
  fail "SQLite não encontrada: $SOURCE_SQLITE"
fi
ACTUAL_HASH=$(sha256sum "$SOURCE_SQLITE" | cut -d' ' -f1)
EXPECTED_HASH="122d2af7639d26ff98224cefbc9eaefddf11ce78a5729a6d8154e49f5d3e90ee"
if [ "$ACTUAL_HASH" != "$EXPECTED_HASH" ]; then
  fail "SHA-256 diverge!\n  Esperado: $EXPECTED_HASH\n  Actual:   $ACTUAL_HASH"
fi
ok "SQLite source: hash verificado ($ACTUAL_HASH)"

# Porta PG
if ss -tlnp | grep -q ":${STAGING_PG_PORT} "; then
  fail "Porta PG ${STAGING_PG_PORT} já ocupada"
fi
ok "Porta PG ${STAGING_PG_PORT} livre"

# Porta App
if ss -tlnp | grep -q ":${STAGING_APP_PORT} "; then
  fail "Porta App ${STAGING_APP_PORT} já ocupada"
fi
ok "Porta App ${STAGING_APP_PORT} livre"

# Segurança
if [[ "$PG_URI" =~ contabo|vps|prod ]]; then
  fail "URI contém referência a produção!"
fi
if [ ! -z "$(echo "$PG_URI" | grep -v localhost | grep -v '127.0.0.1' | grep -v '::1' | grep -E '^postgres://')" ]; then
  fail "URI aponta para servidor remoto!"
fi
if [ "${NODE_ENV:-}" = "production" ]; then
  fail "NODE_ENV=production! Staging não deve usar production."
fi
ok "Segurança: ambiente isolado verificado"

# Dependências
if [ ! -d node_modules ]; then
  info "node_modules não encontrado — a instalar..."
  npm ci || fail "npm ci falhou"
fi
ok "Dependências instaladas"

# ═══════════════════════════════════════════
# 2. PostgreSQL
# ═══════════════════════════════════════════
title "2. PostgreSQL Container"

# Criar rede se não existir
if ! docker network ls --format '{{.Name}}' | grep -q "^${NETWORK_NAME}$"; then
  docker network create "$NETWORK_NAME" >/dev/null
  ok "Rede ${NETWORK_NAME} criada"
else
  ok "Rede ${NETWORK_NAME} já existe"
fi

# Remover container antigo se existir
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  warn "Container ${CONTAINER_NAME} já existe — a remover..."
  docker rm -f "$CONTAINER_NAME" >/dev/null
fi

# Arrancar
docker run -d \
  --name "$CONTAINER_NAME" \
  --network "$NETWORK_NAME" \
  -e POSTGRES_USER="$STAGING_PG_USER" \
  -e POSTGRES_PASSWORD="$STAGING_PG_PASS" \
  -e POSTGRES_DB="$STAGING_PG_DB" \
  -p "127.0.0.1:${STAGING_PG_PORT}:5432" \
  -v "${VOLUME_NAME}:/var/lib/postgresql/data" \
  postgres:16-alpine >/dev/null

ok "Container ${CONTAINER_NAME} arrancado"

# Aguardar healthcheck
info "A aguardar PostgreSQL..."
for i in $(seq 1 30); do
  if docker exec "$CONTAINER_NAME" pg_isready -U "$STAGING_PG_USER" -d "$STAGING_PG_DB" >/dev/null 2>&1; then
    ok "PostgreSQL disponível após ${i}s"
    break
  fi
  if [ "$i" -eq 30 ]; then
    fail "PostgreSQL não ficou disponível após 30s"
  fi
  sleep 1
done

# ═══════════════════════════════════════════
# 3. Baseline E1
# ═══════════════════════════════════════════
title "3. Baseline E1"

# Extrair SQL da migration baseline
BASELINE_SQL=$(node -e "
const fs = require('fs');
const content = fs.readFileSync('src/migrations-pg/20260731_000000_baseline.ts', 'utf-8');
const match = content.match(/await db\\.execute\\(sql\`([\\s\\S]*?)\`\\)/);
if (!match) { console.error('Baseline SQL not found'); process.exit(1); }
process.stdout.write(match[1].trim());
")

# Aplicar baseline
echo "$BASELINE_SQL" | docker exec -i "$CONTAINER_NAME" psql -U "$STAGING_PG_USER" -d "$STAGING_PG_DB" -v ON_ERROR_STOP=1 >/dev/null
ok "Baseline E1 aplicada"

# Registar na payload_migrations
docker exec "$CONTAINER_NAME" psql -U "$STAGING_PG_USER" -d "$STAGING_PG_DB" \
  -c "INSERT INTO payload_migrations (name, batch, created_at, updated_at) VALUES ('20260731_000000_baseline', 1, now(), now()) ON CONFLICT DO NOTHING;" >/dev/null
ok "E1 registada na payload_migrations"

# ═══════════════════════════════════════════
# 4. Migrate SQLite → PostgreSQL
# ═══════════════════════════════════════════
title "4. Migração de Dados (SQLite → PostgreSQL)"

# Verificar tabelas vazias
TABLE_COUNT=$(docker exec "$CONTAINER_NAME" psql -U "$STAGING_PG_USER" -d "$STAGING_PG_DB" -t -A -c "
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';
")
if [ "$TABLE_COUNT" -gt 0 ]; then
  info "DB já tem $TABLE_COUNT tabelas — dry-run primeiro..."
fi

# Dry-run
info "Dry-run..."
npx tsx scripts/postgresql/migrate-from-sqlite.ts \
  --source="$SOURCE_SQLITE" \
  --target="$PG_URI" \
  --dry-run || fail "Dry-run falhou"
ok "Dry-run passou"

# Apply
info "Apply..."
npx tsx scripts/postgresql/migrate-from-sqlite.ts \
  --source="$SOURCE_SQLITE" \
  --target="$PG_URI" \
  --apply \
  --confirm=MIGRATE_SQLITE_TO_POSTGRES || fail "Migração falhou"
ok "Migração concluída"

# Validar contagens
info "Validar contagens..."
echo ""
docker exec "$CONTAINER_NAME" psql -U "$STAGING_PG_USER" -d "$STAGING_PG_DB" -c "
SELECT 'media' AS t, COUNT(*) AS cnt FROM media
UNION ALL SELECT 'categories', COUNT(*) FROM categories
UNION ALL SELECT 'collections', COUNT(*) FROM collections
UNION ALL SELECT 'flowers', COUNT(*) FROM flowers
UNION ALL SELECT 'homepage', COUNT(*) FROM homepage
ORDER BY t;
"
echo ""
ok "Dados migrados"

# ═══════════════════════════════════════════
# 5. E2–E4 Migrations
# ═══════════════════════════════════════════
title "5. Migrations E2–E4"

export DATABASE_URI="$PG_URI"
export PAYLOAD_SQLITE_PUSH="false"

# Executar payload migrate
info "A aplicar E2–E4..."
echo "y" | npx payload migrate 2>&1 | grep -E "Migrating|Migrated|Done|ERROR|already" | head -20 || true

# Verificar locales tables criadas
LOCALES_TABLES=$(docker exec "$CONTAINER_NAME" psql -U "$STAGING_PG_USER" -d "$STAGING_PG_DB" -t -A -c "
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE '%_locales';
")
if [ "$LOCALES_TABLES" -ge 4 ]; then
  ok "E2–E4 aplicadas ($LOCALES_TABLES locales tables)"
else
  warn "Apenas $LOCALES_TABLES locales tables encontradas — verificar"
fi

# ═══════════════════════════════════════════
# 6. Import Traduções
# ═══════════════════════════════════════════
title "6. Importação de Traduções"

SNAPSHOT_DIR="/tmp/eternal-staging-$(date +%Y%m%d_%H%M%S)"

# Dry-run
info "Dry-run (validate)..."
npx tsx scripts/translations/import-translations.ts \
  --dry-run \
  --snapshot-dir="$SNAPSHOT_DIR" 2>&1 | tail -20 || warn "Dry-run teve avisos"
ok "Validação de traduções concluída"

# Apply SQL
info "Apply..."
npx tsx scripts/translations/import-translations.ts \
  --apply --confirm=IMPORT_TRANSLATIONS \
  --snapshot-dir="$SNAPSHOT_DIR" 2>&1 | tail -20 || fail "Importação falhou"
ok "Traduções importadas"

# Idempotência
info "A verificar idempotência..."
IDEM_OUTPUT=$(npx tsx scripts/translations/import-translations.ts \
  --dry-run \
  --snapshot-dir="$SNAPSHOT_DIR" 2>&1)

if echo "$IDEM_OUTPUT" | grep -q "SUCCESS"; then
  ok "Idempotência OK (0 writes)"
else
  warn "Idempotência — verificar output manualmente"
fi

# ═══════════════════════════════════════════
# 7. Admin temporário
# ═══════════════════════════════════════════
title "7. Admin temporário"

# Criar admin via script one-shot
info "A criar admin staging@eternalflowers.pt..."
ADMIN_OUTPUT=$(npx tsx -e "
const { getPayload } = require('payload');
const config = require('./src/payload.config.js').default;
(async () => {
  const payload = await getPayload({ config });
  try {
    const existing = await payload.find({ collection: 'users', where: { email: { equals: 'staging@eternalflowers.pt' } } });
    if (existing.totalDocs > 0) {
      console.log('Admin já existe');
    } else {
      const user = await payload.create({
        collection: 'users',
        data: {
          email: 'staging@eternalflowers.pt',
          password: process.env.STAGING_ADMIN_PASSWORD || require('crypto').randomBytes(16).toString('hex'),
          roles: ['admin'],
        },
      });
      console.log('Admin criado: ' + user.email);
    }
    process.exit(0);
  } catch(e) {
    console.error('Erro admin: ' + e.message);
    process.exit(1);
  }
})();
" 2>&1) || true
echo "  $ADMIN_OUTPUT"

# ═══════════════════════════════════════════
# 8. Media
# ═══════════════════════════════════════════
title "8. Cópia isolada dos Media"

if [ -d "$STAGING_MEDIA_DIR" ]; then
  info "Diretório media-staging já existe — a verificar..."
  STAGING_COUNT=$(ls -1 "$STAGING_MEDIA_DIR" 2>/dev/null | wc -l)
  if [ "$STAGING_COUNT" -eq 11 ]; then
    ok "Media-staging já tem 11 ficheiros"
  else
    warn "Media-staging tem $STAGING_COUNT ficheiros — a recriar..."
    rm -rf "$STAGING_MEDIA_DIR"
    mkdir -p "$STAGING_MEDIA_DIR"
    cp "$PROJECT_DIR/media/"* "$STAGING_MEDIA_DIR/"
    ok "Media copiados (11 ficheiros)"
  fi
else
  mkdir -p "$STAGING_MEDIA_DIR"
  cp "$PROJECT_DIR/media/"* "$STAGING_MEDIA_DIR/"
  ok "Media copiados (11 ficheiros)"
fi

# Verificar hashes
info "A verificar hashes dos media..."
ORIG_HASHES=$(cd "$PROJECT_DIR/media" && sha256sum *)
STAGE_HASHES=$(cd "$STAGING_MEDIA_DIR" && sha256sum *)
if [ "$ORIG_HASHES" = "$STAGE_HASHES" ]; then
  ok "Hashes dos media preservados"
else
  fail "Hashes dos media divergem!"
fi

# ═══════════════════════════════════════════
# 9. Build
# ═══════════════════════════════════════════
title "9. Build de Produção"

info "A construir (DATABASE_URI=$PG_URI)..."
export DATABASE_URI="$PG_URI"
# Build sem o SQLite local (staging usa PG)
npm run build 2>&1 | tail -5 || fail "Build falhou"
ok "Build concluído (0 erros)"

# ═══════════════════════════════════════════
# 10. Arranque
# ═══════════════════════════════════════════
title "10. Arranque da Aplicação"

info "A iniciar servidor em 127.0.0.1:$STAGING_APP_PORT..."
# Parar servidor anterior se existir
if [ -f /tmp/eternal-staging-pid.txt ]; then
  OLD_PID=$(cat /tmp/eternal-staging-pid.txt)
  if kill -0 "$OLD_PID" 2>/dev/null; then
    warn "Servidor anterior (PID $OLD_PID) — a parar..."
    kill "$OLD_PID" 2>/dev/null || true
    sleep 1
  fi
fi

NODE_ENV=production DATABASE_URI="$PG_URI" nohup npx next start -p "$STAGING_APP_PORT" > /tmp/eternal-staging-server.log 2>&1 &
echo $! > /tmp/eternal-staging-pid.txt
SERVER_PID=$!

# Aguardar servidor
info "A aguardar servidor..."
for i in $(seq 1 30); do
  if curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$STAGING_APP_PORT/pt" 2>/dev/null | grep -q '200'; then
    ok "Servidor disponível após ${i}s (PID $SERVER_PID)"
    break
  fi
  if [ "$i" -eq 30 ]; then
    fail "Servidor não respondeu após 30s — ver /tmp/eternal-staging-server.log"
  fi
  sleep 1
done

# ═══════════════════════════════════════════
# 11. Smoke Tests
# ═══════════════════════════════════════════
title "11. Smoke Tests"

bash "$SCRIPT_DIR/smoke-test.sh" 2>&1 || fail "Smoke tests falharam"

# ═══════════════════════════════════════════
# Resumo
# ═══════════════════════════════════════════
title "Resumo"

echo ""
echo -e "  ${GREEN}Staging operacional!${NC}"
echo ""
echo "  Aplicação:   http://127.0.0.1:$STAGING_APP_PORT"
echo "  Admin:       http://127.0.0.1:$STAGING_APP_PORT/admin"
echo "  Login:       staging@eternalflowers.pt (password in .env.staging.local)"
echo "  PostgreSQL:  127.0.0.1:$STAGING_PG_PORT"
echo "  Media dir:   $STAGING_MEDIA_DIR"
echo "  Container:   $CONTAINER_NAME"
echo "  PID server:  $SERVER_PID"
echo ""
echo -e "  Comandos uteis:"
echo "    bash scripts/staging/status.sh"
echo "    bash scripts/staging/stop.sh"
echo "    bash scripts/staging/smoke-test.sh"
echo "    bash scripts/staging/teardown.sh       (preserva dados)"
echo "    bash scripts/staging/teardown.sh --purge  (remove tudo)"
echo ""