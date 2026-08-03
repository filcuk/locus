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
| `expo` | npm | MIT | Expo SDK — client runtime and tooling |
| `expo-router` | npm | MIT | File-based navigation (DESIGN §8 route tree) |
| `expo-dev-client` | npm | MIT | Development builds (Expo Go cannot load native modules) |
| `expo-constants` | npm | MIT | App config access for Expo Router |
| `expo-linking` | npm | MIT | Deep linking for Expo Router |
| `expo-status-bar` | npm | MIT | Status bar styling |
| `expo-secure-store` | npm | MIT | Native Keychain/Keystore persistence for auth tokens, `device_id`, and server URL (web uses `localStorage`) |
| `expo-location` | npm | MIT | Foreground one-shot GPS for Home distance ordering (no background tracking) |
| `react` | npm | MIT | UI library |
| `react-dom` | npm | MIT | React DOM renderer for web |
| `react-native` | npm | MIT | Native UI primitives |
| `react-native-web` | npm | MIT | React Native primitives on web |
| `react-native-safe-area-context` | npm | MIT | Safe area insets (Expo Router peer) |
| `react-native-screens` | npm | MIT | Native navigation screens (Expo Router peer) |
| `react-native-gesture-handler` | npm | MIT | Gesture system (Expo Router peer) |
| `react-native-reanimated` | npm | MIT | Animations (Expo Router peer) |
| `react-native-worklets` | npm | MIT | Worklets runtime peer of Reanimated |
| `playwright` / `@playwright/test` | npm | Apache-2.0 | Web smoke tests for the Expo web target |
| `@expo/metro-runtime` | npm | MIT | Metro runtime required for Expo web |
| `@testcontainers/postgresql` | npm | MIT | Real Postgres for API permission / sync tests |
| `@nozbe/watermelondb` | npm | MIT | Local DB + sync driver (SQLite native / LokiJS web) |
| `@nozbe/sqlite` | npm (via WatermelonDB) | blessing (SQLite public domain) | Native SQLite amalgamation mirror for WatermelonDB |
| `@nozbe/lokijs` | npm (via WatermelonDB) | MIT | Web adapter persistence for WatermelonDB |
| `@babel/plugin-proposal-decorators` | npm | MIT | Legacy decorators for WatermelonDB models |
| `@babel/plugin-proposal-class-properties` | npm | MIT | Class fields companion for WatermelonDB decorators |
| `maplibre-gl` | npm | BSD-3-Clause | MapLibre GL JS — web map renderer |
| `@maplibre/maplibre-react-native` | npm | MIT | MapLibre React Native — Android map renderer |

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
