#!/usr/bin/env bash
# scripts/staging/status.sh — Estado do ambiente de staging
#
# Uso:
#   bash scripts/staging/status.sh
set -euo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null || echo "${BASH_SOURCE[0]%/*}/../..")"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "  ${GREEN}✅${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠️${NC} $1"; }
info() { echo -e "  ${CYAN}→${NC} $1"; }

echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}  Eternal Flowers — Staging Status      ${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"

# ─── PostgreSQL ────────────────────────────────
if docker ps --format '{{.Names}}' | grep -q '^eternal-flowers-staging-db$'; then
  ok "PostgreSQL em execução"
  docker exec eternal-flowers-staging-db psql -U staging -d eternal_flowers_staging -c "
    SELECT 'media' AS t, COUNT(*) FROM media
    UNION ALL SELECT 'categories', COUNT(*) FROM categories
    UNION ALL SELECT 'collections', COUNT(*) FROM collections
    UNION ALL SELECT 'flowers', COUNT(*) FROM flowers
    UNION ALL SELECT 'homepage', COUNT(*) FROM homepage
    ORDER BY t;
  " 2>/dev/null || warn "Não foi possível consultar dados"
else
  warn "PostgreSQL parado"
  if docker ps -a --format '{{.Names}}' | grep -q '^eternal-flowers-staging-db$'; then
    info "Container existe mas está parado"
  else
    warn "Container não existe — executar setup.sh primeiro"
  fi
fi

# ─── Volume ────────────────────────────────────
if docker volume ls --format '{{.Name}}' | grep -q '^eternal-flowers-staging-postgres-data$'; then
  ok "Volume PostgreSQL presente"
fi
if docker volume ls --format '{{.Name}}' | grep -q '^eternal-flowers-staging-media$'; then
  ok "Volume Media presente"
fi

# ─── Rede ──────────────────────────────────────
if docker network ls --format '{{.Name}}' | grep -q '^eternal-flowers-staging-network$'; then
  ok "Rede staging presente"
fi

# ─── Servidor ──────────────────────────────────
if [ -f /tmp/eternal-staging-pid.txt ]; then
  PID=$(cat /tmp/eternal-staging-pid.txt)
  if kill -0 "$PID" 2>/dev/null; then
    ok "Servidor Next.js em execução (PID $PID)"
    PORT="${STAGING_APP_PORT:-3003}"
    CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/pt" 2>/dev/null || echo "000")
    if [ "$CODE" = "200" ]; then
      ok "HTTP 200 em /pt"
    else
      warn "HTTP $CODE em /pt"
    fi
  else
    warn "Servidor Next.js registado mas não está a correr (PID $PID inactivo)"
    rm -f /tmp/eternal-staging-pid.txt
  fi
else
  warn "Servidor Next.js não está em execução"
fi

# ─── Media ─────────────────────────────────────
if [ -d media-staging ]; then
  CNT=$(ls -1 media-staging 2>/dev/null | wc -l)
  ok "Media-staging: $CNT ficheiros"
else
  warn "Diretório media-staging não existe"
fi

# ─── Env ───────────────────────────────────────
if [ -f .env.staging.local ]; then
  ok ".env.staging.local presente"
else
  warn ".env.staging.local não encontrado"
fi

echo ""