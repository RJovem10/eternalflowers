#!/usr/bin/env bash
# scripts/staging/backup.sh — Backup do PostgreSQL de staging
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Load env
if [ -f "$PROJECT_DIR/.env.staging.local" ]; then
  set -a
  source "$PROJECT_DIR/.env.staging.local"
  set +a
fi

POSTGRES_USER="${POSTGRES_USER:?POSTGRES_USER não definido — carregar .env.staging.local}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD não definido — carregar .env.staging.local}"
POSTGRES_DB="${POSTGRES_DB:?POSTGRES_DB não definido — carregar .env.staging.local}"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups}"
CONTAINER="eternal-flowers-staging-db"

mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DUMP_FILE="$BACKUP_DIR/staging-$TIMESTAMP.dump"

echo "═══════════════════════════════════════"
echo "  Staging Backup"
echo "═══════════════════════════════════════"

docker exec "$CONTAINER" pg_dump \
  -U "$POSTGRES_USER" \
  --no-owner --no-acl \
  --format=custom \
  --file=/tmp/staging-dump.dump \
  "$POSTGRES_DB" 2>&1 || { echo "❌ pg_dump falhou"; exit 1; }

docker cp "$CONTAINER:/tmp/staging-dump.dump" "$DUMP_FILE" >/dev/null
docker exec "$CONTAINER" rm /tmp/staging-dump.dump

echo "  ✅ Backup: $DUMP_FILE"
echo "  Tamanho: $(du -h "$DUMP_FILE" | cut -f1)"
sha256sum "$DUMP_FILE"

echo "  ✅ Backup concluído."