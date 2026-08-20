#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║  install-backup-timer.sh — Eternal Flowers                      ║
# ║                                                                ║
# ║  Instala os ficheiros systemd para backup diário automático:    ║
# ║    eternalflowers-backup.service  (Type=oneshot)                ║
# ║    eternalflowers-backup.timer    (03:30 Europe/Lisbon)         ║
# ║                                                                ║
# ║  Uso:  sudo ./scripts/production/install-backup-timer.sh        ║
# ║                                                                ║
# ║  Segurança:                                                     ║
# ║    - não lê nem imprime secrets                                 ║
# ║    - não copia .env de produção                                   ║
# ║    - não altera firewall/SSH                                    ║
# ║    - não executa backup automaticamente                         ║
# ╚══════════════════════════════════════════════════════════════════╝
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
    echo "[install] ERRO: Este script requer privilégios root (sudo)." >&2
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

SYSTEMD_SRC="${PROJECT_DIR}/configs/systemd"
SERVICE_SRC="${SYSTEMD_SRC}/eternalflowers-backup.service"
TIMER_SRC="${SYSTEMD_SRC}/eternalflowers-backup.timer"
SERVICE_DST="/etc/systemd/system/eternalflowers-backup.service"
TIMER_DST="/etc/systemd/system/eternalflowers-backup.timer"

echo "═══════════════════════════════════════════════"
echo "  Eternal Flowers — Instalar Backup Timer"
echo "═══════════════════════════════════════════════"

# ─── Renderizar service com PROJECT_DIR ────────────────────────────────
if [ ! -f "$SERVICE_SRC" ]; then
    echo "[install] ERRO: ${SERVICE_SRC} não encontrado." >&2
    exit 1
fi
if [ ! -f "$TIMER_SRC" ]; then
    echo "[install] ERRO: ${TIMER_SRC} não encontrado." >&2
    exit 1
fi

echo ""
echo "  Project dir: ${PROJECT_DIR}"
echo "  Service:     ${SERVICE_DST}"
echo "  Timer:       ${TIMER_DST}"
echo ""

# Substituir placeholder __PROJECT_DIR__ pelo path real
sed "s|__PROJECT_DIR__|${PROJECT_DIR}|g" "$SERVICE_SRC" > "$SERVICE_DST"
cp "$TIMER_SRC" "$TIMER_DST"

chmod 644 "$SERVICE_DST" "$TIMER_DST"

echo "  Unidades instaladas."
echo ""

# ─── daemon-reload ─────────────────────────────────────────────────────
echo "  systemctl daemon-reload..."
systemctl daemon-reload

# ─── Enable timer ──────────────────────────────────────────────────────
echo "  systemctl enable eternalflowers-backup.timer..."
systemctl enable eternalflowers-backup.timer 2>&1

echo ""
echo "✅ Backup timer installed and enabled."
echo ""
echo "  Next trigger:"
systemctl list-timers --all eternalflowers-backup.timer 2>/dev/null || \
    systemctl list-timers eternalflowers-backup.timer 2>/dev/null || \
    echo "  (verificar com: systemctl list-timers --all | grep eternalflowers)"
echo ""
echo ""
echo "⚠️  NOTA: O timer está instalado e enabled, mas NÃO foi iniciado."
echo "     Isto evita que a instalação dispare inesperadamente um backup"
echo "     de recuperação (Persistent=true)."
echo "     Para ativar o timer após o backup de aceitação manual:"
echo ""
echo "       systemctl start eternalflowers-backup.timer"
echo ""
echo "  Comandos úteis:"
echo "    systemctl status eternalflowers-backup.timer    # estado do timer"
echo "    systemctl list-timers eternalflowers-backup.timer  # próxima execução"
echo "    systemctl start eternalflowers-backup.service   # backup manual"
echo "    journalctl -u eternalflowers-backup.service     # logs"