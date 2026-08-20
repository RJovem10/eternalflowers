#!/usr/bin/env bash
# =============================================================================
# Eternal Flowers — Backup de Produção
# =============================================================================
# Uso:  ./scripts/production/backup.sh                      (full)
#       ./scripts/production/backup.sh --pg-only             (PostgreSQL only)
#       ./scripts/production/backup.sh --media-only          (media only)
#       ./scripts/production/backup.sh --verify              (latest full)
#       ./scripts/production/backup.sh --verify <dir>        (specific set)
#
# Arquitectura:
#   Host → compose-wrapper.sh → PostgreSQL container  → pg_dump (custom format)
#                              → App container         → /app/media  (tar.gz)
#
#   Staging:     backups/.tmp-<timestamp>/
#   Publicado:   backups/backup-<timestamp>/         (full)
#                backups/backup-pg-<timestamp>/       (--pg-only)
#                backups/backup-media-<timestamp>/    (--media-only)
#   Manifesto:   manifest.sha256 (postgres.dump + media.tar.gz)
#   Retenção:    14 dias / mínimo 3 conjuntos COMPLETOS
#   Concorrência: flock sem bloqueio (persistente)
#
# ⚠️  BACKUPS LOCAIS NO VPS NÃO PROTEGEM CONTRA PERDA DO VPS.
#     Off-site backup é uma issue futura separada.
# =============================================================================
set -euo pipefail

# ─── Paths ────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_WRAPPER="${SCRIPT_DIR}/compose.sh"
BACKUP_DIR="${BACKUP_DIR:-${PROJECT_DIR}/backups}"
LOCK_FILE="${BACKUP_DIR}/.backup.lock"
declare -r SCRIPT_DIR PROJECT_DIR COMPOSE_WRAPPER BACKUP_DIR LOCK_FILE

# ─── Config ───────────────────────────────────────────────────────────────
RETENTION_DAYS=${RETENTION_DAYS:-14}
MIN_SETS=${MIN_SETS:-3}
declare -r RETENTION_DAYS MIN_SETS

# ─── Helpers ──────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log_ok()   { echo -e "  ${GREEN}OK${NC} $1"; }
log_err()  { echo -e "  ${RED}ERRO${NC} $1"; }
log_warn() { echo -e "  ${YELLOW}⚠${NC} $1"; }

# ─── PostgreSQL structural verification ──────────────────────────────────
# Verifica a integridade de um dump custom-format via pg_restore --list.
# Tenta primeiro dentro do container postgres (sempre disponível);
# falha para host pg_restore apenas se presente em PATH.
# NUNCA imprime "verificado" sem ter executado pg_restore --list com sucesso.
verify_pg_dump() {
    local dump_file="$1"
    if "${COMPOSE_WRAPPER}" exec -T postgres pg_restore --list /dev/stdin < "${dump_file}" >/dev/null 2>&1; then
        return 0
    fi
    # Fallback: host pg_restore
    if command -v pg_restore &>/dev/null; then
        if pg_restore --list "${dump_file}" >/dev/null 2>&1; then
            return 0
        fi
    fi
    return 1
}

# ─── Flags ────────────────────────────────────────────────────────────────
VERIFY_MODE=false; VERIFY_DIR=''; PG_ONLY=false; MEDIA_ONLY=false
while [ $# -gt 0 ]; do
    case "$1" in
        --pg-only)    PG_ONLY=true; shift ;;
        --media-only) MEDIA_ONLY=true; shift ;;
        --verify)     VERIFY_MODE=true; shift
                      # Consume next arg only if present and not another option
                      if [ $# -gt 0 ] && [[ "$1" != -* ]]; then
                          VERIFY_DIR="$1"; shift
                      fi ;;
        --verify=*)   VERIFY_MODE=true; VERIFY_DIR="${1#*=}"; shift ;;
        *) echo "Opção desconhecida: $1"; exit 1 ;;
    esac
done
if $PG_ONLY && $MEDIA_ONLY; then
    echo "ERRO: --pg-only e --media-only são mutuamente exclusivos."
    exit 1
fi

