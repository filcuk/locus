/**
 * Platform entry: Metro resolves `database.native.ts` / `database.web.ts`.
 * UI reads observables via `DatabaseProvider`; writers use containment helpers.
 */
export { DatabaseProvider } from './DatabaseProvider';
export { database } from './database';
export {
  assertPointContainment,
  isValidPointContainment,
  parseGeomGeojson,
  serializeGeomGeojson,
} from './containment';
export { schema } from './schema';
export { modelClasses } from './models';
export {
  createCollectionLocal,
  createCollectionItemLocal,
  createPlaceLocal,
  createPointLocal,
  softDeleteCollectionLocal,
  softDeleteCollectionItemLocal,
  softDeletePlaceLocal,
  softDeletePointLocal,
} from './writes';
