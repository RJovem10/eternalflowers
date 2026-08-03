#!/usr/bin/env bash
# scripts/staging/start.sh — Arrancar servidor Next.js de staging
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Load env
if [ -f "$PROJECT_DIR/.env.staging.local" ]; then
  set -a
  source "$PROJECT_DIR/.env.staging.local"
  set +a
fi

# Construir DATABASE_URI em memória se não existir
if [ -z "${DATABASE_URI:-}" ]; then
  PG_USER="${POSTGRES_USER:-staging}"
  PG_PASS="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD nao definido — carregar .env.staging.local}"
  PG_HOST="${STAGING_PG_HOST:-127.0.0.1}"
  PG_PORT="${STAGING_PG_PORT:-55433}"
  PG_DB="${POSTGRES_DB:-eternal_flowers_staging}"
  DATABASE_URI="postgresql://${PG_USER}:${PG_PASS}@${PG_HOST}:${PG_PORT}/${PG_DB}"
fi

export DATABASE_URI

APP_PORT="${STAGING_APP_PORT:-3003}"

echo "═══════════════════════════════════════"
echo "  Eternal Flowers — Staging Start      "
echo "═══════════════════════════════════════"

# Verificar se o PostgreSQL está a correr
if docker ps --format '{{.Names}}' | grep -q '^eternal-flowers-staging-db$'; then
  echo "  ✅ PostgreSQL já está em execução"
elif docker ps -a --format '{{.Names}}' | grep -q '^eternal-flowers-staging-db$'; then
  echo "  → PostgreSQL parado — a iniciar..."
  docker start eternal-flowers-staging-db >/dev/null
  for i in $(seq 1 15); do
    if docker exec eternal-flowers-staging-db pg_isready -U "${POSTGRES_USER:-staging}" -d "${POSTGRES_DB:-eternal_flowers_staging}" >/dev/null 2>&1; then
      echo "  ✅ PostgreSQL disponível após ${i}s"
      break
    fi
    sleep 1
  done
else
  echo "  → PostgreSQL não existe. Executa primeiro: npm run staging:setup"
  exit 1
fi

# Arrancar servidor Next.js
if [ -f /tmp/eternal-staging-pid.txt ]; then
  OLD_PID=$(cat /tmp/eternal-staging-pid.txt)
  kill "$OLD_PID" 2>/dev/null || true
  rm -f /tmp/eternal-staging-pid.txt
fi

cd "$PROJECT_DIR"
npx next start -p "$APP_PORT" &>/tmp/eternal-staging-server.log &
echo $! > /tmp/eternal-staging-pid.txt

# Aguardar servidor
for i in $(seq 1 30); do
  if curl -s -o /dev/null -w '' http://127.0.0.1:$APP_PORT/pt 2>/dev/null; then
    echo "  ✅ Servidor disponível após ${i}s"
    echo ""
    echo "  http://127.0.0.1:$APP_PORT"
    echo "  http://127.0.0.1:$APP_PORT/admin"
    exit 0
  fi
  sleep 1
done

echo "  ❌ Servidor não respondeu após 30s"
cat /tmp/eternal-staging-server.log | tail -10
exit 1