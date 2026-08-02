#!/usr/bin/env bash
# scripts/staging/restore.sh — Restaurar um backup do PostgreSQL de staging
#
# Uso:
#   bash scripts/staging/restore.sh /caminho/para/backup.dump
#
# ATENÇÃO: Substitui TODOS os dados actuais no PostgreSQL de staging.
set -euo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null || echo "${BASH_SOURCE[0]%/*}/../..")"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "  ${GREEN}✅${NC} $1"; }
fail() { echo -e "  ${RED}❌${NC} $1"; exit 1; }
info() { echo -e "  ${CYAN}→${NC} $1"; }

if [ $# -lt 1 ]; then
  echo "Uso: bash scripts/staging/restore.sh /caminho/para/backup.dump"
  exit 1
fi

DUMP="$1"
if [ ! -f "$DUMP" ]; then
  fail "Ficheiro não encontrado: $DUMP"
fi

# Carregar env
if [ -f .env.staging.local ]; then
  set -a; source .env.staging.local; set +a
fi

PG_HOST="${STAGING_PG_HOST:-127.0.0.1}"
PG_PORT="${STAGING_PG_PORT:-55433}"
PG_USER="${STAGING_PG_USER:-staging}"
PG_PASS="${STAGING_PG_PASS:?STAGING_PG_PASS não definido — carregar .env.staging.local}"
PG_DB="${STAGING_PG_DB:-eternal_flowers_staging}"
CONTAINER="eternal-flowers-staging-db"

# Verificar container
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  fail "PostgreSQL staging não está em execução"
fi

echo ""
echo -e "${YELLOW}═══════════════════════════════════════════${NC}"
echo -e "${YELLOW}  ATENÇÃO: RESTORE — DADOS SUBSTITUÍDOS   ${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════${NC}"
echo ""
echo "  Isto irá SUBSTITUIR todos os dados actuais no staging."
echo "  Backup: $DUMP"
echo ""
read -rp "  Escreva RESTORE para confirmar: " CONFIRM
if [ "$CONFIRM" != "RESTORE" ]; then
  echo "  Cancelado."
  exit 0
fi

# Parar servidor se estiver a correr
if [ -f /tmp/eternal-staging-pid.txt ]; then
  PID=$(cat /tmp/eternal-staging-pid.txt)
  if kill -0 "$PID" 2>/dev/null; then
    info "A parar servidor Next.js..."
    kill "$PID" 2>/dev/null || true
    sleep 1
  fi
fi

info "A restaurar backup..."
# Recriar DB vazia
docker exec "$CONTAINER" psql -U "$PG_USER" -c "DROP DATABASE IF EXISTS ${PG_DB};" >/dev/null
docker exec "$CONTAINER" psql -U "$PG_USER" -c "CREATE DATABASE ${PG_DB};" >/dev/null

# Restaurar
PGPASSWORD="$PG_PASS" pg_restore \
  -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" \
  --no-owner --no-acl \
  "$DUMP"

ok "Restauro concluído"

# Voltar a arrancar servidor
info "A rearrancar servidor..."
bash scripts/staging/start.sh 2>&1 | tail -5

echo ""