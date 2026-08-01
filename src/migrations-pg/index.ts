import * as migration_20260801_094419_flowers_story_localized_pg from './20260801_094419_flowers_story_localized_pg';

export const migrations = [
  {
    up: migration_20260801_094419_flowers_story_localized_pg.up,
    down: migration_20260801_094419_flowers_story_localized_pg.down,
    name: '20260801_094419_flowers_story_localized_pg'
  },
];