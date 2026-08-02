#!/usr/bin/env bash
# =============================================================================
# Eternal Flowers — Backup de Produção
# =============================================================================
# Uso:  ./scripts/production/backup.sh
#       ./scripts/production/backup.sh --pg-only
#       ./scripts/production/backup.sh --media-only
# =============================================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
MANIFEST="$BACKUP_DIR/manifest-$TIMESTAMP.txt"
PG_ONLY=false
MEDIA_ONLY=false

# Parse args
for arg in "$@"; do
    case "$arg" in
        --pg-only) PG_ONLY=true ;;
        --media-only) MEDIA_ONLY=true ;;
        *) echo "Opção desconhecida: $arg"; exit 1 ;;
    esac
done

# Garantir que PG_ONLY e MEDIA_ONLY não estão ambas ativas
if $PG_ONLY && $MEDIA_ONLY; then
    echo "ERRO: --pg-only e --media-only são mutuamente exclusivos."
    exit 1
fi

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

echo "═══════════════════════════════════════════════"
echo "  Eternal Flowers — Backup"
echo "  $TIMESTAMP"
echo "═══════════════════════════════════════════════"

mkdir -p "$BACKUP_DIR"

# ── Backup PostgreSQL ──────────────────────────────────────────────────
pg_backup() {
    local dump_file="$BACKUP_DIR/pg-$TIMESTAMP.dump"
    echo ""
    echo "📦 PostgreSQL → $dump_file"

    # Password via PGPASSWORD (não na linha de comandos)
    if [ -z "${PGPASSWORD:-}" ]; then
        echo "  A ler PGPASSWORD de DATABASE_URI..."
        # Extrair password da DATABASE_URI
        DB_URI="${DATABASE_URI:-}"
        if echo "$DB_URI" | grep -qE '^postgresql://[^:]+:([^@]+)@'; then
            export PGPASSWORD=$(echo "$DB_URI" | sed -E 's|^postgresql://[^:]+:([^@]+)@.*|\1|')
            PGUSER=$(echo "$DB_URI" | sed -E 's|^postgresql://([^:]+):.*|\1|')
            PGHOST=$(echo "$DB_URI" | sed -E 's|^postgresql://[^:]+:[^@]+@([^:]+).*|\1|')
            PGPORT=$(echo "$DB_URI" | sed -E 's|^postgresql://[^:]+:[^@]+@[^:]+:([^/]+)/.*|\1|')
            PGDATABASE=$(echo "$DB_URI" | sed -E 's|^postgresql://[^:]+:[^@]+@[^:]+:[^/]+/(.+)|\1|')
        else
            # Tentar variáveis individuais
            PGUSER="${PGUSER:-loja}"
            PGPORT="${PGPORT:-5432}"
            PGDATABASE="${PGDATABASE:-loja_flores}"
            echo "  ⚠️  DATABASE_URI não parseável. Usar env vars individuais."
            echo "  PGUSER=$PGUSER PGHOST=$PGHOST PGPORT=$PGPORT PGDATABASE=$PGDATABASE"
        fi
    fi

    if command -v pg_dump &>/dev/null; then
        pg_dump \
            --no-owner --no-acl \
            --format=custom \
            --file="$dump_file" \
            2>&1 && echo -e "  ${GREEN}✅${NC} PostgreSQL dump concluído" || {
            echo -e "  ${RED}❌${NC} pg_dump falhou"
            return 1
        }
    else
        echo "  ⚠️  pg_dump não encontrado. Tentar via Docker..."
        docker exec eternal-flowers-postgres pg_dump \
            -U "${PGUSER:-loja}" \
            --no-owner --no-acl \
            --format=custom \
            --file=/tmp/pg-dump.dump \
            "${PGDATABASE:-loja_flores}" && \
        docker cp eternal-flowers-postgres:/tmp/pg-dump.dump "$dump_file" && \
        docker exec eternal-flowers-postgres rm /tmp/pg-dump.dump && \
        echo -e "  ${GREEN}✅${NC} PostgreSQL dump via Docker concluído" || {
            echo -e "  ${RED}❌${NC} pg_dump via Docker falhou"
            return 1
        }
    fi

    # Validar dump
    if [ -f "$dump_file" ] && [ -s "$dump_file" ]; then
        echo "  Tamanho: $(du -h "$dump_file" | cut -f1)"
        sha256sum "$dump_file" >> "$MANIFEST"
    else
        echo -e "  ${RED}❌${NC} Ficheiro de dump vazio ou não encontrado"
        return 1
    fi
}

# ── Backup Media ───────────────────────────────────────────────────────
media_backup() {
    local media_archive="$BACKUP_DIR/media-$TIMESTAMP.tar.gz"
    local media_src="${MEDIA_SRC:-./media}"
    echo ""
    echo "📁 Media → $media_archive"

    if [ ! -d "$media_src" ]; then
        echo -e "  ${RED}❌${NC} Diretório media não encontrado: $media_src"
        return 1
    fi

    tar czf "$media_archive" -C "$(dirname "$media_src")" "$(basename "$media_src")" 2>&1 && {
        echo -e "  ${GREEN}✅${NC} Media archive concluído"
        echo "  Tamanho: $(du -h "$media_archive" | cut -f1)"
        sha256sum "$media_archive" >> "$MANIFEST"
    } || {
        echo -e "  ${RED}❌${NC} Media archive falhou"
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

# Manifesto
echo ""
echo "📋 Manifesto: $MANIFEST"
echo "Backup concluído em: $(date)" >> "$MANIFEST"
cat "$MANIFEST" | grep -v '^Backup' | grep -v '^$'

# Retenção (opcional — descomentar para ativar)
# echo ""
# echo "🗑️  Retenção: a apagar backups com mais de 30 dias..."
# find "$BACKUP_DIR" -name 'pg-*' -mtime +30 -delete 2>/dev/null
# find "$BACKUP_DIR" -name 'media-*' -mtime +30 -delete 2>/dev/null
# find "$BACKUP_DIR" -name 'manifest-*' -mtime +30 -delete 2>/dev/null

echo ""
echo -e "${GREEN}✅ Backup concluído com sucesso.${NC}"