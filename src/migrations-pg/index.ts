import * as migration_20260731_000000_baseline from './20260731_000000_baseline';
import * as migration_20260801_094419_flowers_story_localized_pg from './20260801_094419_flowers_story_localized_pg';
import * as migration_20260801_105830_categories_localized_pg from './20260801_105830_categories_localized_pg';
import * as migration_20260802_073913_collections_localized_pg from './20260802_073913_collections_localized_pg';
import * as migration_20260802_085819_homepage_localized_pg from './20260802_085819_homepage_localized_pg';
import * as migration_20260803_123500_product_model_pg from './20260803_123500_product_model';
import * as migration_20260803_181000_stock_reservations_pg from './20260803_181000_stock_reservations';
import * as migration_20260808_000000_orders_model_pg from './20260808_000000_orders_model';

export const migrations = [
  { up: migration_20260731_000000_baseline.up, down: migration_20260731_000000_baseline.down, name: '20260731_000000_baseline' },

  { up: migration_20260801_094419_flowers_story_localized_pg.up, down: migration_20260801_094419_flowers_story_localized_pg.down, name: '20260801_094419_flowers_story_localized_pg' },
  { up: migration_20260801_105830_categories_localized_pg.up, down: migration_20260801_105830_categories_localized_pg.down, name: '20260801_105830_categories_localized_pg' },
  { up: migration_20260802_073913_collections_localized_pg.up, down: migration_20260802_073913_collections_localized_pg.down, name: '20260802_073913_collections_localized_pg' },
  { up: migration_20260802_085819_homepage_localized_pg.up, down: migration_20260802_085819_homepage_localized_pg.down, name: '20260802_085819_homepage_localized_pg' },
  { up: migration_20260803_123500_product_model_pg.up, down: migration_20260803_123500_product_model_pg.down, name: '20260803_123500_product_model' },
  { up: migration_20260803_181000_stock_reservations_pg.up, down: migration_20260803_181000_stock_reservations_pg.down, name: '20260803_181000_stock_reservations' },
  { up: migration_20260808_000000_orders_model_pg.up, down: migration_20260808_000000_orders_model_pg.down, name: '20260808_000000_orders_model' },
];