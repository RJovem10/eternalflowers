#!/usr/bin/env bash
# scripts/staging/teardown.sh — Remover ambiente de staging
#
# Uso:
#   bash scripts/staging/teardown.sh          # Remove containers, preserva dados
#   bash scripts/staging/teardown.sh --purge  # Remove containers + volumes + dados
#   bash scripts/staging/teardown.sh --help   # Esta mensagem
#
# NUNCA executa docker system prune ou docker volume prune.
# Actua apenas em recursos com prefixo eternal-flowers-staging-*.
set -euo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null || echo "${BASH_SOURCE[0]%/*}/../..")"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "  ${GREEN}✅${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠️${NC} $1"; }
info() { echo -e "  ${CYAN}→${NC} $1"; }

PREFIX="eternal-flowers-staging"

if [ "${1:-}" = "--help" ]; then
  sed -n '2,12p' "$0"
  exit 0
fi

PURGE=false
if [ "${1:-}" = "--purge" ]; then
  echo ""
  echo -e "${RED}═══════════════════════════════════════════${NC}"
  echo -e "${RED}  ATENÇÃO: PURGE — TODOS OS DADOS PERDIDOS ${NC}"
  echo -e "${RED}═══════════════════════════════════════════${NC}"
  echo ""
  echo -e "  Isto irá REMOVER:"
  echo "    - Container(s) ${PREFIX}-*"
  echo "    - Rede ${PREFIX}-network"
  echo "    - Volumes ${PREFIX}-* (DADOS PERDIDOS)"
  echo ""
  read -rp "  Escreva PURGE para confirmar: " CONFIRM
  if [ "$CONFIRM" != "PURGE" ]; then
    echo "  Cancelado."
    exit 0
  fi
  PURGE=true
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}  Eternal Flowers — Staging Teardown    ${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"

# Parar servidor Next.js
if [ -f /tmp/eternal-staging-pid.txt ]; then
  PID=$(cat /tmp/eternal-staging-pid.txt)
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null || true
    sleep 1
    kill -9 "$PID" 2>/dev/null || true
    ok "Servidor Next.js (PID $PID) parado"
  fi
  rm -f /tmp/eternal-staging-pid.txt
fi

# Parar e remover containers com prefixo staging
for CONTAINER in $(docker ps -a --format '{{.Names}}' | grep "^${PREFIX}-"); do
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  ok "Container $CONTAINER removido"
done

# Remover rede
if docker network ls --format '{{.Name}}' | grep -q "^${PREFIX}-network$"; then
  docker network rm "${PREFIX}-network" >/dev/null 2>&1 || true
  ok "Rede ${PREFIX}-network removida"
fi

if [ "$PURGE" = true ]; then
  # Remover volumes
  for VOL in $(docker volume ls --format '{{.Name}}' | grep "^${PREFIX}-"); do
    docker volume rm "$VOL" >/dev/null 2>&1 || true
    ok "Volume $VOL removido"
  done

  # Remover media-staging
  if [ -d media-staging ]; then
    rm -rf media-staging
    ok "Diretório media-staging removido"
  fi

  # Remover .env.staging.local
  if [ -f .env.staging.local ]; then
    rm -f .env.staging.local
    ok ".env.staging.local removido"
  fi

  echo ""
  echo -e "  ${RED}Purge completo — todos os dados de staging eliminados.${NC}"
else
  echo ""
  info "Dados preservados nos volumes Docker."
  info "Para recuperar: bash scripts/staging/start.sh"
  info "Para eliminar dados: bash scripts/staging/teardown.sh --purge"
fi
echo ""