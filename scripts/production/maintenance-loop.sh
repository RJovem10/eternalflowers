#!/bin/sh
# ╔══════════════════════════════════════════════════════════════════╗
# ║  maintenance-loop.sh                                           ║
# ║  Scheduler autónomo de manutenção — Eternal Flowers             ║
# ║                                                                ║
# ║  Executa POST http://app:3000/api/internal/maintenance          ║
# ║  a cada 5 minutos, continuando após falhas transitórias.        ║
# ║                                                                ║
# ║  Uso (apenas via Docker Compose):                              ║
# ║    MAINTENANCE_SECRET=<secret> ./maintenance-loop.sh            ║
# ║                                                                ║
# ║  Segurança:                                                     ║
# ║    - MAINTENANCE_SECRET via ambiente (nunca hardcoded)          ║
# ║    - sem set -x (não expõe headers/secret em tracing)           ║
# ║    - log sanitizado — nunca imprime Authorization header        ║
# ║    - sem contacto à Internet — rede Docker interna apenas       ║
# ╚══════════════════════════════════════════════════════════════════╝

set -eu

# ─── Configuração ──────────────────────────────────────────────────

INTERVAL_SECONDS=300
ENDPOINT_URL='http://app:3000/api/internal/maintenance'
STARTUP_RETRY_DELAY=5
STARTUP_MAX_RETRIES=12  # ~60 segundos para app ficar disponível

# ─── Validação inicial ─────────────────────────────────────────────

if [ -z "${MAINTENANCE_SECRET:-}" ]; then
  echo "[maintenance-scheduler] FATAL: MAINTENANCE_SECRET não definido. A encerrar."
  exit 1
fi

# ─── Função: ciclo único ──────────────────────────────────────────

run_cycle() {
  local cycle_id
  cycle_id="$(date +%s)"

  local http_code
  local response_body

  # Construir header apenas em tempo de execução — nunca em logs
  http_code="$(curl \
    --silent \
    --output "/tmp/maintenance-response-${cycle_id}.json" \
    --write-out '%{http_code}' \
    --max-time 30 \
    --request POST \
    --header "Authorization: Bearer ${MAINTENANCE_SECRET}" \
    --header 'Content-Type: application/json' \
    "${ENDPOINT_URL}" \
    2>/dev/null || echo '000')"

  if [ "${http_code}" = '000' ]; then
    # curl não conseguiu contactar o servidor
    echo "[maintenance-scheduler] $(date -u '+%Y-%m-%dT%H:%M:%SZ') connection-failure — endpoint não contactável (app pode estar a iniciar)"
    return 0
  fi

  case "${http_code}" in
    200)
      # Sucesso — log resumo sanitizado (response já é sanitizado pelo endpoint)
      if [ -f "/tmp/maintenance-response-${cycle_id}.json" ]; then
        local summary
        summary="$(tr -d '\n' < "/tmp/maintenance-response-${cycle_id}.json" | head -c 500)"
        echo "[maintenance-scheduler] $(date -u '+%Y-%m-%dT%H:%M:%SZ') 200 OK ${summary}"
        rm -f "/tmp/maintenance-response-${cycle_id}.json"
      else
        echo "[maintenance-scheduler] $(date -u '+%Y-%m-%dT%H:%M:%SZ') 200 OK (empty body)"
      fi
      ;;
    409)
      # Concorrência — ciclo já em execução, não é erro
      echo "[maintenance-scheduler] $(date -u '+%Y-%m-%dT%H:%M:%SZ') 409 already-running — ciclo anterior ainda ativo"
      rm -f "/tmp/maintenance-response-${cycle_id}.json"
      ;;
    401|403)
      # Erro de autenticação — log sem expor o secret
      echo "[maintenance-scheduler] $(date -u '+%Y-%m-%dT%H:%M:%SZ') ${http_code} auth-failure — MAINTENANCE_SECRET inválido ou não corresponde. A re-tentar no próximo ciclo."
      rm -f "/tmp/maintenance-response-${cycle_id}.json"
      ;;
    503)
      echo "[maintenance-scheduler] $(date -u '+%Y-%m-%dT%H:%M:%SZ') 503 service-unavailable — MAINTENANCE_SECRET não configurado na app. A re-tentar no próximo ciclo."
      rm -f "/tmp/maintenance-response-${cycle_id}.json"
      ;;
    *)
      # Qualquer outro código ou erro
      echo "[maintenance-scheduler] $(date -u '+%Y-%m-%dT%H:%M:%SZ') ${http_code} unexpected — re-tentar no próximo ciclo"
      rm -f "/tmp/maintenance-response-${cycle_id}.json"
      ;;
  esac
}

# ─── Startup: aguardar app ────────────────────────────────────────

echo "[maintenance-scheduler] $(date -u '+%Y-%m-%dT%H:%M:%SZ') a aguardar app em ${ENDPOINT_URL} ..."

_retry=0
while [ "${_retry}" -lt "${STARTUP_MAX_RETRIES}" ]; do
  if curl --silent --output /dev/null --max-time 5 --request POST \
    --header "Authorization: Bearer ${MAINTENANCE_SECRET}" \
    "${ENDPOINT_URL}" >/dev/null 2>&1; then
    echo "[maintenance-scheduler] $(date -u '+%Y-%m-%dT%H:%M:%SZ') app disponível após ~$(( _retry * STARTUP_RETRY_DELAY ))s"
    break
  fi
  _retry=$(( _retry + 1 ))
  sleep "${STARTUP_RETRY_DELAY}"
done

if [ "${_retry}" -ge "${STARTUP_MAX_RETRIES}" ]; then
  echo "[maintenance-scheduler] $(date -u '+%Y-%m-%dT%H:%M:%SZ') WARNING: app não respondeu após $(( STARTUP_MAX_RETRIES * STARTUP_RETRY_DELAY ))s. Ciclos vão continuar com retry."
fi

# ─── Primeiro ciclo imediato ──────────────────────────────────────

run_cycle

# ─── Loop principal ────────────────────────────────────────────────

while true; do
  sleep "${INTERVAL_SECONDS}"
  run_cycle
done