import { initTransaction, commitTransaction } from 'payload'

/**
 * Helper to create a minimal req-like object for Payload Local API transaction support.
 * Payload uses `req.transactionID` to track and share transactions across operations.
 */
export function createTransactionalReq(payload: any) {
  return { payload } as any
}

/**
 * Start a new database transaction via Payload's req-based mechanism.
 * Returns the req object with transactionID set. All subsequent Local API
 * calls must pass `{ ..., req }` to participate in the same transaction.
 */
export async function startTransaction(payload: any) {
  const req = createTransactionalReq(payload)
  await initTransaction(req)
  return req
}

/**
 * Commit the transaction associated with req and clean up.
 */
export async function finishTransaction(req: any) {
  if (req.transactionID) {
    await commitTransaction(req)
  }
}

/**
 * Read a field's value from Payload WITHOUT fallback, so we can distinguish
 * actual translations from auto-fallback content.
 */
export async function readWithoutFallback(payload: any, opts: any) {
  return payload.find({
    ...opts,
    locale: opts.locale,
    fallbackLocale: false,
  })
}

export async function readGlobalWithoutFallback(payload: any, opts: any) {
  return payload.findGlobal({
    ...opts,
    locale: opts.locale,
    fallbackLocale: false,
  })
}

export async function readByIDWithoutFallback(payload: any, opts: any) {
  return payload.findByID({
    ...opts,
    locale: opts.locale,
    fallbackLocale: false,
  })
}