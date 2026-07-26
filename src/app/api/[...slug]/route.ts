import { REST_GET, REST_POST, REST_DELETE, REST_PATCH, REST_PUT, REST_OPTIONS } from '@payloadcms/next/routes'
import config from '@/payload.config'

export const GET = (req: Request, ctx: any) => REST_GET(config)(req, ctx)
export const POST = (req: Request, ctx: any) => REST_POST(config)(req, ctx)
export const DELETE = (req: Request, ctx: any) => REST_DELETE(config)(req, ctx)
export const PATCH = (req: Request, ctx: any) => REST_PATCH(config)(req, ctx)
export const PUT = (req: Request, ctx: any) => REST_PUT(config)(req, ctx)
export const OPTIONS = (req: Request, ctx: any) => REST_OPTIONS(config)(req, ctx)
