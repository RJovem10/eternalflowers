#!/usr/bin/env bash
# =============================================================================
# Eternal Flowers — Preflight de Produção
# =============================================================================
# Valida o ambiente antes do cutover ou após deployment.
# Read-only — não modifica o sistema.
# =============================================================================
set -euo pipefail

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color
PASS=0
FAIL=0
WARN=0

check() {
    local desc="$1" result="$2"
    if [ "$result" = "pass" ]; then
        echo -e "  ${GREEN}✅${NC} $desc"
        PASS=$((PASS + 1))
    elif [ "$result" = "warn" ]; then
        echo -e "  ${YELLOW}⚠️${NC} $desc"
        WARN=$((WARN + 1))
    else
        echo -e "  ${RED}❌${NC} $desc — $3"
        FAIL=$((FAIL + 1))
    fi
}

echo "═══════════════════════════════════════════════"
echo "  Eternal Flowers — Preflight de Produção"
echo "═══════════════════════════════════════════════"

MODE="${PREFLIGHT_MODE:-preparation}"
echo "  Modo: $MODE"
echo ""

# ── 1. Variáveis obrigatórias ──────────────────────────────────────────
echo "📋 1. Variáveis de ambiente"

# NODE_ENV
if [ "${NODE_ENV:-}" = "production" ]; then
    check "NODE_ENV=production" "pass"
elif [ "$MODE" = "preparation" ]; then
    check "NODE_ENV=production (definir no cutover)" "warn"
else
    check "NODE_ENV=production" "fail" "Definir NODE_ENV=production (atual: ${NODE_ENV:-vazio})"
fi

# DATABASE_URI
DB_URI="${DATABASE_URI:-}"
if [ -z "$DB_URI" ]; then
    if [ "$MODE" = "preparation" ]; then
        check "DATABASE_URI definida (definir no cutover)" "warn"
    else
        check "DATABASE_URI definida" "fail" "Variável DATABASE_URI não definida"
    fi
elif echo "$DB_URI" | grep -qiE '<DEFINIR|<GERAR|placeholder|change_me|muda_isto|dev-secret'; then
    check "DATABASE_URI sem placeholder" "fail" "DATABASE_URI contém placeholder"
elif echo "$DB_URI" | grep -q "^postgresql://"; then
    check "DATABASE_URI PostgreSQL" "pass"
else
    check "DATABASE_URI PostgreSQL" "fail" "DATABASE_URI deve começar por postgresql://"
fi

# PAYLOAD_SECRET
PS="${PAYLOAD_SECRET:-}"
if [ -z "$PS" ]; then
    if [ "$MODE" = "preparation" ]; then
        check "PAYLOAD_SECRET definido (definir no cutover)" "warn"
    else
        check "PAYLOAD_SECRET definido" "fail" "PAYLOAD_SECRET não definido"
    fi
elif [ "${#PS}" -lt 20 ]; then
    check "PAYLOAD_SECRET comprimento mínimo" "warn" "Apenas ${#PS} caracteres (recomendado >= 32)"
elif echo "$PS" | grep -qiE '<DEFINIR|<GERAR|placeholder|change_me|muda_isto|dev-secret'; then
    check "PAYLOAD_SECRET sem placeholder" "fail" "PAYLOAD_SECRET contém placeholder"
else
    check "PAYLOAD_SECRET (${#PS} chars)" "pass"
fi

# Domínio
SITE_URL="${NEXT_PUBLIC_SITE_URL:-}"
if [ -z "$SITE_URL" ]; then
    if [ "$MODE" = "preparation" ]; then
        check "NEXT_PUBLIC_SITE_URL definido (definir no cutover)" "warn"
    else
        check "NEXT_PUBLIC_SITE_URL definido" "fail" "NEXT_PUBLIC_SITE_URL não definido"
    fi
elif echo "$SITE_URL" | grep -qiE '<DEFINIR|<DOMINIO|localhost'; then
    check "NEXT_PUBLIC_SITE_URL com domínio real" "fail" "Usa placeholder ou localhost: $SITE_URL"
else
    check "NEXT_PUBLIC_SITE_URL ($SITE_URL)" "pass"
fi

SERVER_URL="${NEXT_PUBLIC_SERVER_URL:-}"
if [ "$SERVER_URL" != "$SITE_URL" ]; then
    check "NEXT_PUBLIC_SERVER_URL coincide com SITE_URL" "warn" "Diferente: $SERVER_URL vs $SITE_URL"
else
    check "NEXT_PUBLIC_SERVER_URL = SITE_URL" "pass"
fi

# ── 2. Docker ──────────────────────────────────────────────────────────
echo ""
echo "🐳 2. Docker"

if command -v docker &>/dev/null; then
    check "Docker instalado" "pass"
else
    check "Docker instalado" "fail" "docker não encontrado no PATH"
fi

