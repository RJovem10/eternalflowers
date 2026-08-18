/**
 * GET /api/health
 *
 * Endpoint de health check para Docker/reverse proxy/monitoring.
 *
 * Resposta:
 *   200 { "status": "ok" }          — DB acessível
 *   503 { "status": "error" }       — DB indisponível
 *
 * NÃO retorna:
 *   - versão do DB
 *   - connection string / secrets
 *   - env vars
 *   - hostname interno
 *   - stack trace
 */
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'

export async function GET() {
  try {
    const payload = await getPayload({ config })

    // Operação mínima e segura — apenas verifica que o DB responde
    await payload.count({
      collection: 'flowers',
      where: {
        id: { equals: 0 }, // nunca existe, apenas verifica conectividade
      },
    })

    return NextResponse.json({ status: 'ok' }, { status: 200 })
  } catch {
    // Log sanitizado — sem PII, sem secrets, sem stack trace
    console.error('[health] DB health check failed')
    return NextResponse.json({ status: 'error' }, { status: 503 })
  }
}