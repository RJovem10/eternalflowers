#!/usr/bin/env bash
# scripts/staging/stop.sh — Parar o ambiente de staging
#
# Uso:
#   bash scripts/staging/stop.sh
#
# Para o servidor Next.js e o PostgreSQL.
# Dados preservados no volume Docker.
set -euo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null || echo "${BASH_SOURCE[0]%/*}/../..")"

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "  ${GREEN}✅${NC} $1"; }
info() { echo -e "  ${CYAN}→${NC} $1"; }

echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}  Eternal Flowers — Staging Stop        ${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"

# Parar servidor Next.js
if [ -f /tmp/eternal-staging-pid.txt ]; then
  PID=$(cat /tmp/eternal-staging-pid.txt)
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null || true
    sleep 1
    if ! kill -0 "$PID" 2>/dev/null; then
      ok "Servidor Next.js (PID $PID) parado"
    else
      kill -9 "$PID" 2>/dev/null || true
      ok "Servidor Next.js (PID $PID) forçado"
    fi
  else
    info "Servidor Next.js já não está em execução"
  fi
  rm -f /tmp/eternal-staging-pid.txt
else
  info "Servidor Next.js não estava registado"
fi

# Parar PostgreSQL
if docker ps --format '{{.Names}}' | grep -q '^eternal-flowers-staging-db$'; then
  docker stop eternal-flowers-staging-db >/dev/null
  ok "PostgreSQL parado"
else
  info "PostgreSQL já está parado"
fi

echo ""
echo "  Dados preservados no volume eternal-flowers-staging-postgres-data."
echo "  Para retomar: bash scripts/staging/start.sh"
echo ""