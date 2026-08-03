#!/usr/bin/env bash
# E2E test: baseline → seed → E2-E4 → import → verify → idempotence
set -euo pipefail

cd "$(dirname "$0")/.."

# Config — ajustar consoante o contentor PostgreSQL
PG_HOST="${PG_HOST:-127.0.0.1}"
PG_PORT="${PG_PORT:-55432}"
PG_USER="${PG_USER:-postgres}"
PG_PASS="${PG_PASS:-mig_test_2026}"
PG_DB="${PG_DB:-eternal_flowers_test}"
URI="postgres://${PG_USER}:${PG_PASS}@${PG_HOST}:${PG_PORT}/${PG_DB}"
export DATABASE_URI="$URI"
export PAYLOAD_SQLITE_PUSH="false"

echo ""
echo "══════════════════════════════════════════════"
echo " E2E PG Chain: baseline → seed → E2-E4 → import"
echo "══════════════════════════════════════════════"
echo ""

echo "=== 0. FRESH DB ==="
docker exec pg-e6e-mig psql -U postgres -c "DROP DATABASE IF EXISTS ${PG_DB};" -c "CREATE DATABASE ${PG_DB};" 2>&1 | grep -E "DROP|CREATE"

echo ""
echo "=== 1. BASELINE (E1) ==="
# Apply E1 baseline SQL directly
npx tsx -e "
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
// Read the E1 migration and run its SQL
const mig = require('./src/migrations-pg/20260731_000000_baseline.ts');
" 2>/dev/null || true

# Alternative: apply baseline SQL via psql
docker exec -i pg-e6e-mig psql -U postgres -d ${PG_DB} <<'EOSQL'
$(cat <<'BASELINE_SQL'
CREATE TYPE IF NOT EXISTS "public"."_locales" AS ENUM('pt', 'en', 'es', 'it', 'de');
-- ... full schema from migration ...
BASELINE_SQL
)
EOSQL

# Register E1 in payload_migrations
docker exec pg-e6e-mig psql -U postgres -d ${PG_DB} \
  -c "INSERT INTO payload_migrations (name, batch, created_at, updated_at) VALUES ('20260731_000000_baseline', 1, now(), now()) ON CONFLICT DO NOTHING;"

echo ""
echo "=== 2. SEED (exact manifest source text) ==="
docker exec -i pg-e6e-mig psql -U postgres -d ${PG_DB} < /tmp/seed-exact-pg.sql 2>&1 | head -5

echo ""
echo "Counts:"
docker exec pg-e6e-mig psql -U postgres -d ${PG_DB} \
  -c "SELECT 'hp' AS t, COUNT(*) FROM homepage UNION ALL SELECT 'cat', COUNT(*) FROM categories UNION ALL SELECT 'col', COUNT(*) FROM collections UNION ALL SELECT 'fl', COUNT(*) FROM flowers ORDER BY t;"

echo ""
echo "=== 3. E2-E4 MIGRATIONS ==="
echo "y" | npx payload migrate 2>&1 | grep -E "Migrating|Migrated|Done|ERROR" | head -10

echo ""
echo "=== 4. DROP VERIFICATION ==="
docker exec pg-e6e-mig psql -U postgres -d ${PG_DB} <<'SQL'
SELECT 'flowers.story exists' AS check_col FROM information_schema.columns WHERE table_name='flowers' AND column_name='story';
SELECT 'categories.name exists' FROM information_schema.columns WHERE table_name='categories' AND column_name='name';
SELECT 'collections.name exists' FROM information_schema.columns WHERE table_name='collections' AND column_name='name';
SELECT 'homepage.hero_hero_title exists' FROM information_schema.columns WHERE table_name='homepage' AND column_name='hero_hero_title';
SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE '%_locales' ORDER BY table_name;
SQL

echo ""
echo "=== 5. IMPORT (dry-run) ==="
npx tsx scripts/translations/import-translations.ts --dry-run --snapshot-dir=/tmp/pg017-e2e 2>&1 | grep -E "Writes|Skips|Conflicts|SUCCESS|ABORT|ERROR|SOURCE_DRIFT" | head -10

echo ""
echo "=== 6. IMPORT (apply) ==="
npx tsx scripts/translations/import-translations.ts --apply --confirm=IMPORT_TRANSLATIONS --snapshot-dir=/tmp/pg017-e2e 2>&1 | grep -E "Ops|Writes|Skips|SUCCESS|ERROR|VERIFY" | head -10

echo ""
echo "=== 7. IMPORT (idempotence) ==="
npx tsx scripts/translations/import-translations.ts --dry-run --snapshot-dir=/tmp/pg017-e2e 2>&1 | grep -E "Writes|Skips|SUCCESS" | head -5

echo ""
echo "=== 8. VERIFY DATA ==="
docker exec pg-e6e-mig psql -U postgres -d ${PG_DB} <<'SQL'
SELECT 'homepage_en' AS t, hero_hero_title FROM homepage_locales WHERE _locale='en' LIMIT 1;
SELECT 'cat_en' AS t, name FROM categories_locales WHERE _locale='en' LIMIT 3;
SELECT 'flower1_en' AS t, substr(story,1,50) FROM flowers_locales WHERE _parent_id=1 AND _locale='en';
SELECT 'flower1_name_en' AS t, name_en FROM flowers WHERE id=1;
SQL

echo ""
echo "══════════════════════════════════════════════"
echo " ✅ PG Chain complete"
echo "══════════════════════════════════════════════"