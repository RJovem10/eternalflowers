import { loadEnvConfig } from '@next/env'

async function main() {
  loadEnvConfig(process.cwd())
  const { validateAdminEmailConfiguration } = await import('../src/services/email/admin-email-config')
  validateAdminEmailConfiguration()
  console.log('Configuração administrativa válida. Nenhuma ligação à DB ou envio de email.')
}
main().catch(() => {
  console.error('Configuração administrativa inválida. Verifique ambiente, destinatário e URL do servidor.')
  process.exitCode = 1
})
