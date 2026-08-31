import { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';

import { modelClasses } from './models';
import { migrations } from './migrations';
import { schema } from './schema';

export function createDatabase(dbName: string): Database {
  const adapter = new LokiJSAdapter({
    dbName,
    schema,
    migrations,
    useWebWorker: false,
    useIncrementalIndexedDB: true,
    onSetUpError: (error) => {
      console.error('WatermelonDB LokiJS setup failed', error);
    },
  });

  return new Database({
    adapter,
    // WatermelonDB's Class<Model> typing is invariant over concrete subclasses.
    modelClasses: modelClasses as ConstructorParameters<typeof Database>[0]['modelClasses'],
  });
}
