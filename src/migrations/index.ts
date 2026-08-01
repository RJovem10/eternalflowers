import * as migration_20260801_083313 from './20260801_083313';
import * as migration_20260801_103101_categories_localized from './20260801_103101_categories_localized';

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
];