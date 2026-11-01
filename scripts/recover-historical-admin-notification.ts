/** Executar apenas após autorização para o ambiente de destino. Nunca envia emails. */
import { loadEnvConfig } from '@next/env'

async function main() {
  const args = process.argv.slice(2)
  if (args.length > 1 || (args.length === 1 && !['--dry-run', '--apply'].includes(args[0]))) {
    throw new Error('Uso: tsx scripts/recover-historical-admin-notification.ts [--dry-run|--apply]')
  }
  loadEnvConfig(process.cwd())
  const { validateAdminEmailConfiguration } = await import('../src/services/email/admin-email-config')
  validateAdminEmailConfiguration()
  // Impedir schema push, incluindo no modo de simulação.
  process.env.PAYLOAD_PG_PUSH = 'false'
  process.env.PAYLOAD_SQLITE_PUSH = 'false'
  const { getPayload } = await import('payload')
  const { default: config } = await import('../src/payload.config')
  const { recoverHistoricalAdminNotification } = await import('../src/services/email/admin-order-paid')
  const payload = await getPayload({ config })
  try {
    const result = await recoverHistoricalAdminNotification(payload, args[0] === '--apply')
    console.log(JSON.stringify(result))
  } finally {
    await payload.destroy()
  }
}

main().catch(() => {
  // Não imprimir erros do driver, connection strings ou dados da encomenda.
  console.error('Recuperação interrompida. Verifique configuração e critérios da encomenda num ambiente autorizado.')
  process.exitCode = 1
})
