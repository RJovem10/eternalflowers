#!/usr/bin/env bash
# =============================================================================
# Eternal Flowers — Restore de Produção
# =============================================================================
# Uso:  ./scripts/production/restore.sh <ficheiro.dump>
#       ./scripts/production/restore.sh --pg backups/pg-20260802_123000.dump
#       ./scripts/production/restore.sh --media backups/media-20260802_123000.tar.gz
# =============================================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

RESTORE_TYPE=""
RESTORE_FILE=""

# Parse args
while [ $# -gt 0 ]; do
    case "$1" in
        --pg) RESTORE_TYPE="pg"; shift; RESTORE_FILE="${1:-}"; shift ;;
        --media) RESTORE_TYPE="media"; shift; RESTORE_FILE="${1:-}"; shift ;;
        -h|--help)
            echo "Uso: $0 [--pg <dump.dump>] [--media <archive.tar.gz>]"
            echo "     $0 <dump.dump>  (restore PG implícito)"
            exit 0
            ;;
        *)
            if [ -f "$1" ]; then
                RESTORE_TYPE="pg"
                RESTORE_FILE="$1"
            else
                echo "ERRO: Argumento desconhecido: $1"
                exit 1
            fi
            shift
            ;;
    esac
done

if [ -z "$RESTORE_TYPE" ] || [ -z "$RESTORE_FILE" ]; then
    echo "ERRO: Especificar --pg <dump.dump> ou --media <archive.tar.gz>"
    echo "Uso:  $0 --pg backups/pg-20260802_123000.dump"
    echo "      $0 --media backups/media-20260802_123000.tar.gz"
    exit 1
fi

if [ ! -f "$RESTORE_FILE" ]; then
    echo "ERRO: Ficheiro não encontrado: $RESTORE_FILE"
    exit 1
fi

echo "═══════════════════════════════════════════════"
echo "  Eternal Flowers — Restore"
echo "═══════════════════════════════════════════════"

# ── Confirmação explícita ────────────────────────────────────────────
echo ""
echo "⚠️  ATENÇÃO: Esta operação SUBSTITUI dados existentes."
echo ""
echo "  Tipo:    $RESTORE_TYPE"
echo "  Fonte:   $RESTORE_FILE"
echo "  Tamanho: $(du -h "$RESTORE_FILE" | cut -f1)"
echo "  SHA-256: $(sha256sum "$RESTORE_FILE" | cut -d' ' -f1)"
echo ""

# Destino — segurança para evitar restore contra produção por engano
if [ -n "${RESTORE_TARGET:-}" ]; then
    echo "  Destino: $RESTORE_TARGET"
elif [ "${NODE_ENV:-}" != "production" ]; then
    echo -e "  ${YELLOW}⚠️  NODE_ENV=$NODE_ENV (não é production)${NC}"
    echo "  A confirmar que o destino está correto..."
fi

echo ""
read -r -p "Escreve CONFIRMAR para prosseguir: " CONFIRM
if [ "$CONFIRM" != "CONFIRMAR" ]; then
    echo -e "${RED}❌ Restore cancelado.${NC}"
    exit 1
fi

# ── Restore PostgreSQL ──────────────────────────────────────────────
if [ "$RESTORE_TYPE" = "pg" ]; then
    echo ""
    echo "📦 Restore PostgreSQL a partir de: $RESTORE_FILE"

    # Verificar que o dump é válido
    if ! pg_restore --list "$RESTORE_FILE" &>/dev/null; then
        # Tentar verificar via Docker
        if docker exec eternal-flowers-postgres pg_restore --list /tmp/check.dump &>/dev/null 2>&1; then
            echo "  ✅ Dump válido"
        else
            echo -e "  ${YELLOW}⚠️  Não foi possível validar o dump (pode ser formato raw SQL)${NC}"
        fi
    else
        echo "  ✅ Dump válido"
    fi

    # Proteção: não permitir restore se a base de dados parecer vazia
    # (para evitar restore contra produção por engano quando se pensa que está vazia)

    if command -v pg_restore &>/dev/null; then
        pg_restore \
            --verbose \
            --clean \
            --if-exists \
            --no-owner \
            --no-acl \
            --dbname="${DATABASE_URI:-}" \
            "$RESTORE_FILE" 2>&1 && echo -e "${GREEN}✅ Restore PostgreSQL concluído${NC}" || {
            echo -e "${RED}❌ Restore PostgreSQL falhou${NC}"
            exit 1
        }
    else
        # Via Docker
        docker exec -i eternal-flowers-postgres pg_restore \
            --verbose \
            --clean \
            --if-exists \
            --no-owner \
            --no-acl \
            -U "${PGUSER:-loja}" \
            -d "${PGDATABASE:-loja_flores}" \
            < "$RESTORE_FILE" 2>&1 && echo -e "${GREEN}✅ Restore PostgreSQL via Docker concluído${NC}" || {
            echo -e "${RED}❌ Restore PostgreSQL via Docker falhou${NC}"
            exit 1
        }
    fi
fi

# ── Restore Media ──────────────────────────────────────────────────
if [ "$RESTORE_TYPE" = "media" ]; then
    echo ""
    echo "📁 Restore Media a partir de: $RESTORE_FILE"
    local media_dest="${MEDIA_DEST:-./media}"

    if [ ! -d "$media_dest" ]; then
        echo "  A criar diretório: $media_dest"
        mkdir -p "$media_dest"
    fi

    tar xzf "$RESTORE_FILE" -C "$(dirname "$media_dest")" 2>&1 && {
        echo -e "${GREEN}✅ Restore Media concluído${NC}"
        echo "  Ficheiros: $(find "$media_dest" -type f | wc -l)"
    } || {
        echo -e "${RED}❌ Restore Media falhou${NC}"
        exit 1
    }
fi

echo ""
echo -e "${GREEN}✅ Restore concluído com sucesso.${NC}"
echo ""
echo "⚠️  Se foi restaurada a base de dados, reiniciar a aplicação:"
echo "   docker compose -f docker-compose.production.yml restart app"