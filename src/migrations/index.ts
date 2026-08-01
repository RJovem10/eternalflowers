import * as migration_20260801_083313 from './20260801_083313';

export const migrations = [
  {
    up: migration_20260801_083313.up,
    down: migration_20260801_083313.down,
    name: '20260801_083313'
  },
];