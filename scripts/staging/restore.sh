#!/usr/bin/env bash
# scripts/staging/restore.sh — Restore do PostgreSQL de staging
# Uso: bash scripts/staging/restore.sh <ficheiro.dump>
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

if [ $# -lt 1 ] || [ ! -f "$1" ]; then
  echo "ERRO: Fornecer um ficheiro .dump válido."
  echo "Uso:  bash scripts/staging/restore.sh backups/staging-<data>.dump"
  exit 1
fi

DUMP_FILE="$1"

# Load env
if [ -f "$PROJECT_DIR/.env.staging.local" ]; then
  set -a
  source "$PROJECT_DIR/.env.staging.local"
  set +a
fi

POSTGRES_USER="${POSTGRES_USER:?POSTGRES_USER não definido — carregar .env.staging.local}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD não definido — carregar .env.staging.local}"
POSTGRES_DB="${POSTGRES_DB:?POSTGRES_DB não definido — carregar .env.staging.local}"
CONTAINER="eternal-flowers-staging-db"

echo "═══════════════════════════════════════"
echo "  Staging Restore"
echo "═══════════════════════════════════════"
echo "  Fonte: $DUMP_FILE"
echo "  Tamanho: $(du -h "$DUMP_FILE" | cut -f1)"
echo "  SHA-256: $(sha256sum "$DUMP_FILE" | cut -d' ' -f1)"
echo ""

read -r -p "Escreve CONFIRMAR para prosseguir: " CONFIRM
if [ "$CONFIRM" != "CONFIRMAR" ]; then
  echo "❌ Restore cancelado."
  exit 1
fi

docker cp "$DUMP_FILE" "$CONTAINER:/tmp/staging-restore.dump" >/dev/null
docker exec "$CONTAINER" pg_restore \
  --verbose --clean --if-exists \
  --no-owner --no-acl \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  /tmp/staging-restore.dump 2>&1 | tail -5

docker exec "$CONTAINER" rm /tmp/staging-restore.dump
echo "  ✅ Restore concluído."