const { withPayload } = require('@payloadcms/next/withPayload')

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['payload', '@payloadcms/db-postgres', '@payloadcms/db-sqlite', 'better-sqlite3'],
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: '**' },
    ],
  },
}

module.exports = withPayload(nextConfig, { configPath: './src/payload.config.ts' })
