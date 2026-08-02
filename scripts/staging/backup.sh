#!/usr/bin/env bash
# scripts/staging/backup.sh — Backup do PostgreSQL de staging
#
# Uso:
#   bash scripts/staging/backup.sh                    # Backup timestamped
#   bash scripts/staging/backup.sh /caminho/output.dump  # Backup para caminho específico
#
# NOTA: Nunca envia dados para fora do ambiente local.
set -euo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null || echo "${BASH_SOURCE[0]%/*}/../..")"

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "  ${GREEN}✅${NC} $1"; }
fail() { echo -e "  ${RED}❌${NC} $1"; exit 1; }
info() { echo -e "  ${CYAN}→${NC} $1"; }

# Carregar env
if [ -f .env.staging.local ]; then
  set -a; source .env.staging.local; set +a
fi

PG_HOST="${STAGING_PG_HOST:-127.0.0.1}"
PG_PORT="${STAGING_PG_PORT:-55433}"
PG_USER="${STAGING_PG_USER:-staging}"
PG_PASS="${STAGING_PG_PASS:?STAGING_PG_PASS não definido — carregar .env.staging.local}"
PG_DB="${STAGING_PG_DB:-eternal_flowers_staging}"

# Verificar container
if ! docker ps --format '{{.Names}}' | grep -q '^eternal-flowers-staging-db$'; then
  fail "PostgreSQL staging não está em execução"
fi

OUTPUT="${1:-backups/staging-$(date +%Y%m%d_%H%M%S).dump}"
mkdir -p "$(dirname "$OUTPUT")"

info "A criar backup: $OUTPUT"
PGPASSWORD="$PG_PASS" pg_dump \
  -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" \
  --no-owner --no-acl \
  -F c \
  -f "$OUTPUT"

SIZE=$(stat -c%s "$OUTPUT" 2>/dev/null || stat -f%z "$OUTPUT" 2>/dev/null)
ok "Backup criado: $OUTPUT ($SIZE bytes)"
echo ""