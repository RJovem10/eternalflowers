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
# ║    - chama apenas URL interna da app (http://app:3000)          ║
# ║    - sem porta pública exposta                                  ║
# ║    - sem credenciais BD/Stripe/Resend recebidas                 ║
# ╚══════════════════════════════════════════════════════════════════╝

set -eu

# ─── Configuração ──────────────────────────────────────────────────

INTERVAL_SECONDS=300
ENDPOINT_URL='http://app:3000/api/internal/maintenance'
HEALTH_URL='http://app:3000/api/health'
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
  local response_file
  response_file="/tmp/maintenance-response-${cycle_id}.json"

  # Construir header apenas em tempo de execução — nunca em logs
  if ! http_code="$(curl \
    --silent \
    --output "${response_file}" \
    --write-out '%{http_code}' \
    --max-time 30 \
    --request POST \
    --header "Authorization: Bearer ${MAINTENANCE_SECRET}" \
    --header 'Content-Type: application/json' \
    "${ENDPOINT_URL}" \
    2>/dev/null)"; then
    http_code='000'
  fi

  case "${http_code}" in
    000)
      # curl/network failure
      echo "[maintenance-scheduler] $(date -u '+%Y-%m-%dT%H:%M:%SZ') connection-failure — endpoint não contactável (app pode estar a iniciar)"
      rm -f "${response_file}"
      ;;
    200)
      # Sucesso — log resumo sanitizado (response já é sanitizado pelo endpoint)
      if [ -f "${response_file}" ]; then
        local summary
        summary="$(tr -d '\n' < "${response_file}" | head -c 500)"
        echo "[maintenance-scheduler] $(date -u '+%Y-%m-%dT%H:%M:%SZ') 200 OK ${summary}"
        rm -f "${response_file}"
      else
        echo "[maintenance-scheduler] $(date -u '+%Y-%m-%dT%H:%M:%SZ') 200 OK (empty body)"
      fi
      ;;
    409)
      # Concorrência — ciclo já em execução, não é erro
      echo "[maintenance-scheduler] $(date -u '+%Y-%m-%dT%H:%M:%SZ') 409 already-running — ciclo anterior ainda ativo"
      rm -f "${response_file}"
      ;;
    401|403)
      # Erro de autenticação — log sem expor o secret
      echo "[maintenance-scheduler] $(date -u '+%Y-%m-%dT%H:%M:%SZ') ${http_code} auth-failure — MAINTENANCE_SECRET inválido ou não corresponde. A re-tentar no próximo ciclo."
      rm -f "${response_file}"
      ;;
    503)
      echo "[maintenance-scheduler] $(date -u '+%Y-%m-%dT%H:%M:%SZ') 503 service-unavailable — MAINTENANCE_SECRET não configurado na app. A re-tentar no próximo ciclo."
      rm -f "${response_file}"
      ;;
    *)
      # Qualquer outro código ou erro
      echo "[maintenance-scheduler] $(date -u '+%Y-%m-%dT%H:%M:%SZ') ${http_code} unexpected — re-tentar no próximo ciclo"
      rm -f "${response_file}"
      ;;
  esac
}

# ─── Startup: aguardar app via health endpoint ────────────────────

echo "[maintenance-scheduler] $(date -u '+%Y-%m-%dT%H:%M:%SZ') a aguardar app em ${HEALTH_URL} ..."

_retry=0
while [ "${_retry}" -lt "${STARTUP_MAX_RETRIES}" ]; do
  if curl --silent --output /dev/null --max-time 5 --request GET \
    "${HEALTH_URL}" >/dev/null 2>&1; then
    echo "[maintenance-scheduler] $(date -u '+%Y-%m-%dT%H:%M:%SZ') app disponível após ~$(( _retry * STARTUP_RETRY_DELAY ))s"
    break
  fi
  _retry=$(( _retry + 1 ))
  sleep "${STARTUP_RETRY_DELAY}"
done

if [ "${_retry}" -ge "${STARTUP_MAX_RETRIES}" ]; then
  echo "[maintenance-scheduler] $(date -u '+%Y-%m-%dT%H:%M:%SZ') WARNING: app não respondeu após $(( STARTUP_MAX_RETRIES * STARTUP_RETRY_DELAY ))s. Ciclos vão continuar com retry."
fi

# ─── Primeiro ciclo imediato (apenas após readiness confirmada) ────

run_cycle

# ─── Loop principal ────────────────────────────────────────────────

while true; do
  sleep "${INTERVAL_SECONDS}"
  run_cycle
done