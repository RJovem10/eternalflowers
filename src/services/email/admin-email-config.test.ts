import { afterEach, describe, expect, it, vi } from 'vitest'
import { assertAdminOrderDeliveryRecipient, getAdminOrderRecipient, validateAdminEmailConfiguration } from './admin-email-config'
import { register } from '@/instrumentation'

afterEach(() => vi.unstubAllEnvs())
function production() {
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('ADMIN_ORDER_NOTIFICATION_ENV', 'production')
  vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://eternalflowers.pt')
  vi.stubEnv('ADMIN_ORDER_NOTIFICATION_EMAIL', 'shop@eternalflowers.pt')
}
describe('administrative email environment protection', () => {
  it('accepts only the official production recipient with explicit production configuration', () => {
    production()
    expect(getAdminOrderRecipient()).toBe('shop@eternalflowers.pt')
    vi.stubEnv('ADMIN_ORDER_NOTIFICATION_EMAIL', 'other@example.test')
    expect(getAdminOrderRecipient).toThrow(/oficial/)
    vi.stubEnv('ADMIN_ORDER_NOTIFICATION_EMAIL', undefined)
    expect(getAdminOrderRecipient).toThrow(/EMAIL/)
  })
  it.each(['development', 'test'])('defaults to a reserved recipient in %s', mode => {
    vi.stubEnv('NODE_ENV', mode)
    vi.stubEnv('ADMIN_ORDER_NOTIFICATION_ENV', undefined)
    vi.stubEnv('ADMIN_ORDER_NOTIFICATION_EMAIL', undefined)
    expect(getAdminOrderRecipient()).toBe('admin@example.invalid')
  })
  it.each(['development', 'production'])('blocks official snapshots in sandbox (NODE_ENV=%s)', nodeEnv => {
    vi.stubEnv('NODE_ENV', nodeEnv)
    vi.stubEnv('ADMIN_ORDER_NOTIFICATION_ENV', 'sandbox')
    expect(() => assertAdminOrderDeliveryRecipient('shop@eternalflowers.pt')).toThrow(/sandbox/)
    expect(() => assertAdminOrderDeliveryRecipient('other@eternalflowers.pt')).toThrow(/sandbox/)
  })
  it('does not treat NODE_ENV=production alone as production delivery', () => {
    production()
    vi.stubEnv('ADMIN_ORDER_NOTIFICATION_ENV', undefined)
    expect(getAdminOrderRecipient).toThrow(/ENV/)
  })
  it.each(['development', 'test'])('rejects production delivery in %s', mode => {
    production()
    vi.stubEnv('NODE_ENV', mode)
    expect(getAdminOrderRecipient).toThrow(/runtime/)
  })
  it('rejects production delivery on the staging URL even with NODE_ENV=production', () => {
    production()
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'http://localhost:3003')
    expect(getAdminOrderRecipient).toThrow(/URL oficial/)
  })
  it.each(['a..b@example.test', '.a@example.test', 'a.@example.test', 'a@example..test', 'a@-example.test', 'a@example.test,shop@eternalflowers.pt'])('rejects malformed addresses (%s)', email => {
    vi.stubEnv('ADMIN_ORDER_NOTIFICATION_ENV', 'sandbox')
    vi.stubEnv('ADMIN_ORDER_NOTIFICATION_EMAIL', email)
    expect(getAdminOrderRecipient).toThrow(/EMAIL/)
  })
  it('validates during server registration without connecting to a database', async () => {
    production()
    vi.stubEnv('NEXT_RUNTIME', 'nodejs')
    vi.stubEnv('NEXT_PHASE', '')
    await expect(register()).resolves.toBeUndefined()
    vi.stubEnv('ADMIN_ORDER_NOTIFICATION_EMAIL', '')
    await expect(register()).rejects.toThrow(/EMAIL/)
  })
  it('skips server registration validation during build and on edge runtime', async () => {
    production()
    vi.stubEnv('ADMIN_ORDER_NOTIFICATION_EMAIL', '')
    vi.stubEnv('NEXT_RUNTIME', 'nodejs')
    vi.stubEnv('NEXT_PHASE', 'phase-production-build')
    await expect(register()).resolves.toBeUndefined()
    vi.stubEnv('NEXT_RUNTIME', 'edge')
    vi.stubEnv('NEXT_PHASE', '')
    await expect(register()).resolves.toBeUndefined()
    expect(validateAdminEmailConfiguration).toThrow()
  })
})
