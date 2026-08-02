#!/usr/bin/env bash
# scripts/staging/start.sh — Arrancar o ambiente de staging
#
# Uso:
#   bash scripts/staging/start.sh
#
# Requer que o setup.sh já tenha sido executado pelo menos uma vez.
# Arranca o PostgreSQL (+ aplicação via Docker Compose).
#
set -euo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null || echo "${BASH_SOURCE[0]%/*}/../..")"

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "  ${GREEN}✅${NC} $1"; }
fail() { echo -e "  ${RED}❌${NC} $1"; exit 1; }
info() { echo -e "  ${CYAN}→${NC} $1"; }

echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}  Eternal Flowers — Staging Start      ${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"

# Verificar se o container DB existe
if ! docker ps -a --format '{{.Names}}' | grep -q '^eternal-flowers-staging-db$'; then
  fail "Container staging não encontrado. Execute 'bash scripts/staging/setup.sh' primeiro."
fi

# Arrancar PostgreSQL se parado
if ! docker ps --format '{{.Names}}' | grep -q '^eternal-flowers-staging-db$'; then
  info "A arrancar PostgreSQL..."
  docker start eternal-flowers-staging-db >/dev/null
  ok "PostgreSQL arrancado"
else
  ok "PostgreSQL já está em execução"
fi

# Carregar env
if [ -f .env.staging.local ]; then
  set -a; source .env.staging.local; set +a
fi

APP_PORT="${STAGING_APP_PORT:-3003}"
PG_URI="${DATABASE_URI:-postgresql://staging:staging_password_change_me@127.0.0.1:55433/eternal_flowers_staging}"

# Arrancar servidor Next.js
if [ -f /tmp/eternal-staging-pid.txt ]; then
  OLD_PID=$(cat /tmp/eternal-staging-pid.txt)
  if kill -0 "$OLD_PID" 2>/dev/null; then
    info "Servidor já está em execução (PID $OLD_PID)"
    echo ""
    echo "  http://127.0.0.1:$APP_PORT"
    echo "  http://127.0.0.1:$APP_PORT/admin"
    exit 0
  fi
fi

info "A iniciar servidor em 127.0.0.1:$APP_PORT..."
NODE_ENV=production DATABASE_URI="$PG_URI" nohup npx next start -p "$APP_PORT" > /tmp/eternal-staging-server.log 2>&1 &
echo $! > /tmp/eternal-staging-pid.txt

for i in $(seq 1 30); do
  if curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$APP_PORT/pt" 2>/dev/null | grep -q '200'; then
    ok "Servidor disponível após ${i}s"
    echo ""
    echo "  http://127.0.0.1:$APP_PORT"
    echo "  http://127.0.0.1:$APP_PORT/admin"
    exit 0
  fi
  sleep 1
done

fail "Servidor não respondeu após 30s"