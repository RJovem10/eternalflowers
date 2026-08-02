#!/usr/bin/env node
/**
 * Patch loadEnv.js for tsx compatibility.
 * Payload 3.86 uses `import nextEnv from '@next/env'` which breaks with tsx
 * because tsx CJS→ESM interop returns undefined for the default import.
 * This script applies a safe 1-line fix.
 *
 * Run: node scripts/patch-load-env.js
 * Also runs automatically via "postinstall" in package.json.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

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

// Keep a backup if not exists
const backup = target + '.bak'
if (!fs.existsSync(backup)) {
  fs.copyFileSync(target, backup)
}

const patched = content.replace(
  "import nextEnvImport from '@next/env';",
  "import * as nextEnvImport from '@next/env';"
).replace(
  /const \{ loadEnvConfig \} = nextEnvImport;/,
  'const loadEnvConfig = nextEnvImport.loadEnvConfig || (() => ({}));'
)

fs.writeFileSync(target, patched)
console.log('✅ Patched loadEnv.js for tsx compatibility')