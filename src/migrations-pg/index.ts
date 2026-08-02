import * as migration_20260801_094419_flowers_story_localized_pg from './20260801_094419_flowers_story_localized_pg';
import * as migration_20260801_105830_categories_localized_pg from './20260801_105830_categories_localized_pg';
import * as migration_20260802_073913_collections_localized_pg from './20260802_073913_collections_localized_pg';

export const migrations = [
  {
    up: migration_20260801_094419_flowers_story_localized_pg.up,
    down: migration_20260801_094419_flowers_story_localized_pg.down,
    name: '20260801_094419_flowers_story_localized_pg'
  },
  {
    up: migration_20260801_105830_categories_localized_pg.up,
    down: migration_20260801_105830_categories_localized_pg.down,
    name: '20260801_105830_categories_localized_pg'
  },
  {
    up: migration_20260802_073913_collections_localized_pg.up,
    down: migration_20260802_073913_collections_localized_pg.down,
    name: '20260802_073913_collections_localized_pg'
  },
];