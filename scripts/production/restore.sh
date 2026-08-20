#!/usr/bin/env bash
# =============================================================================
# Eternal Flowers — Restore de Produção
# =============================================================================
# Uso:
#   ./scripts/production/restore.sh --pg <dump.dump>
#   ./scripts/production/restore.sh --media <archive.tar.gz>
#
# NÃO EXECUTAR AUTOMATICAMENTE.
# Requer confirmação explícita "CONFIRMAR".
#
# Destino:
#   PostgreSQL: via pg_restore --clean contra o container postgres
#   Media:      via tar extraído e copiado para app:/app/media
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_WRAPPER="${SCRIPT_DIR}/compose.sh"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

RESTORE_TYPE=""
RESTORE_FILE=""

while [ $# -gt 0 ]; do
    case "$1" in
        --pg)    RESTORE_TYPE="pg"; shift; RESTORE_FILE="${1:-}"; shift ;;
        --media) RESTORE_TYPE="media"; shift; RESTORE_FILE="${1:-}"; shift ;;
        -h|--help)
            echo "Uso: $0 --pg <dump.dump>"
            echo "     $0 --media <archive.tar.gz>"
            exit 0 ;;
        *)
            if [ -f "$1" ]; then
                RESTORE_TYPE="pg"; RESTORE_FILE="$1"
            else echo "ERRO: $1"; exit 1; fi
            shift ;;
    esac
done

if [ -z "$RESTORE_TYPE" ] || [ -z "$RESTORE_FILE" ] || [ ! -f "$RESTORE_FILE" ]; then
    echo "ERRO: Especificar --pg <dump.dump> ou --media <archive.tar.gz>"
    exit 1
fi

echo "═══════════════════════════════════════════════"
echo "  Eternal Flowers — Restore"
echo "═══════════════════════════════════════════════"
echo ""
echo "⚠️  ATENÇÃO: Esta operação SUBSTITUI dados existentes."
echo ""
echo "  Tipo:    $RESTORE_TYPE"
echo "  Fonte:   $RESTORE_FILE"
echo "  Tamanho: $(du -h "$RESTORE_FILE" | cut -f1)"
echo "  SHA-256: $(sha256sum "$RESTORE_FILE" | cut -d' ' -f1)"
echo ""
read -r -p "Escreve CONFIRMAR para prosseguir: " CONFIRM
if [ "$CONFIRM" != "CONFIRMAR" ]; then
    echo -e "${RED}❌ Restore cancelado.${NC}"; exit 1
fi

# ── PostgreSQL ──────────────────────────────────────────────────────────
if [ "$RESTORE_TYPE" = "pg" ]; then
    echo ""; echo "📦 Restore PostgreSQL..."

    # Validar dump
    if command -v pg_restore &>/dev/null; then
        pg_restore --list "$RESTORE_FILE" >/dev/null 2>&1 && echo "  ✅ Dump válido" || {
            echo -e "  ${YELLOW}⚠️  Não foi possível validar o dump${NC}"
        }
    fi

    # Restore via container usando compose wrapper
    # Copiar dump para o container e executar pg_restore
    local tmp_restore="/tmp/restore-pg.$$.dump"
    "${COMPOSE_WRAPPER}" cp "$RESTORE_FILE" "postgres:${tmp_restore}" 2>/dev/null || {
        # Fallback: docker cp directly
        local cid; cid=$("${COMPOSE_WRAPPER}" ps -q postgres 2>/dev/null)
        docker cp "$RESTORE_FILE" "${cid}:${tmp_restore}" >/dev/null 2>&1
    }

    if "${COMPOSE_WRAPPER}" exec -T postgres pg_restore \
        --verbose --clean --if-exists --no-owner --no-acl \
        -U "${PGUSER:-loja}" -d "${PGDATABASE:-loja_flores}" \
        "${tmp_restore}" 2>&1; then
        echo -e "${GREEN}✅ Restore PostgreSQL concluído${NC}"
    else
        echo -e "${RED}❌ Restore PostgreSQL falhou${NC}"
        "${COMPOSE_WRAPPER}" exec -T postgres rm -f "${tmp_restore}" 2>/dev/null || true
        exit 1
    fi
    "${COMPOSE_WRAPPER}" exec -T postgres rm -f "${tmp_restore}" 2>/dev/null || true
fi

# ── Media ──────────────────────────────────────────────────────────────
if [ "$RESTORE_TYPE" = "media" ]; then
    echo ""; echo "📁 Restore Media para app:/app/media..."

    # Extrair para diretório temporário no host
    local tmp_media_dir
    tmp_media_dir=$(mktemp -d)
    tar xzf "$RESTORE_FILE" -C "$tmp_media_dir" 2>&1 && echo "  Media extraída" || {
        echo -e "${RED}❌ Falha ao extrair archive${NC}"; rm -rf "$tmp_media_dir"; exit 1
    }

    # Copiar para o container app usando compose wrapper
    "${COMPOSE_WRAPPER}" cp "${tmp_media_dir}/media/." "app:/app/media/" 2>/dev/null && {
        echo -e "${GREEN}✅ Restore Media concluído${NC}"
    } || {
        local cid; cid=$("${COMPOSE_WRAPPER}" ps -q app 2>/dev/null)
        if [ -n "$cid" ]; then
            docker cp "${tmp_media_dir}/media/." "${cid}:/app/media/" >/dev/null 2>&1 && {
                echo -e "${GREEN}✅ Restore Media concluído (fallback docker cp)${NC}"
            } || {
                echo -e "${RED}❌ Restore Media falhou${NC}"
                rm -rf "$tmp_media_dir"; exit 1
            }
        else
            echo -e "${RED}❌ Restore Media falhou — container app não encontrado${NC}"
            rm -rf "$tmp_media_dir"; exit 1
        fi
    }
    rm -rf "$tmp_media_dir"
fi

echo ""
echo -e "${GREEN}✅ Restore concluído com sucesso.${NC}"
echo ""
echo "⚠️  Se foi restaurada a base de dados, reiniciar a aplicação:"
echo "   ${COMPOSE_WRAPPER} restart app"