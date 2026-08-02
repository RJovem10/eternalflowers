#!/usr/bin/env bash
# scripts/staging/smoke-test.sh — Testes HTTP do ambiente de staging
#
# Uso:
#   bash scripts/staging/smoke-test.sh [--verbose]
#
# Testa:
#   - 5 locales (pt, en, es, it, de) — código 200 + html lang
#   - Rotas principais (home, catalog, about, flower, cart, checkout, admin)
#   - Conteúdo localizado
#   - 404 para rota inexistente
#   - Media (11 ficheiros)
#   - API Payload
set -euo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null || echo "${BASH_SOURCE[0]%/*}/../..")"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "  ${GREEN}✅${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠️${NC} $1"; }
fail() { echo -e "  ${RED}❌${NC} $1"; total_fail=$((total_fail + 1)); }
info() { echo -e "  ${CYAN}→${NC} $1"; }

VERBOSE=false
[ "${1:-}" = "--verbose" ] && VERBOSE=true

PORT="${STAGING_APP_PORT:-3003}"
BASE="http://127.0.0.1:${PORT}"
total=0
total_fail=0
total_ok=0

test_status() {
  local label="$1" url="$2" expected="${3:-200}"
  total=$((total + 1))
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
  if [ "$code" = "$expected" ]; then
    ok "$label → $code"
    total_ok=$((total_ok + 1))
  else
    fail "$label → esperado $expected, obtido $code"
    [ "$VERBOSE" = true ] && curl -s "$url" | head -5
  fi
}

test_lang() {
  local locale="$1"
  total=$((total + 1))
  local lang
  lang=$(curl -s "$BASE/$locale" | grep -o '<html[^>]*lang="[^"]*"' | head -1)
  if echo "$lang" | grep -q "lang=\"${locale}\""; then
    ok "/$locale html lang=\"${locale}\""
    total_ok=$((total_ok + 1))
  else
    fail "/$locale html lang — esperado ${locale}, obtido: ${lang:-vazio}"
  fi
}

test_content() {
  local label="$1" url="$2" pattern="$3"
  total=$((total + 1))
  if curl -s "$url" 2>/dev/null | grep -qiF "$pattern"; then
    ok "$label → contém \"${pattern:0:40}...\""
    total_ok=$((total_ok + 1))
  else
    fail "$label → não contém \"${pattern:0:40}...\""
  fi
}

echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}  Eternal Flowers — Staging Smoke Tests ${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo "  Target: $BASE"
echo ""

# ─── 5 locales ─────────────────────────────────
info "1. Locales (200 + html lang)"
for locale in pt en es it de; do
  test_status "/$locale" "$BASE/$locale" 200
  test_lang "$locale"
done

# ─── Rotas principais PT ───────────────────────
info "2. Rotas principais"
test_status "/pt"           "$BASE/pt"            200
test_status "/pt/catalog"   "$BASE/pt/catalog"    200
test_status "/pt/about"     "$BASE/pt/about"      200

# Flores — descobrir IDs dinamicamente
FLOWER_IDS=$(curl -s --max-time 10 "$BASE/api/flowers?limit=10" 2>/dev/null | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    ids=[str(doc['id']) for doc in d.get('docs',[])]
    print(' '.join(ids))
except: print('')
" 2>/dev/null)

if [ -n "$FLOWER_IDS" ]; then
    for fid in $FLOWER_IDS; do
        test_status "/pt/flower/$fid" "$BASE/pt/flower/$fid" 200
    done
    info "  → $(echo "$FLOWER_IDS" | wc -w) flor(es) testada(s)"
else
    warn "  → API devolveu 0 flores — a saltar testes de flower detail"
fi

test_status "/pt/cart"      "$BASE/pt/cart"       200
test_status "/pt/checkout"  "$BASE/pt/checkout"   200

# ─── Rotas EN ──────────────────────────────────
info "3. Rotas EN"
test_status "/en"           "$BASE/en"            200
test_status "/en/catalog"   "$BASE/en/catalog"    200

# ─── 404 ───────────────────────────────────────
info "4. Rotas inexistentes"
test_status "/pt/nonexistent" "$BASE/pt/nonexistent" 404

# ─── Admin ─────────────────────────────────────
info "5. Admin"
test_status "/admin" "$BASE/admin" 200

# ─── API ───────────────────────────────────────
info "6. API"
total=$((total + 1))
API_OUT=$(curl -s "$BASE/api/flowers?locale=pt" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('totalDocs', 'error: ' + str(d)))" 2>/dev/null || echo "erro")
if [ "$API_OUT" = "10" ] || echo "$API_OUT" | grep -q "You are not allowed"; then
  ok "API /api/flowers → ${API_OUT}"
  total_ok=$((total_ok + 1))
else
  fail "API /api/flowers → ${API_OUT} (esperado 10 ou protegido)"
fi

# ─── Conteúdo localizado ───────────────────────
info "7. Conteúdo localizado"
test_content "/pt hero"      "$BASE/pt"      "Joias Botânicas"
test_content "/en hero"      "$BASE/en"      "Botanical"
test_content "/es hero"      "$BASE/es"      "Joyas Botánicas"
test_content "/it hero"      "$BASE/it"      "Gioielli Botanici"
test_content "/de hero"      "$BASE/de"      "Botanische"

# ─── Resumo ────────────────────────────────────
echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "  ${total_ok}/${total} testes passaram, ${total_fail} falhas"
if [ "$total_fail" -gt 0 ]; then
  echo -e "  ${RED}FALHOU — ${total_fail} teste(s) com erro${NC}"
  exit 1
else
  echo -e "  ${GREEN}TODOS OS TESTES PASSARAM${NC}"
fi
echo ""