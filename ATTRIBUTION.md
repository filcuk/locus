# Attribution

Locus is distributed under the Apache License 2.0. This file credits the third-party libraries, assets, and data we ship or depend on.

Add a row when a dependency, asset, or data source is added; remove it when it goes. Verify the licence against the package's own LICENSE file at the version we use.

## Libraries

| Component | Source | Licence | Used for |
|---|---|---|---|
| `typescript` | npm | Apache-2.0 | Type system; the `tsc --noEmit` typecheck gate |
| `eslint` | npm | MIT | The lint gate |
| `typescript-eslint` | npm | MIT | TypeScript parser and rules for ESLint |
| `vitest` | npm | MIT | Test runner |
| `zod` | npm | MIT | Shared entity and sync wire schemas in `@locus/shared` |
| `uuid` | npm | MIT | Client-generated UUIDv7 primary keys |
| `@turf/bbox` | npm | MIT | Derived area bounding boxes |
| `@turf/boolean-point-in-polygon` | npm | MIT | Geometric containment checks |
| `@turf/simplify` | npm | MIT | Douglas–Peucker ring simplification |
| `@turf/distance` | npm | MIT | Shared metre distances for ordering/filters |
| `@turf/helpers` | npm | MIT | GeoJSON helpers used by the Turf wrappers |
| `hono` | npm | MIT | API framework |
| `@hono/node-server` | npm | MIT | Node HTTP adapter for Hono |
| `drizzle-orm` | npm | Apache-2.0 | Postgres ORM (`pg-core`) |
| `drizzle-kit` | npm | MIT | Drizzle migrations and schema tooling |
| `@electric-sql/pglite` | npm | Apache-2.0 | Embedded Postgres for simple/dev deploys |
| `pg` | npm | MIT | node-postgres driver for external Postgres |
| `tsx` | npm | MIT | TypeScript execution for API `dev` / `start` |

Planned, pending install and licence verification: Expo / Expo Router, React Native, WatermelonDB, MapLibre GL JS, MapLibre React Native.

## Assets

| Asset | Source | Licence | Used for |
|---|---|---|---|
| _(none yet)_ | | | |

## Map data and tiles

Map data is © OpenStreetMap contributors, available under the [Open Database License (ODbL)](https://www.openstreetmap.org/copyright).

Locus bundles no tiles. It defaults to the [OpenFreeMap](https://openfreemap.org/) public instance, which is free, needs no API key, and permits commercial use. Operators may point `MAP_STYLE_URL` at any other provider or at their own server, and are then responsible for that provider's terms.

| Component | Source | Licence | Used for |
|---|---|---|---|
| OpenFreeMap | openfreemap.org (public instance) | MIT (project); tiles from OSM data under ODbL | Default vector basemap tiles, glyphs, and sprites |
| OpenFreeMap styles | `hyperknot/openfreemap-styles` | BSD-3-Clause (code), CC BY 4.0 (design) | Basemap styling, forked from OpenMapTiles / OSM Bright / Positron |
| OpenMapTiles schema | openmaptiles.org | BSD-3-Clause (code), CC BY 4.0 (design) | Vector tile schema the styles target |

**Required on-screen notice:** `OpenFreeMap © OpenMapTiles Data from OpenStreetMap`. MapLibre renders this from the style's own attribution, so it appears automatically as long as we never suppress the attribution control. Any non-MapLibre surface — a static image, a printed export — must carry the string explicitly.

## Code snippets

Attribute any borrowed snippet here with its source URL and licence.

| Snippet | Source | Licence | Location in repo |
|---|---|---|---|
| _(none yet)_ | | | |
