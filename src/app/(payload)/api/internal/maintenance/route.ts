/**
 * POST /api/internal/maintenance
 *
 * Endpoint server-to-server para executar um ciclo de manutenção.
 *
 * NÃO é para browser/admin UI.
 * NÃO expõe PII, secrets ou raw provider errors.
 *
 * Autenticação:
 *   Authorization: Bearer <MAINTENANCE_SECRET>
 *
 * Concorrência:
 *   Protecção in-process — retorna 409 se já estiver a correr.
 *   Em produção com uma única instância é suficiente.
 *   Multi-instance exigiria lock distribuído futuro.
 *
 * Resposta (200):
 *   { abandonedOrders: {...}, emailNotifications: {...} }
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import {
  runMaintenanceCycle,
  isMaintenanceRunning,
  MaintenanceAlreadyRunningError,
} from '@/services/maintenance/maintenance'
import { timingSafeEqual } from 'crypto'

// ═══════════════════════════════════════════════════════════════
// Auth
// ═══════════════════════════════════════════════════════════════

function verifyMaintenanceSecret(
  request: NextRequest,
): { ok: true } | { ok: false; status: number; error: string } {
  const secret = process.env.MAINTENANCE_SECRET

  // Se não está configurado → fail closed
  if (!secret) {
    console.error('[maintenance] MAINTENANCE_SECRET não configurado. Endpoint desactivado.')
    return { ok: false, status: 503, error: 'Manutenção não configurada.' }
  }

  const authHeader = request.headers.get('authorization')

  if (!authHeader) {
    return { ok: false, status: 401, error: 'Não autorizado.' }
  }

  // Espera: "Bearer <token>"
  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return { ok: false, status: 401, error: 'Não autorizado.' }
  }

  const token = parts[1]

  // Comparação timing-safe para evitar ataques de timing
  const secretBuf = Buffer.from(secret)
  const tokenBuf = Buffer.from(token)

  if (secretBuf.length !== tokenBuf.length) {
    return { ok: false, status: 401, error: 'Não autorizado.' }
  }

  const match = timingSafeEqual(secretBuf, tokenBuf)
  if (!match) {
    return { ok: false, status: 401, error: 'Não autorizado.' }
  }

  return { ok: true }
}

// ═══════════════════════════════════════════════════════════════
// Handler
// ═══════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  // ─── 1. Autenticação ─────────────────────────────────────
  const auth = verifyMaintenanceSecret(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  // ─── 2. Concorrência ─────────────────────────────────────
  if (isMaintenanceRunning()) {
    return NextResponse.json(
      { error: 'Um ciclo de manutenção já está em execução.', alreadyRunning: true },
      { status: 409 },
    )
  }

  // ─── 3. Executar ciclo ───────────────────────────────────
  try {
    const payload = await getPayload({ config })

    const summary = await runMaintenanceCycle(payload)

    return NextResponse.json(summary, { status: 200 })
  } catch (err: unknown) {
    if (err instanceof MaintenanceAlreadyRunningError) {
      // Race condition: lock foi adquirido entre a verificação e a chamada
      return NextResponse.json(
        { error: 'Um ciclo de manutenção já está em execução.', alreadyRunning: true },
        { status: 409 },
      )
    }

    // Erro inesperado — log sanitizado (sem PII, sem secrets)
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error('[maintenance] Cycle failed:', msg)

    return NextResponse.json(
      { error: 'Erro interno do servidor.' },
      { status: 500 },
    )
  }
}