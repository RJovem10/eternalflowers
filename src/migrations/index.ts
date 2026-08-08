import * as migration_20260801_083313 from './20260801_083313';
import * as migration_20260801_103101_categories_localized from './20260801_103101_categories_localized';
import * as migration_20260802_072328_collections_localized from './20260802_072328_collections_localized';
import * as migration_20260802_082923_homepage_localized from './20260802_082923_homepage_localized';
import * as migration_20260803_123500_product_model from './20260803_123500_product_model';
import * as migration_20260803_181000_stock_reservations from './20260803_181000_stock_reservations';
import * as migration_20260808_000000_orders_model from './20260808_000000_orders_model';
import * as migration_20260808_000001_checkout_fields from './20260808_000001_checkout_fields';
import * as migration_20260808_000002_payment_fields from './20260808_000002_payment_fields';

export const migrations = [
  {
    up: migration_20260801_083313.up,
    down: migration_20260801_083313.down,
    name: '20260801_083313'
  },
  {
    up: migration_20260801_103101_categories_localized.up,
    down: migration_20260801_103101_categories_localized.down,
    name: '20260801_103101_categories_localized'
  },
  {
    up: migration_20260802_072328_collections_localized.up,
    down: migration_20260802_072328_collections_localized.down,
    name: '20260802_072328_collections_localized'
  },
  {
    up: migration_20260802_082923_homepage_localized.up,
    down: migration_20260802_082923_homepage_localized.down,
    name: '20260802_082923_homepage_localized'
  },
  {
    up: migration_20260803_123500_product_model.up,
    down: migration_20260803_123500_product_model.down,
    name: '20260803_123500_product_model'
  },
  {
    up: migration_20260803_181000_stock_reservations.up,
    down: migration_20260803_181000_stock_reservations.down,
    name: '20260803_181000_stock_reservations'
  },
  {
    up: migration_20260808_000000_orders_model.up,
    down: migration_20260808_000000_orders_model.down,
    name: '20260808_000000_orders_model'
  },
  {
    up: migration_20260808_000001_checkout_fields.up,
    down: migration_20260808_000001_checkout_fields.down,
    name: '20260808_000001_checkout_fields'
  },
  {
    up: migration_20260808_000002_payment_fields.up,
    down: migration_20260808_000002_payment_fields.down,
    name: '20260808_000002_payment_fields'
  },
];