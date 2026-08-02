#!/usr/bin/env bash
# E6E — Run translations import without node_modules patches
# Uses Node 22's process.loadEnvFile to load .env before Payload init
# Usage: scripts/translations/run-import.sh [args...]

set -euo pipefail

cd "$(dirname "$0")/../.."

# Load .env.local if it exists (Node 22 native API)
if [ -f .env.local ]; then
  export $(grep -v '^\s*#' .env.local | grep -v '^\s*$' | xargs)
fi
if [ -f .env ]; then
  export $(grep -v '^\s*#' .env | grep -v '^\s*$' | xargs)
fi

# Default safety
export PAYLOAD_SQLITE_PUSH="${PAYLOAD_SQLITE_PUSH:-false}"
export NODE_ENV="${NODE_ENV:-development}"

exec npx tsx scripts/translations/import-translations.ts "$@"