# ═══════════════════════════════════════════════════════════════════════════
# VERIFY MODE
# ═══════════════════════════════════════════════════════════════════════════
do_verify() {
    local target_dir="$1"
    local errors=0
    local pg_dump="${target_dir}/postgres.dump"
    local media_archive="${target_dir}/media.tar.gz"
    local manifest="${target_dir}/manifest.sha256"

    # Determine backup type from directory name
    local bname; bname="$(basename "${target_dir}")"
    local backup_type="full"
    case "${bname}" in
        backup-pg-*)    backup_type="pg-only" ;;
        backup-media-*) backup_type="media-only" ;;
        backup-*)       backup_type="full" ;;
        *)              log_err "Tipo de backup indeterminado: ${bname}"; return 1 ;;
    esac

    echo "═══ Verificar: ${bname} (${backup_type}) ═══"
    echo ""

    if [ "$backup_type" = "full" ] || [ "$backup_type" = "pg-only" ]; then
        # Required for full and pg-only: postgres.dump + manifest.sha256
        for f in "${pg_dump}" "${manifest}"; do
            if [ ! -f "$f" ]; then
                log_err "Ficheiro em falta: $f"; errors=$((errors + 1))
            elif [ ! -s "$f" ]; then
                log_err "Ficheiro vazio: $f"; errors=$((errors + 1))
            else
                log_ok "$(basename "$f") existe ($(du -h "$f" | cut -f1))"
            fi
        done
    fi

    if [ "$backup_type" = "full" ] || [ "$backup_type" = "media-only" ]; then
        # Required for full and media-only: media.tar.gz + manifest.sha256
        # For full, manifest is already checked above — just add media check
        if [ "$backup_type" = "media-only" ]; then
            for f in "${media_archive}" "${manifest}"; do
                if [ ! -f "$f" ]; then
                    log_err "Ficheiro em falta: $f"; errors=$((errors + 1))
                elif [ ! -s "$f" ]; then
                    log_err "Ficheiro vazio: $f"; errors=$((errors + 1))
                else
                    log_ok "$(basename "$f") existe ($(du -h "$f" | cut -f1))"
                fi
            done
        else
            # Full: check media in addition to pg_dump + manifest (already checked)
            if [ ! -f "${media_archive}" ]; then
                log_err "Ficheiro em falta: media.tar.gz"; errors=$((errors + 1))
            elif [ ! -s "${media_archive}" ]; then
                log_err "Ficheiro vazio: media.tar.gz"; errors=$((errors + 1))
            else
                log_ok "media.tar.gz existe ($(du -h "${media_archive}" | cut -f1))"
            fi
        fi
    fi

    if [ $errors -gt 0 ]; then return 1; fi

    echo ""; echo "  Manifesto SHA-256:"
    if (cd "${target_dir}" && sha256sum -c manifest.sha256 >/dev/null 2>&1); then
        log_ok "SHA-256 verification passed"
    else
        log_err "SHA-256 verification FAILED"; errors=$((errors + 1))
    fi

    if [ "$backup_type" = "full" ] || [ "$backup_type" = "pg-only" ]; then
        echo ""; echo "  pg_restore --list:"
        if verify_pg_dump "${pg_dump}"; then
            local tcount
            tcount=$(pg_restore --list "${pg_dump}" 2>/dev/null | grep -cE '^[0-9]+;.*TABLE DATA' || true)
            log_ok "Dump PostgreSQL válido (${tcount} tabelas com dados)"
        else
            log_err "pg_restore --list falhou (host e container)"; errors=$((errors + 1))
        fi
    fi

    if [ "$backup_type" = "full" ] || [ "$backup_type" = "media-only" ]; then
        echo ""; echo "  tar -tzf:"
        if tar -tzf "${media_archive}" >/dev/null 2>&1; then
            local mcount
            mcount=$(tar -tzf "${media_archive}" 2>/dev/null | wc -l)
            log_ok "Archive media válido (${mcount} entradas)"
        else
            log_err "Archive media corrompido"; errors=$((errors + 1))
        fi
    fi

    echo ""
    if [ $errors -eq 0 ]; then log_ok "Verificação concluída — todos os testes passaram."; return 0
    else log_err "Verificação falhou — ${errors} erro(s)."; return 1; fi
}

if $VERIFY_MODE; then
    if [ -z "$VERIFY_DIR" ]; then
        # Default: latest FULL backup only (not partial)
        VERIFY_DIR=$(ls -d "${BACKUP_DIR}"/backup-[0-9]*_*/ 2>/dev/null | sort -r | head -1)
        if [ -z "$VERIFY_DIR" ]; then
            log_err "Nenhum backup completo encontrado em ${BACKUP_DIR}/backup-<timestamp>/"; exit 1
        fi
    fi
    if [ ! -d "$VERIFY_DIR" ]; then
        log_err "Diretório não encontrado: ${VERIFY_DIR}"; exit 1
    fi
    echo "═══ Verificar backup: $(basename "${VERIFY_DIR}") ═══"
    do_verify "$VERIFY_DIR"
    exit $?
fi

