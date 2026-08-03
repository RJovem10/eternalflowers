#!/usr/bin/env bash
# =============================================================================
# Eternal Flowers — Backup de Produção
# =============================================================================
# Uso:  ./scripts/production/backup.sh
#       ./scripts/production/backup.sh --pg-only
#       ./scripts/production/backup.sh --media-only
#
# Usa docker compose exec para pg_dump — sem dependência de ferramentas no host.
# =============================================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
MANIFEST="$BACKUP_DIR/manifest-$TIMESTAMP.txt"
PG_ONLY=false
MEDIA_ONLY=false
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.production.yml}"

for arg in "$@"; do
    case "$arg" in
        --pg-only) PG_ONLY=true ;;
        --media-only) MEDIA_ONLY=true ;;
        *) echo "Opcao desconhecida: $arg"; exit 1 ;;
    esac
done

if $PG_ONLY && $MEDIA_ONLY; then
    echo "ERRO: --pg-only e --media-only sao mutuamente exclusivos."
    exit 1
fi

RED='\033[0;31m'; GREEN='\033[0;32m'; NC='\033[0m'

echo "═══════════════════════════════════════════════"
echo "  Eternal Flowers — Backup"
echo "  $TIMESTAMP"
echo "═══════════════════════════════════════════════"

mkdir -p "$BACKUP_DIR"

# ── Backup PostgreSQL ──────────────────────────────────────────────────
pg_backup() {
    local dump_file="$BACKUP_DIR/pg-$TIMESTAMP.dump"
    echo ""
    echo "  PostgreSQL: $dump_file"

    # Usar docker compose exec — o container tem pg_dump e a password
    # e definida via env_file / environment no docker-compose.production.yml
    local svc="${COMPOSE_SERVICE:-postgres}"
    if docker compose -f "$COMPOSE_FILE" exec -T "$svc" pg_dump \
        -U "${PGUSER:-loja}" \
        --no-owner --no-acl \
        --format=custom \
        --file=/tmp/pg-dump.dump \
        "${PGDATABASE:-loja_flores}" 2>&1; then
        docker compose -f "$COMPOSE_FILE" cp "$svc:/tmp/pg-dump.dump" "$dump_file" >/dev/null 2>&1 || {
            # Fallback: docker cp diretamente (container standalone)
            local cid=$(docker compose -f "$COMPOSE_FILE" ps -q "$svc" 2>/dev/null)
            [ -n "$cid" ] && docker cp "$cid:/tmp/pg-dump.dump" "$dump_file" >/dev/null 2>&1
        }
        docker compose -f "$COMPOSE_FILE" exec -T "$svc" rm /tmp/pg-dump.dump 2>/dev/null || true
        echo -e "  ${GREEN}OK${NC} PostgreSQL dump concluido"
    else
        echo -e "  ${RED}ERRO${NC} pg_dump falhou"
        return 1
    fi

    if [ -f "$dump_file" ] && [ -s "$dump_file" ]; then
        echo "  Tamanho: $(du -h "$dump_file" | cut -f1)"
        sha256sum "$dump_file" >> "$MANIFEST"
    else
        echo -e "  ${RED}ERRO${NC} Ficheiro de dump vazio"
        return 1
    fi
}

# ── Backup Media ───────────────────────────────────────────────────────
media_backup() {
    local media_archive="$BACKUP_DIR/media-$TIMESTAMP.tar.gz"
    local media_src="${MEDIA_SRC:-./media}"
    echo ""
    echo "  Media: $media_archive"

    if [ ! -d "$media_src" ]; then
        echo -e "  ${RED}ERRO${NC} Diretorio media nao encontrado: $media_src"
        return 1
    fi

    tar czf "$media_archive" -C "$(dirname "$media_src")" "$(basename "$media_src")" 2>&1 && {
        echo -e "  ${GREEN}OK${NC} Media archive concluido"
        echo "  Tamanho: $(du -h "$media_archive" | cut -f1)"
        sha256sum "$media_archive" >> "$MANIFEST"
    } || {
        echo -e "  ${RED}ERRO${NC} Media archive falhou"
        return 1
    }
}

# ── Executar ───────────────────────────────────────────────────────────
if $PG_ONLY; then
    pg_backup
elif $MEDIA_ONLY; then
    media_backup
else
    pg_backup
    media_backup
fi

echo ""
echo "Manifesto: $MANIFEST"
echo "Backup concluido em: $(date)" >> "$MANIFEST"
cat "$MANIFEST" | grep -v '^Backup' | grep -v '^$'

echo ""
echo -e "${GREEN}Backup concluido.${NC}"