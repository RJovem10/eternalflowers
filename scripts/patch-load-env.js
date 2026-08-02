#!/usr/bin/env node
/**
 * Patch loadEnv.js for tsx compatibility.
 * Payload 3.86 uses `import nextEnv from '@next/env'` which breaks with tsx
 * because tsx CJS→ESM interop returns undefined for the default import.
 *
 * Reproduzível via "postinstall" em package.json.
 * Validates expected Payload version and pattern before patching.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

// Validate Payload version
const pkgPath = path.join(root, 'node_modules', 'payload', 'package.json')
if (!fs.existsSync(pkgPath)) {
  console.error('⚠️  Payload not installed. Skipping patch.')
  process.exit(0)
}
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
if (!pkg.version?.startsWith('3.')) {
  console.error(`⚠️  Unexpected Payload version ${pkg.version}. Patch may not apply.`)
  process.exit(1)
}

// Read loadEnv.js
const target = path.join(root, 'node_modules', 'payload', 'dist', 'bin', 'loadEnv.js')
if (!fs.existsSync(target)) {
  console.error(`⚠️  loadEnv.js not found at ${target}. Skipping patch.`)
  process.exit(0)
}

const content = fs.readFileSync(target, 'utf-8')

// Check if already patched
if (content.includes('import * as nextEnvImport')) {
  console.log('✅ loadEnv.js already patched')
  process.exit(0)
}

// Validate expected pattern
if (!content.includes("import nextEnvImport from '@next/env';")) {
  console.error('❌ Unexpected loadEnv.js format — cannot apply patch automatically.')
  console.error(`   Expected: import nextEnvImport from '@next/env'`)
  console.error(`   First line: ${content.split('\n')[0]}`)
  process.exit(1)
}

if (!content.includes('const { loadEnvConfig } = nextEnvImport;')) {
  console.error('❌ Unexpected loadEnv.js format — cannot apply patch automatically.')
  process.exit(1)
}

// Backup
const backup = target + '.bak'
if (!fs.existsSync(backup)) {
  fs.copyFileSync(target, backup)
}

// Apply patch
const patched = content
  .replace(
    "import nextEnvImport from '@next/env';",
    "import * as nextEnvImport from '@next/env';"
  )
  .replace(
    'const { loadEnvConfig } = nextEnvImport;',
    'const loadEnvConfig = nextEnvImport.loadEnvConfig || (() => ({}));'
  )

fs.writeFileSync(target, patched)
console.log('✅ loadEnv.js patched for tsx compatibility')
console.log(`   Payload v${pkg.version}, file: payload/dist/bin/loadEnv.js`)