# ═══════════════════════════════════════════════════════════════════════════
# CONCURRENCY LOCK (persistent — DO NOT unlink on exit)
# ═══════════════════════════════════════════════════════════════════════════
mkdir -p "${BACKUP_DIR}"
exec 200>"${LOCK_FILE}"
if ! flock -n 200; then
    log_err "Outro backup em execução. A sair."
    exit 1
fi

# ═══════════════════════════════════════════════════════════════════════════
# BACKUP EXECUTION
# ═══════════════════════════════════════════════════════════════════════════
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
STAGING_DIR="${BACKUP_DIR}/.tmp-${TIMESTAMP}"
if $PG_ONLY; then
    FINAL_PREFIX="backup-pg"
elif $MEDIA_ONLY; then
    FINAL_PREFIX="backup-media"
else
    FINAL_PREFIX="backup"
fi
FINAL_DIR="${BACKUP_DIR}/${FINAL_PREFIX}-${TIMESTAMP}"
PG_DUMP="${STAGING_DIR}/postgres.dump"
MEDIA_ARCHIVE="${STAGING_DIR}/media.tar.gz"
MANIFEST="${STAGING_DIR}/manifest.sha256"
METADATA="${STAGING_DIR}/metadata.txt"
ERRORS=0

echo "═══════════════════════════════════════════════"
echo "  Eternal Flowers — Backup"
echo "  ${TIMESTAMP}"
if $PG_ONLY; then     echo "  Modo: PostgreSQL apenas"
elif $MEDIA_ONLY; then echo "  Modo: Media apenas"
else                   echo "  Modo: Completo"
fi
echo "═══════════════════════════════════════════════"
mkdir -p "${STAGING_DIR}"

# ─── PostgreSQL (custom format via container) ─────────────────────────────
pg_backup() {
    local tmp_dump="/tmp/backup-pg-dump.$$.dump"
    echo ""; echo "  PostgreSQL dump (custom format)..."

    # NOTE: POSTGRES_USER and POSTGRES_DB are resolved INSIDE the postgres
    # container via sh -ec. The host shell NEVER references these variables,
    # so backup.sh works correctly under systemd where they are not exported.
    if "${COMPOSE_WRAPPER}" exec -T postgres sh -ec '
        pg_dump \
            -U "$POSTGRES_USER" --no-owner --no-acl --format=custom \
            --file="$1" "$POSTGRES_DB"
    ' sh "${tmp_dump}" >/dev/null 2>&1; then

        if "${COMPOSE_WRAPPER}" cp "postgres:${tmp_dump}" "${PG_DUMP}" >/dev/null 2>&1; then
            log_ok "PostgreSQL dump copiado"
        else
            local cid; cid=$("${COMPOSE_WRAPPER}" ps -q postgres 2>/dev/null)
            if [ -n "$cid" ] && docker cp "${cid}:${tmp_dump}" "${PG_DUMP}" >/dev/null 2>&1; then
                log_ok "PostgreSQL dump copiado (fallback docker cp)"
            else
                log_err "Falha ao copiar dump do container"
                "${COMPOSE_WRAPPER}" exec -T postgres rm -f "${tmp_dump}" 2>/dev/null || true
                return 1
            fi
        fi
        "${COMPOSE_WRAPPER}" exec -T postgres rm -f "${tmp_dump}" 2>/dev/null || true
    else
        log_err "pg_dump falhou"; return 1
    fi

    [ -s "${PG_DUMP}" ] || { log_err "Dump vazio"; return 1; }
    echo "  Tamanho: $(du -h "${PG_DUMP}" | cut -f1)"

    # Structural verification — MUST pass before proceeding
    # Uses container pg_restore first, fallback host pg_restore
    if verify_pg_dump "${PG_DUMP}"; then
        log_ok "Dump PostgreSQL verificado (pg_restore --list)"
    else
        log_err "pg_restore --list falhou — dump não verificado"
        return 1
    fi
    sha256sum "${PG_DUMP}" | awk '{print $1 "  postgres.dump"}' >> "${MANIFEST}"
}

# ─── Media (from app:/app/media) ──────────────────────────────────────────
media_backup() {
    echo ""; echo "  Media archive from app:/app/media..."
    # tar exit 0 is required. Non-zero exit = FAIL regardless of file content.
    if "${COMPOSE_WRAPPER}" exec -T app tar czf - -C /app media > "${MEDIA_ARCHIVE}" 2>/dev/null; then
        log_ok "Media archive concluído"
    else
        log_err "Falha ao criar media archive (tar exit non-zero)"
        rm -f "${MEDIA_ARCHIVE}" 2>/dev/null || true
        return 1
    fi

    [ -s "${MEDIA_ARCHIVE}" ] || { log_err "Archive media vazio"; return 1; }
    echo "  Tamanho: $(du -h "${MEDIA_ARCHIVE}" | cut -f1)"

    tar -tzf "${MEDIA_ARCHIVE}" >/dev/null 2>&1 || { log_err "Archive media corrompido"; return 1; }
    local entries; entries=$(tar -tzf "${MEDIA_ARCHIVE}" 2>/dev/null | wc -l)
    log_ok "Archive media verificado (${entries} entradas)"
    sha256sum "${MEDIA_ARCHIVE}" | awk '{print $1 "  media.tar.gz"}' >> "${MANIFEST}"
}

