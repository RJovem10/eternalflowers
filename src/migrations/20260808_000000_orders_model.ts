import { sql } from '@payloadcms/db-sqlite'

interface MigrateArgs {
  db: any
  payload: any
  req: any
}

/**
 * ISSUE-1A — Orders Model Expansion (SQLite)
 *
 * UP:
 *   1. Validates all orders_items.flower values: must be NULL/empty or
 *      ASCII-digit-only strings that resolve to an existing flowers.id.
 *   2. Adds new columns to orders table.
 *   3. Backfills legacy orders with new fields.
 *   4. Rebuilds orders_items: flower text → flower_id FK to flowers.
 *   5. Adds indexes.
 *
 * DOWN:
 *   1. Validates that no non-legacy data would be destroyed (semantically
 *      equivalent check in SQLite and PostgreSQL).
 *   2. Rebuilds orders_items back to text flower.
 *   3. Drops added columns from orders.
 */

export async function up({ db }: MigrateArgs): Promise<void> {
  // ──────────────────────────────────────────────────────────────────────────
  // Step 1: Validate every non-empty orders_items.flower value
  // ──────────────────────────────────────────────────────────────────────────

  // Validate that non-empty flower values contain ONLY ASCII digits 0-9.
  // SQLite GLOB: '^' inside a character class negates it (NOT '!').
  // [^0-9] matches a character that is NOT a digit 0-9.
  // Pattern '*[^0-9]*' matches any string containing at least one non-digit.
  // flower NOT GLOB '*[^0-9]*'  → only digits allowed.
  // We also explicitly reject leading/trailing whitespace and negative sign.
  const invalidFlowerVals = await db.get(sql`
    SELECT COUNT(*) AS cnt FROM \`orders_items\`
    WHERE \`flower\` IS NOT NULL
      AND \`flower\` != ''
      AND (
        -- Reject whitespace (leading or trailing)
        \`flower\` GLOB ' *' OR \`flower\` GLOB '* '
        -- Reject anything that isn't purely digits 0-9
        OR NOT (\`flower\` GLOB '[0-9]*' AND \`flower\` NOT GLOB '*[^0-9]*')
      );
  `)
  if (invalidFlowerVals?.cnt > 0) {
    throw new Error(
      `[UP] ABORTED: ${invalidFlowerVals.cnt} orders_items.flower value(s) ` +
      'contain non-digit characters, whitespace, or are otherwise invalid. ' +
      'Only ASCII digits 0-9 are permitted for non-empty flower values. ' +
      'Run manual cleanup first.'
    )
  }

  // Validate that digit-only flower values resolve to an existing flowers.id.
  const orphans = await db.get(sql`
    SELECT COUNT(*) AS cnt FROM \`orders_items\` oi
    LEFT JOIN \`flowers\` f ON CAST(oi.\`flower\` AS INTEGER) = f.\`id\`
    WHERE oi.\`flower\` IS NOT NULL
      AND oi.\`flower\` != ''
      AND f.\`id\` IS NULL;
  `)
  if (orphans?.cnt > 0) {
    throw new Error(
      `[UP] ABORTED: ${orphans.cnt} orphan flower reference(s) found in ` +
      'orders_items. Every non-empty flower text must resolve to an existing ' +
      'flower id. Run manual cleanup first.'
    )
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Track DDL operations for manual compensation.
  // SQLite DDL (ALTER TABLE, CREATE TABLE, DROP TABLE, CREATE INDEX) is NOT
  // transactional — each DDL statement auto-commits any pending transaction.
  // Even though Payload wraps migration.up() inside initTransaction/commit,
  // the outer transaction cannot roll back DDL.  We track what was created so
  // we can manually undo on failure.
  // ──────────────────────────────────────────────────────────────────────────

  let addedOrderColumns = false
  let createdNewItemsTable = false
  let droppedOldItemsTable = false
  let renamedTable = false
  let createdIndexes: string[] = []

  try {
    // ── Step 2: Expand orders table ────────────────────────────────────────
    await db.run(sql`ALTER TABLE \`orders\` ADD COLUMN \`order_number\` text;`)
    await db.run(sql`ALTER TABLE \`orders\` ADD COLUMN \`customer_name\` text;`)
    await db.run(sql`ALTER TABLE \`orders\` ADD COLUMN \`customer_email\` text;`)
    await db.run(sql`ALTER TABLE \`orders\` ADD COLUMN \`customer_phone\` text;`)
    await db.run(sql`ALTER TABLE \`orders\` ADD COLUMN \`customer_company_name\` text;`)
    await db.run(sql`ALTER TABLE \`orders\` ADD COLUMN \`customer_tax_id\` text;`)
    await db.run(sql`ALTER TABLE \`orders\` ADD COLUMN \`shipping_address_recipient_name\` text;`)
    await db.run(sql`ALTER TABLE \`orders\` ADD COLUMN \`shipping_address_phone\` text;`)
    await db.run(sql`ALTER TABLE \`orders\` ADD COLUMN \`shipping_address_line1\` text;`)
    await db.run(sql`ALTER TABLE \`orders\` ADD COLUMN \`shipping_address_line2\` text;`)
    await db.run(sql`ALTER TABLE \`orders\` ADD COLUMN \`shipping_address_city\` text;`)
    await db.run(sql`ALTER TABLE \`orders\` ADD COLUMN \`shipping_address_region\` text;`)
    await db.run(sql`ALTER TABLE \`orders\` ADD COLUMN \`shipping_address_postal_code\` text;`)
    await db.run(sql`ALTER TABLE \`orders\` ADD COLUMN \`shipping_address_country\` text;`)
    await db.run(sql`ALTER TABLE \`orders\` ADD COLUMN \`billing_same_as_shipping\` integer DEFAULT 1;`)
    await db.run(sql`ALTER TABLE \`orders\` ADD COLUMN \`billing_address_recipient_name\` text;`)
    await db.run(sql`ALTER TABLE \`orders\` ADD COLUMN \`billing_address_phone\` text;`)
    await db.run(sql`ALTER TABLE \`orders\` ADD COLUMN \`billing_address_line1\` text;`)
    await db.run(sql`ALTER TABLE \`orders\` ADD COLUMN \`billing_address_line2\` text;`)
    await db.run(sql`ALTER TABLE \`orders\` ADD COLUMN \`billing_address_city\` text;`)
    await db.run(sql`ALTER TABLE \`orders\` ADD COLUMN \`billing_address_region\` text;`)
    await db.run(sql`ALTER TABLE \`orders\` ADD COLUMN \`billing_address_postal_code\` text;`)
    await db.run(sql`ALTER TABLE \`orders\` ADD COLUMN \`billing_address_country\` text;`)
    await db.run(sql`ALTER TABLE \`orders\` ADD COLUMN \`shipping_cost\` numeric;`)
    await db.run(sql`ALTER TABLE \`orders\` ADD COLUMN \`currency\` text DEFAULT 'EUR';`)
    await db.run(sql`ALTER TABLE \`orders\` ADD COLUMN \`order_status\` text DEFAULT 'pending_payment';`)
    await db.run(sql`ALTER TABLE \`orders\` ADD COLUMN \`payment_status\` text DEFAULT 'unpaid';`)
    await db.run(sql`ALTER TABLE \`orders\` ADD COLUMN \`checkout_request_hash\` text;`)
    addedOrderColumns = true

    // ── Step 3: Backfill legacy orders ─────────────────────────────────────
    await db.run(sql`UPDATE \`orders\` SET \`order_number\` = 'LEGACY-' || \`id\` WHERE \`order_number\` IS NULL;`)
    await db.run(sql`UPDATE \`orders\` SET \`customer_email\` = \`email\`, \`customer_name\` = '' WHERE \`customer_email\` IS NULL;`)
    await db.run(sql`UPDATE \`orders\` SET \`currency\` = 'EUR' WHERE \`currency\` IS NULL;`)

    // Map legacy status → new statuses
    await db.run(sql`UPDATE \`orders\` SET \`order_status\` = 'pending_payment', \`payment_status\` = 'unpaid' WHERE \`status\` = 'pending';`)
    await db.run(sql`UPDATE \`orders\` SET \`order_status\` = 'confirmed', \`payment_status\` = 'paid' WHERE \`status\` = 'paid';`)
    await db.run(sql`UPDATE \`orders\` SET \`order_status\` = 'cancelled', \`payment_status\` = 'unpaid' WHERE \`status\` = 'cancelled';`)

    // ── Step 4: Rebuild orders_items — flower text → flower_id FK ──────────
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS \`orders_items_new\` (
        \`_order\` integer NOT NULL,
        \`_parent_id\` integer NOT NULL,
        \`id\` text PRIMARY KEY NOT NULL,
        \`flower_id\` integer,
        \`name\` text,
        \`price\` numeric,
        \`qty\` numeric DEFAULT 1,
        \`line_total\` numeric,
        \`production_mode\` text,
        FOREIGN KEY (\`_parent_id\`) REFERENCES \`orders\`(\`id\`) ON DELETE cascade ON UPDATE no action,
        FOREIGN KEY (\`flower_id\`) REFERENCES \`flowers\`(\`id\`) ON DELETE set null ON UPDATE no action
      );
    `)
    createdNewItemsTable = true

    // Copy and transform data
    await db.run(sql`
      INSERT INTO \`orders_items_new\` (
        \`_order\`, \`_parent_id\`, \`id\`, \`flower_id\`, \`name\`, \`price\`, \`qty\`, \`line_total\`, \`production_mode\`
      )
      SELECT
        oi.\`_order\`, oi.\`_parent_id\`, oi.\`id\`,
        CAST(oi.\`flower\` AS INTEGER), oi.\`name\`, oi.\`price\`, oi.\`qty\`,
        oi.\`price\` * oi.\`qty\`,
        f.\`production_mode\`
      FROM \`orders_items\` oi
      LEFT JOIN \`flowers\` f ON CAST(oi.\`flower\` AS INTEGER) = f.\`id\`;
    `)

    // Verify row count
    const oldRowCount = await db.get(sql`SELECT COUNT(*) AS cnt FROM \`orders_items\`;`)
    const newRowCount = await db.get(sql`SELECT COUNT(*) AS cnt FROM \`orders_items_new\`;`)
    if (oldRowCount?.cnt !== newRowCount?.cnt) {
      throw new Error(
        `[UP] Row count mismatch: old=${oldRowCount?.cnt} new=${newRowCount?.cnt}. ` +
        'Migration aborted to prevent data loss.'
      )
    }

    // Drop old table, rename new
    await db.run(sql`DROP TABLE IF EXISTS \`orders_items\`;`)
    droppedOldItemsTable = true
    await db.run(sql`ALTER TABLE \`orders_items_new\` RENAME TO \`orders_items\`;`)
    renamedTable = true

    // ── Step 5: Add indexes ────────────────────────────────────────────────
    await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS \`orders_order_number_unique\` ON \`orders\` (\`order_number\`);`)
    createdIndexes.push('orders_order_number_unique')
    await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS \`orders_checkout_request_hash_unique\` ON \`orders\` (\`checkout_request_hash\`);`)
    createdIndexes.push('orders_checkout_request_hash_unique')
    await db.run(sql`CREATE INDEX IF NOT EXISTS \`orders_customer_email_idx\` ON \`orders\` (\`customer_email\`);`)
    createdIndexes.push('orders_customer_email_idx')
    await db.run(sql`CREATE INDEX IF NOT EXISTS \`orders_order_status_idx\` ON \`orders\` (\`order_status\`);`)
    createdIndexes.push('orders_order_status_idx')
    await db.run(sql`CREATE INDEX IF NOT EXISTS \`orders_payment_status_idx\` ON \`orders\` (\`payment_status\`);`)
    createdIndexes.push('orders_payment_status_idx')
    await db.run(sql`CREATE INDEX IF NOT EXISTS \`orders_items_flower_idx\` ON \`orders_items\` (\`flower_id\`);`)
    createdIndexes.push('orders_items_flower_idx')

  } catch (err) {
    // ── Compensatory cleanup ───────────────────────────────────────────────
    // SQLite DDL is NOT transactional — manually undo what we can.
    if (createdIndexes.length > 0) {
      for (const idx of createdIndexes) {
        try { await db.run(sql`DROP INDEX IF EXISTS \`${sql.raw(idx)}\`;`) } catch { /* best-effort */ }
      }
    }
    if (renamedTable) {
      // If we renamed orders_items_new → orders_items and something
      // after that failed, try to rename back.
      try {
        // Only rename back if the new table exists (old is gone)
        const check1 = await db.get(sql`SELECT name FROM sqlite_master WHERE type='table' AND name='orders_items';`)
        const checkNew = await db.get(sql`SELECT name FROM sqlite_master WHERE type='table' AND name='orders_items_new';`)
        if (check1 && !checkNew) {
          await db.run(sql`ALTER TABLE \`orders_items\` RENAME TO \`orders_items_new\`;`)
        }
      } catch { /* best-effort */ }
    }
    if (droppedOldItemsTable && !renamedTable) {
      // We dropped orders_items but didn't finish rename — unlikely state
      try { await db.run(sql`DROP TABLE IF EXISTS \`orders_items_new\`;`) } catch { /* best-effort */ }
    }
    if (createdNewItemsTable && !droppedOldItemsTable) {
      // New table exists, old one is intact — just drop the new one
      try { await db.run(sql`DROP TABLE IF EXISTS \`orders_items_new\`;`) } catch { /* best-effort */ }
    }
    if (addedOrderColumns) {
      // The ADD COLUMNs auto-committed and can't be rolled back by SQLite.
      // Best-effort: DROP COLUMN each one (SQLite 3.35+).
      try { await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`order_number\`;`) } catch { /* best-effort */ }
      try { await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`customer_name\`;`) } catch { /* best-effort */ }
      try { await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`customer_email\`;`) } catch { /* best-effort */ }
      try { await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`customer_phone\`;`) } catch { /* best-effort */ }
      try { await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`customer_company_name\`;`) } catch { /* best-effort */ }
      try { await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`customer_tax_id\`;`) } catch { /* best-effort */ }
      try { await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`shipping_address_recipient_name\`;`) } catch { /* best-effort */ }
      try { await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`shipping_address_phone\`;`) } catch { /* best-effort */ }
      try { await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`shipping_address_line1\`;`) } catch { /* best-effort */ }
      try { await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`shipping_address_line2\`;`) } catch { /* best-effort */ }
      try { await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`shipping_address_city\`;`) } catch { /* best-effort */ }
      try { await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`shipping_address_region\`;`) } catch { /* best-effort */ }
      try { await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`shipping_address_postal_code\`;`) } catch { /* best-effort */ }
      try { await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`shipping_address_country\`;`) } catch { /* best-effort */ }
      try { await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`billing_same_as_shipping\`;`) } catch { /* best-effort */ }
      try { await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`billing_address_recipient_name\`;`) } catch { /* best-effort */ }
      try { await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`billing_address_phone\`;`) } catch { /* best-effort */ }
      try { await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`billing_address_line1\`;`) } catch { /* best-effort */ }
      try { await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`billing_address_line2\`;`) } catch { /* best-effort */ }
      try { await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`billing_address_city\`;`) } catch { /* best-effort */ }
      try { await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`billing_address_region\`;`) } catch { /* best-effort */ }
      try { await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`billing_address_postal_code\`;`) } catch { /* best-effort */ }
      try { await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`billing_address_country\`;`) } catch { /* best-effort */ }
      try { await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`shipping_cost\`;`) } catch { /* best-effort */ }
      try { await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`currency\`;`) } catch { /* best-effort */ }
      try { await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`order_status\`;`) } catch { /* best-effort */ }
      try { await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`payment_status\`;`) } catch { /* best-effort */ }
      try { await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`checkout_request_hash\`;`) } catch { /* best-effort */ }
    }
    throw new Error(
      '[UP] Migration failed and was partially cleaned up: ' +
      (err instanceof Error ? err.message : String(err))
    )
  }
}

