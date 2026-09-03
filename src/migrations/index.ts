import * as migration_20260903_112012_init from './20260903_112012_init';

export const migrations = [
  {
    up: migration_20260903_112012_init.up,
    down: migration_20260903_112012_init.down,
    name: '20260903_112012_init'
  },
];
