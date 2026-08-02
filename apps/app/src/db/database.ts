/**
 * Type-only / fallback module. Metro prefers `database.native.ts` and
 * `database.web.ts`; this file exists so TypeScript path resolution succeeds
 * when platform extensions are not applied (e.g. unit tests that only import
 * schema helpers).
 */
export { database } from './database.web';
