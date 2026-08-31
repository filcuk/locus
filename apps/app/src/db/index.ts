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
  createCommentLocal,
  createNoteLocal,
  createPlaceLocal,
  createPointLocal,
  createTaggingLocal,
  createUserTagLocal,
  isTagAssignableByViewer,
  isTagInViewerCatalog,
  retireUserTagLocal,
  softDeleteCollectionLocal,
  softDeleteCollectionItemLocal,
  updateCollectionLocal,
  softDeleteCommentLocal,
  softDeleteNoteLocal,
  softDeletePlaceLocal,
  softDeletePointLocal,
  softDeleteTaggingLocal,
} from './writes';