if command -v docker &>/dev/null && docker compose version &>/dev/null; then
    check "Docker Compose (plugin)" "pass"
elif command -v docker-compose &>/dev/null; then
    check "Docker Compose (standalone)" "pass"
else
    check "Docker Compose disponível" "fail" "Nem 'docker compose' nem 'docker-compose' encontrados"
fi

# ── 3. Ficheiros ──────────────────────────────────────────────────────
echo ""
echo "📁 3. Ficheiros"

if [ "$MODE" = "cutover" ]; then
    # Modo cutover: ficheiros reais são obrigatórios
    if [ -f "docker-compose.production.yml" ]; then
        check "docker-compose.production.yml existe" "pass"
    else
        check "docker-compose.production.yml existe" "fail" "Criar a partir de .example.yml antes do cutover"
    fi
    if [ -f ".env.production" ]; then
        check ".env.production existe" "pass"
    else
        check ".env.production existe" "fail" "Criar a partir de .example antes do cutover"
    fi
    if [ -f "./Caddyfile" ]; then
        check "Caddyfile root existe" "pass"
    else
        check "Caddyfile root existe" "fail" "Criar Caddyfile no root antes do cutover"
    fi
else
    # Modo preparation: templates exemplo são suficientes
    if [ -f "docker-compose.production.yml" ]; then
        check "Compose production versionado existe" "pass"
    else
        check "Compose production versionado existe" "warn" "Ainda não criado"
    fi
    if [ -f "./Caddyfile" ]; then
        check "Caddyfile versionado existe" "pass"
    elif [ -f "configs/production/Caddyfile.example" ]; then
        check "Template Caddyfile existe" "pass"
    fi
fi

# Media (verificar sempre)
MEDIA_COUNT=$(ls media/ 2>/dev/null | wc -l)
if [ "$MEDIA_COUNT" -ge 11 ]; then
    check "Media ($MEDIA_COUNT ficheiros)" "pass"
elif [ "$MEDIA_COUNT" -gt 0 ]; then
    check "Media ($MEDIA_COUNT ficheiros)" "warn" "Esperados pelo menos 11"
else
    check "Media disponíveis" "warn" "Diretório media/ vazio ou não encontrado"
fi

# ── 4. Segurança ───────────────────────────────────────────────────────
echo ""
echo "🔒 4. Segurança"

# Verificar portas expostas no compose
COMPOSE_FILE="docker-compose.production.yml"
if [ -f "$COMPOSE_FILE" ]; then
    if grep -qE '"port":\s*"[0-9]+:[0-9]+"' <(docker compose -f "$COMPOSE_FILE" config 2>/dev/null) 2>/dev/null; then
        check "Portas expostas no compose" "warn" "Há portas públicas — verificar se é intencional"
    fi
fi

# Verificar se há passwords default em ficheiros versionados
PW_FILES=$(grep -rE 'muda_isto|change_me|staging_password|Admin123' \
    --include='*.yml' --include='*.yaml' --include='*.sh' --include='*.ts' --include='*.example' \
    -l . 2>/dev/null | grep -v node_modules | grep -v '.git/' | grep -v 'scripts/production/preflight.sh' || true)
if [ -n "$PW_FILES" ]; then
    if [ "$MODE" = "cutover" ]; then
        check "Sem passwords default em ficheiros versionados" "fail" "Ainda existem placeholders em: $(echo "$PW_FILES" | tr '\n' ' ')"
    else
        check "Sem passwords default em ficheiros versionados" "warn" "Existem placeholders em ficheiros tracked"
    fi
else
    check "Sem passwords default em ficheiros versionados" "pass"
fi

# ── 5. Git ─────────────────────────────────────────────────────────────
echo ""
echo "📦 5. Git"

if git rev-parse --git-dir &>/dev/null; then
    BRANCH=$(git rev-parse --abbrev-ref HEAD)
    COMMIT=$(git rev-parse --short HEAD)
    check "Branch: $BRANCH @ $COMMIT" "pass"
    if [ "$BRANCH" != "main" ] && [ "$BRANCH" != "release/issue-016-019" ]; then
        check "Branch de release" "warn" "Branch atual: $BRANCH (não é main nem release)"
    fi
fi

# ── Resumo ─────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════"
echo "  RESUMO"
echo "═══════════════════════════════════════════════"
echo ""
echo "  ✅ Pass: $PASS"
echo "  ⚠️  Warn: $WARN"
echo "  ❌ Fail: $FAIL"
echo ""

if [ "$FAIL" -gt 0 ]; then
    echo "  ❌ NO-GO — Corrigir as falhas antes do cutover."
    exit 1
elif [ "$WARN" -gt 0 ]; then
    echo "  ⚠️  GO CONDICIONAL — $WARN aviso(s). Rever antes de prosseguir."
    exit 0
else
    echo "  ✅ GO — Todos os critérios cumprem."
    exit 0
fi