# ─── Publish (atomic rename after verification) ──────────────────────────
publish() {
    if [ $ERRORS -gt 0 ]; then
        echo ""; log_err "Backup com erros — staging removido."
        rm -rf "${STAGING_DIR}"; exit 1
    fi

    {
        echo "Backup Timestamp: ${TIMESTAMP}"
        echo "Date (UTC): $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
        echo "Git SHA: $(cd "${PROJECT_DIR}" && git rev-parse HEAD 2>/dev/null || echo 'N/A')"
        echo "PG Only: ${PG_ONLY}"
        echo "Media Only: ${MEDIA_ONLY}"
    } > "${METADATA}"

    echo ""; echo "  Verifying SHA-256 manifest before publish..."
    (cd "${STAGING_DIR}" && sha256sum -c manifest.sha256 >/dev/null 2>&1) || {
        log_err "SHA-256 verification failed"; rm -rf "${STAGING_DIR}"; exit 1
    }
    log_ok "SHA-256 verification passed"

    mv "${STAGING_DIR}" "${FINAL_DIR}"
    log_ok "Backup publicado: $(basename "${FINAL_DIR}")"
}

# ─── Retention ────────────────────────────────────────────────────────────
run_retention() {
    echo ""; echo "  Retenção: máximo ${RETENTION_DAYS} dias, mínimo ${MIN_SETS} conjuntos COMPLETOS..."

    local all=(); local candidates=(); local now_epoch
    now_epoch=$(date '+%s')

    # Gather only FULL backup sets (backup-<timestamp>/, must contain both files)
    for d in "${BACKUP_DIR}"/backup-[0-9]*_*/; do
        [ -d "$d" ] || continue
        local bname="${d%%/}"; bname="${bname##*/}"
        # Must match full backup pattern: backup-YYYYMMDD_HHMMSS (no prefix)
        [[ "${bname}" =~ ^backup-[0-9]{8}_[0-9]{6}$ ]] || continue
        # Require both postgres.dump and media.tar.gz for full set consideration
        [ -f "${d}/postgres.dump" ] && [ -f "${d}/media.tar.gz" ] || continue
        local stamp="${bname#backup-}"
        local dir_epoch
        dir_epoch=$(date -d "${stamp:0:8} ${stamp:9:2}:${stamp:11:2}:${stamp:13:2}" '+%s' 2>/dev/null || echo "0")
        [ "$dir_epoch" -gt 0 ] || continue
        local age_days=$(( (now_epoch - dir_epoch) / 86400 ))
        all+=("$bname|$dir_epoch|$age_days")
    done

    local total=${#all[@]}
    [ "$total" -le "$MIN_SETS" ] && { log_warn "Apenas ${total} conjunto(s) completo(s) — mínimo ${MIN_SETS}. Nada removido."; return; }

    # Sort by epoch (oldest first)
    IFS=$'\n' sorted=($(sort -t'|' -k2 -n <<<"${all[*]}")); unset IFS

    local max_remove=$((total - MIN_SETS))
    local removed=0

    for entry in "${sorted[@]}"; do
        [ "$removed" -ge "$max_remove" ] && break
        local bname="${entry%%|*}"
        local age="${entry##*|}"
        [ "$age" -lt "$RETENTION_DAYS" ] && continue  # not old enough
        rm -rf "${BACKUP_DIR}/${bname}"
        log_warn "Removido ${bname} (${age} dias, retenção ${RETENTION_DAYS})"
        removed=$((removed + 1))
    done

    [ "$removed" -eq 0 ] && log_ok "Nenhum conjunto removido."
}

# ─── Execute ──────────────────────────────────────────────────────────────
if $PG_ONLY; then
    pg_backup || ERRORS=$((ERRORS + 1))
    publish
elif $MEDIA_ONLY; then
    media_backup || ERRORS=$((ERRORS + 1))
    publish
else
    pg_backup   || ERRORS=$((ERRORS + 1))
    media_backup || ERRORS=$((ERRORS + 1))
    publish
    run_retention
fi

echo ""; log_ok "Backup concluído."
exit 0