import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'

let cached: Payload | null = null
let initPromise: Promise<Payload> | null = null

export const getPayloadClient = async (): Promise<Payload> => {
  if (cached) return cached
  if (!initPromise) {
    initPromise = getPayload({ config }).then((p) => {
      cached = p
      return p
    })
  }
  return initPromise
}
