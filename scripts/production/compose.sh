#!/bin/sh
# ╔══════════════════════════════════════════════════════════════════╗
# ║  compose.sh — Eternal Flowers production Compose wrapper        ║
# ║                                                                ║
# ║  Garante que --env-file .env.production é sempre passado ao     ║
# ║  Docker Compose, evitando o erro de interpolação onde           ║
# ║  variáveis como DATABASE_URI, PAYLOAD_SECRET, MAINTENANCE_SECRET ║
# ║  são avaliadas como string vazia.                               ║
# ║                                                                ║
# ║  Uso:                                                           ║
# ║    ./scripts/production/compose.sh up -d                        ║
# ║    ./scripts/production/compose.sh ps                           ║
# ║    ./scripts/production/compose.sh logs maintenance-scheduler   ║
# ║    ./scripts/production/compose.sh down                         ║
# ║                                                                ║
# ║  Equivalente manual sem wrapper:                                ║
# ║    docker compose                                               ║
# ║      -f docker-compose.production.yml                           ║
# ║      --env-file .env.production                                 ║
# ║      "$@"                                                       ║
# ║                                                                ║
# ║  Segurança:                                                     ║
# ║    - não lê nem imprime secrets                                 ║
# ║    - não faz tracing do ambiente                                ║
# ║    - falha com mensagem clara se .env.production não existir    ║
# ╚══════════════════════════════════════════════════════════════════╝

set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_FILE="${PROJECT_DIR}/docker-compose.production.yml"
ENV_FILE="${PROJECT_DIR}/.env.production"

# ─── Validar que .env.production existe ────────────────────────────

if [ ! -f "${ENV_FILE}" ]; then
  echo "[compose.sh] ERRO: ${ENV_FILE} não encontrado." >&2
  echo "[compose.sh] Copie de .env.production.example e preencha:" >&2
  echo "  cp ${PROJECT_DIR}/.env.production.example ${ENV_FILE}" >&2
  exit 1
fi

# ─── Executar Docker Compose com --env-file obrigatório ────────────

exec docker compose \
  -f "${COMPOSE_FILE}" \
  --env-file "${ENV_FILE}" \
  "$@"