export async function down({ db }: MigrateArgs): Promise<void> {
  // ── Step 1: Validate — abort if any non-legacy data would be destroyed ──
  // Semantically equivalent check across SQLite and PostgreSQL.
  // Condition: an order is "non-legacy" if it has data that the DOWN would
  // destroy — i.e. non-default values in fields that didn't exist before.
  const nonLegacyOrders = await db.get(sql`
    SELECT COUNT(*) AS cnt FROM \`orders\`
    WHERE (
      \`customer_name\` IS NOT NULL AND \`customer_name\` != ''
    ) OR \`customer_phone\` IS NOT NULL
      OR \`customer_company_name\` IS NOT NULL
      OR \`customer_tax_id\` IS NOT NULL
      OR \`shipping_address_line1\` IS NOT NULL
      OR \`shipping_cost\` IS NOT NULL
      OR \`checkout_request_hash\` IS NOT NULL
      OR \`total\` IS NULL
      OR (\`order_number\` IS NOT NULL AND SUBSTR(\`order_number\`, 1, 7) != 'LEGACY-');
  `)
  if (nonLegacyOrders?.cnt > 0) {
    throw new Error(
      `[DOWN] ABORTED: ${nonLegacyOrders.cnt} order(s) have non-legacy data. ` +
      'This DOWN would destroy data added by the new schema. Ensure backup is available before rolling back.'
    )
  }

  // Non-legacy items — items whose lineTotal differs from price * qty
  // (i.e. the auto-calculated backfill value).
  const nonLegacyItems = await db.get(sql`
    SELECT COUNT(*) AS cnt FROM \`orders_items\`
    WHERE \`line_total\` IS NOT NULL
      AND \`line_total\` != COALESCE(\`price\`, 0) * COALESCE(\`qty\`, 0);
  `)
  if (nonLegacyItems?.cnt > 0) {
    throw new Error(
      `[DOWN] ABORTED: ${nonLegacyItems.cnt} item(s) have custom lineTotal. ` +
      'This DOWN would destroy data. Ensure backup is available before rolling back.'
    )
  }

  // ── Track DDL for compensation ──────────────────────────────────────────
  let createdOldItemsTable = false
  let droppedNewItemsTable = false

  try {
    // ── Step 2: Rebuild orders_items back to text flower ───────────────────
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS \`orders_items_old\` (
        \`_order\` integer NOT NULL,
        \`_parent_id\` integer NOT NULL,
        \`id\` text PRIMARY KEY NOT NULL,
        \`flower\` text,
        \`name\` text,
        \`price\` numeric,
        \`qty\` numeric DEFAULT 1,
        FOREIGN KEY (\`_parent_id\`) REFERENCES \`orders\`(\`id\`) ON DELETE cascade ON UPDATE no action
      );
    `)
    createdOldItemsTable = true

    // Copy data back: flower_id → text
    await db.run(sql`
      INSERT INTO \`orders_items_old\` (\`_order\`, \`_parent_id\`, \`id\`, \`flower\`, \`name\`, \`price\`, \`qty\`)
      SELECT \`_order\`, \`_parent_id\`, \`id\`, CAST(\`flower_id\` AS TEXT), \`name\`, \`price\`, \`qty\`
      FROM \`orders_items\`;
    `)

    // Verify row count
    const oldItemCount = await db.get(sql`SELECT COUNT(*) AS cnt FROM \`orders_items\`;`)
    const newItemCount = await db.get(sql`SELECT COUNT(*) AS cnt FROM \`orders_items_old\`;`)
    if (oldItemCount?.cnt !== newItemCount?.cnt) {
      throw new Error(
        `[DOWN] Row count mismatch: old=${oldItemCount?.cnt} new=${newItemCount?.cnt}. ` +
        'Rollback aborted to prevent data loss.'
      )
    }

    // Drop new table and rename old back
    await db.run(sql`DROP TABLE IF EXISTS \`orders_items\`;`)
    droppedNewItemsTable = true
    await db.run(sql`ALTER TABLE \`orders_items_old\` RENAME TO \`orders_items\`;`)

    // ── Step 3: Drop indexes before dropping columns (SQLite constraint) ───
    await db.run(sql`DROP INDEX IF EXISTS \`orders_order_number_unique\`;`)
    await db.run(sql`DROP INDEX IF EXISTS \`orders_checkout_request_hash_unique\`;`)
    await db.run(sql`DROP INDEX IF EXISTS \`orders_customer_email_idx\`;`)
    await db.run(sql`DROP INDEX IF EXISTS \`orders_order_status_idx\`;`)
    await db.run(sql`DROP INDEX IF EXISTS \`orders_payment_status_idx\`;`)
    await db.run(sql`DROP INDEX IF EXISTS \`orders_items_flower_idx\`;`)

    // ── Step 4: Drop added columns from orders (SQLite 3.35+) ──────────────
    await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`order_number\`;`)
    await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`customer_name\`;`)
    await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`customer_email\`;`)
    await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`customer_phone\`;`)
    await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`customer_company_name\`;`)
    await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`customer_tax_id\`;`)
    await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`shipping_address_recipient_name\`;`)
    await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`shipping_address_phone\`;`)
    await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`shipping_address_line1\`;`)
    await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`shipping_address_line2\`;`)
    await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`shipping_address_city\`;`)
    await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`shipping_address_region\`;`)
    await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`shipping_address_postal_code\`;`)
    await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`shipping_address_country\`;`)
    await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`billing_same_as_shipping\`;`)
    await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`billing_address_recipient_name\`;`)
    await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`billing_address_phone\`;`)
    await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`billing_address_line1\`;`)
    await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`billing_address_line2\`;`)
    await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`billing_address_city\`;`)
    await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`billing_address_region\`;`)
    await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`billing_address_postal_code\`;`)
    await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`billing_address_country\`;`)
    await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`shipping_cost\`;`)
    await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`currency\`;`)
    await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`order_status\`;`)
    await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`payment_status\`;`)
    await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`checkout_request_hash\`;`)

  } catch (err) {
    // Compensatory cleanup for DOWN
    if (droppedNewItemsTable && createdOldItemsTable) {
      // We dropped orders_items and renamed — complex state, try to restore
      try {
        const checkOld = await db.get(sql`SELECT name FROM sqlite_master WHERE type='table' AND name='orders_items_old';`)
        const checkCurrent = await db.get(sql`SELECT name FROM sqlite_master WHERE type='table' AND name='orders_items';`)
        if (!checkCurrent && checkOld) {
          await db.run(sql`ALTER TABLE \`orders_items_old\` RENAME TO \`orders_items\`;`)
        }
      } catch { /* best-effort */ }
    }
    if (createdOldItemsTable && !droppedNewItemsTable) {
      try { await db.run(sql`DROP TABLE IF EXISTS \`orders_items_old\`;`) } catch { /* best-effort */ }
    }
    throw new Error(
      '[DOWN] Migration rollback failed and was partially cleaned up: ' +
      (err instanceof Error ? err.message : String(err))
    )
  }
}