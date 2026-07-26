import { RootPage } from '@payloadcms/next/views'
import config from '@/payload.config'

export default function AdminPanelPage({
  params,
  searchParams,
}: {
  params: Promise<{ segments: string[] }>
  searchParams: Promise<Record<string, string>>
}) {
  return <RootPage config={config} params={params} searchParams={searchParams} importMap={{}} />
}
