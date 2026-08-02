# Locus — Design Document

> Purpose: Product and architecture spec for implementing Locus.  
> Companion: [`AGENTS.md`](./AGENTS.md).

---

## 1. Product vision

**Locus** records geographic features at three nested levels—**points** (POIs/features), **places**, and **areas**—plus **collections** for cross-cutting organization. Users attach notes, tags, comments, and photos, and can view, save, and share any of these individually or in groups. Public links allow read-only access without an account.

```text
Area  (optional parent)
 └── Place  (standalone or inside an area)
      └── Point / POI / feature  (standalone or inside a place)

Collection  (organizational; members may be areas, places, and/or points)
```

- A **point** may be standalone or belong to a **place**.
- A **place** may be standalone or belong to an **area**.
- **Collections** organize items; they are not required to view, save, or share.

**Platforms:** Android and Web (primary). iOS later if cheap with Expo. No desktop-native apps.

**UX promise:** every interaction feels instant. Local writes succeed immediately; network work is asynchronous and never blocks the UI.

**GPS:** v1 uses one-shot **current position** for points (and optional place reference positions). **Breadcrumb trails** and GPX are in scope later—keep sync/storage extensible for high-frequency samples.

**Self-hosted:** each operator runs their own instance. The app must therefore let a user point it at an arbitrary server.

---

## 2. Goals and non-goals

### Goals

| ID | Goal |
|----|------|
| G1 | Offline-first create/read/update of owned data |
| G2 | **Live** mode: near-real-time multi-user collaboration |
| G3 | **Power-saving** mode: sync on change / batched; no persistent socket |
| G4 | Accounts; share any area / place / point / collection; public GUID links |
| G5 | Instant UI feedback on all interactions |
| G6 | One API Docker container; embedded database for simple/dev, external Postgres for production |
| G7 | Android + Web; self-hosted only |
| G8 | Photos in v1 |

### Non-goals (v1)

- Extra sync appliances (PowerSync, Electric, Couch, etc.)
- Native desktop apps; iOS as a hard requirement
- Social feed, messaging, turn-by-turn navigation
- Hosted SaaS; OAuth; anonymous comments on public links
- Public browse/discovery index (see §12 open items)
- Multi-region active-active clustering; multi-replica API

### Deferred (post-v1, in scope)

- Breadcrumb / track recording (attach to place, area, or standalone)
- GPX import/export
- Rich track UI (stats, elevation) as needed
- Offline basemap tiles (PMTiles/Protomaps is the intended path)

---

## 3. Key flows

1. Choose server (self-hosted URL), sign up / sign in / sign out; session survives restart and long offline periods.
2. Create a **point** (map long-press, manual coords, or current GPS)—standalone or under a place—offline.
3. Create a **place** / **area**; nest points → places → areas; optionally add to **collections**.
4. Notes, tags, comments, photos on features.
5. Share an item with another user on the instance; or create a **public GUID link** (anonymous read-only).
6. Sync modes: offline / power-saving / live.
7. Collaborators in live mode see updates without refresh; LWW on conflict.
8. Photos work offline and upload when online.

---

## 4. Domain model

Client-generated **UUIDv7** (or UUIDv4) primary keys for all user-owned entities.

### Containment

| Entity | Standalone | Optional parent |
|--------|------------|-----------------|
| Point | Yes | Place |
| Place | Yes | Area |
| Area | Yes | — |
| Collection | Yes | — (membership only) |

### Entities

```
User
  id, email, email_verified_at?, display_name, password_hash, created_at, …

Area
  id, owner_id, title, description?,
  geom_geojson,                          # Polygon | MultiPolygon WGS84 (source of truth)
  bbox_min_lat, bbox_min_lon, bbox_max_lat, bbox_max_lon,  # derived on write
  visibility (private|unlisted|public),
  created_at, updated_at, updated_by, deleted_at?

Place
  id, owner_id, area_id?, title, description?,
  lat?, lon?, elevation_m?, position_source (manual|map|gps)?,
  visibility, created_at, updated_at, updated_by, deleted_at?

Point
  id, owner_id, place_id?, title, description?,
  lat, lon, elevation_m?, position_source (manual|map|gps)?,
  feature_kind?, recorded_at?,
  visibility, created_at, updated_at, updated_by, deleted_at?

Collection
  id, owner_id, title, description?,
  visibility, created_at, updated_at, updated_by, deleted_at?

CollectionItem
  id, collection_id, item_type (area|place|point), item_id, position?,
  added_at, updated_at, deleted_at?      # tombstoned like every synced table

Tag / Tagging          # tagging targets: area | place | point | collection

Note                   # personal visit timeline — private to its author, always
  id, author_id, target_type, target_id, body?, visited_at,
  created_at, updated_at, deleted_at?

Comment                # collaborative — visible to anyone who can view the target
  id, author_id, target_type, target_id, body,
  created_at, updated_at, deleted_at?

Photo
  id, owner_id, target_type, target_id,
  sha256?, storage_key?, content_type, byte_size?, width?, height?, caption?,
  upload_state (local_only|pending|uploaded|failed),
  created_at, updated_at, deleted_at?
  # local file path is client-only state, never synced

Share
  id, resource_type (area|place|point|collection), resource_id,
  grantee_user_id, permission (view|comment|edit), created_by, created_at

Invite                 # share targeted at an email with no account yet
  id, email, resource_type, resource_id, permission, token_hash, expires_at, created_by

PublicLink
  id, resource_type, resource_id,
  token_hash,                            # store hash; GUID only ever lives in the URL
  permission (view), expires_at?, revoked_at?, created_by

ChangeLog
  server_seq, entity_type, entity_id, op, payload,
  actor_id, device_id, created_at

Session / RefreshToken
  id, user_id, token_hash, device_id, expires_at, revoked_at?

# Post-v1
Track / TrackPoint     # breadcrumbs — not POI Point; batch sync strategy TBD at P7
```

Client tables mirror these plus WatermelonDB's own bookkeeping columns (`_status`, `_changed`), which provide per-column change tracking and the local outbox.

### Area geometry

- **Source of truth:** GeoJSON Polygon/MultiPolygon; free-shape drawing on the map.
- **Derived bbox** columns for viewport queries; never treat bbox as the true boundary.
- Containment: point-in-polygon in TypeScript (Turf), with bbox as the SQL pre-filter.
- Validate rings; simplify (Douglas-Peucker) and cap vertices so sync payloads stay small.

### Sharing and ACL

- Any area, place, point, or collection can be shared or publicly linked.
- **Shares inherit downward:** a grant on a parent grants the same read access to its current children (place → its points; area → places and their points), and to collection members the viewer may access.
- **`visibility` governs anonymous/public exposure only** (confirmed). A child marked `private` is excluded from a parent's public or unlisted exposure, but remains visible to users holding an explicit share on the parent.
- **Write:** `edit` on a place allows creating/editing points under that place; it never grants edit over children owned by someone else.
- Standalone point share does not expose siblings or the full parent tree.
- Soft-delete via `deleted_at`; **cascade soft-delete** owned children when a parent is deleted, emitted as one cascade event rather than thousands of ops.
- Anonymous public viewers: **read-only**.

### Permission matrix

Authoritative for `can(principal, action, resource)`. This table is the test fixture — `packages/shared` exports it and the API tests iterate it, so a behaviour change here fails CI until the code agrees.

| Principal | view | comment | create child | edit | delete | manage shares |
|-----------|:----:|:-------:|:------------:|:----:|:------:|:-------------:|
| Owner | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Share `edit` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Share `comment` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Share `view` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Public link holder | ✅¹ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Authenticated, no grant | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Anonymous, no token | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

¹ Subject to `visibility`; see rule 4 below.

**Resolution order** — evaluate in sequence, first match wins:

1. **Soft-deleted ⇒ deny everyone.** `deleted_at` rows never appear in REST, pull, or public payloads.
2. **Notes ⇒ author only.** A `Note` is invisible to every other principal regardless of shares, public links, or ownership of the target. No exceptions.
3. **Owner ⇒ allow.** The resource's `owner_id` always wins.
4. **Public link token ⇒ view only**, on the linked resource plus inherited children whose `visibility` is not `private`. A token never grants comment or write, and never traverses upward to parents or siblings.
5. **Effective share = strongest grant** across the resource and all its ancestors (`edit` > `comment` > `view`). `visibility` does **not** reduce it — a `private` child of a shared parent is still visible to that share holder.
6. **Otherwise deny.**

**Delete** is owner-only and always soft. A share `edit` holder who creates a child owns that child outright, and so may delete it under rule 3.

### Visibility

| Visibility | Discover | Open |
|------------|----------|------|
| `private` | Owner + shares | Owner + shares |
| `unlisted` | Not indexed | Anyone with GUID link |
| `public` | Reserved for a future browse feature | Anyone (read); write needs account + permission |

### Photos

Local-first bytes; upload API when online; metadata syncs like any other row. Server stores content-addressed files under the media volume and generates **thumbnail + medium derivatives** (clients must never fetch full-res for lists). Strip EXIF GPS on upload unless the user opts to use it for placement. Public links expose photos for the linked resource and its inherited children only.

---

## 5. Sync

### Modes

| Mode | Behavior |
|------|----------|
| **Offline** | Local only; changes accumulate locally |
| **Power-saving** (default online) | Debounced push after change; pull on interval / resume / explicit refresh; **no** persistent socket |
| **Live** | Power-saving + **WebSocket** that pushes "changes available" hints, triggering an immediate pull |

### Engine

The client uses **WatermelonDB** for the local database, per-column change tracking, and the push/pull sync driver. The server is still entirely ours: Hono endpoints implement WatermelonDB's sync protocol over our own `ChangeLog`. This is a client library, not a sync sidecar — the one-container rule is unaffected.

```
┌──────────────────────────────────────────────┐
│ Expo (Android + Web), Expo Router            │
│  UI ←→ WatermelonDB (SQLite native / LokiJS  │
│        + IndexedDB on web)                   │
│  synchronize() driver + photo upload queue   │
└──────────────────────┬───────────────────────┘
                       │ HTTPS + WSS (live only)
┌──────────────────────▼───────────────────────┐
│ Hono + Drizzle — ONE container               │
│  Auth · CRUD · share · public links · media  │
│  GET /sync/pull · POST /sync/push · WS live  │
│  ChangeLog (server_seq)                      │
└──────────────────────┬───────────────────────┘
                       │
        PGlite (embedded) or external Postgres
```

- Live WS carries change hints only; payloads always arrive via pull, so one code path applies remote data.
- Public links never join sync; they read `GET /p/:token`.

### Wire contract

Defined as Zod schemas in `packages/shared` and covered by a conformance suite that both the API and the client driver run against. **Write the schemas and the suite before either implementation.** Anything below that the code contradicts is a bug in the code.

`GET /sync/pull?cursor=<server_seq>&device_id=<uuid>&schema_version=<n>`

```jsonc
{
  "changes": {
    "areas":  { "created": [ /* full rows */ ], "updated": [ /* full rows */ ], "deleted": [ "id" ] },
    "places": { "created": [], "updated": [], "deleted": [] }
    // one key per synced table, always present even when empty
  },
  "timestamp": 41822   // new cursor = fully-committed server_seq watermark
}
```

- `cursor` is a `server_seq`, never a wall clock. `cursor=0` means full sync.
- `timestamp` is WatermelonDB's field name for what we return as a sequence watermark. Only advance it past fully-committed transactions (§5 hard part 3).
- Rows the caller may no longer access appear in `deleted` — revocation and soft-delete are indistinguishable to the client, and both purge locally.
- Late grants inject the affected rows into `created`/`updated` regardless of cursor.
- Rows authored by the calling `device_id` are omitted (echo suppression).

`POST /sync/push`

```jsonc
// request
{ "push_id": "uuid", "cursor": 41822, "device_id": "uuid",
  "changes": { "points": { "created": [], "updated": [], "deleted": [] } } }

// response
{ "applied": 12, "timestamp": 41830, "rejected": [
  { "table": "points", "id": "uuid", "code": "FORBIDDEN", "message": "…" } ] }
```

- **Idempotency:** the server stores `push_id` with its response for a retention window and replays that stored response verbatim on a repeat.
- **Stale cursor ⇒ `409 PULL_REQUIRED`.** The client pulls, rebases, and retries; the server never merges blind.
- **Rejected records are parked, not retried forever** (§5 hard part 5). They surface in the UI as conflicts and must not block later changes in the queue.
- Server assigns `updated_at` and ordering; client wall clocks are never trusted for LWW.

**Error codes:** `PULL_REQUIRED` (409), `CURSOR_TOO_OLD` (409, client restarts at `cursor=0`), `SCHEMA_VERSION_UNSUPPORTED` (426), `FORBIDDEN` (403), `VALIDATION_FAILED` (422).

**`device_id`** is a UUID generated on first launch and stored beside the local database. It is per-install by design: a reinstall wipes local data and needs a full resync anyway, so a surviving id would carry no useful state.

### Guarantees

- Local write < ~50 ms perceived; >~150 ms work shows pending/optimistic UI.
- Live fan-out < ~1–2 s best-effort.
- Push is idempotent; the local queue survives process death.
- UI never blocks on network.
- Conflicts: server applies **LWW** with server ordering (never client wall clocks); WatermelonDB merges per changed column locally.

### Hard parts that must be handled explicitly

1. **Late grants.** A resource shared with you today has old `server_seq` values and will never appear via a plain cursor. On new grant, include the affected records in the next pull regardless of cursor (or force a scoped resync).
2. **Revocation.** Losing access must arrive as a delete-like event so the client purges those local rows.
3. **Sequence watermarks.** Postgres sequences can commit out of order, so a naive `since` cursor silently skips rows. Assign `server_seq` under a single-writer lock, or only advance the readable watermark past fully-committed transactions.
4. **Echo suppression.** ChangeLog records `device_id`; clients ignore their own ops on pull.
5. **Poison changes.** A permanently-rejected push must be parked after N attempts with a conflict surfaced in the UI, never blocking later changes.
6. **Log compaction.** ChangeLog and the idempotency table need compaction, plus a "cursor too old → full resync" path.
7. **Photo ordering.** Metadata can arrive before bytes exist; gate rendering on `upload_state` and expect 404s.

Do not add external sync sidecars.

---

## 6. Technology stack

| Layer | Choice |
|-------|--------|
| Language | TypeScript monorepo |
| Tooling | **pnpm workspaces** — no Turborepo at three packages; revisit if CI gets slow |
| API | **Hono** (Node LTS in Docker) |
| ORM | **Drizzle** (`pg-core`) + drizzle-kit |
| Server DB | **Postgres only** — embedded **PGlite** for simple/dev, external Postgres for production |
| Client | **Expo** with a **development build** (native modules; Expo Go is not usable) |
| Navigation | **Expo Router** |
| Local DB + sync driver | **WatermelonDB** (SQLite on native, LokiJS + IndexedDB on web) |
| Maps | **MapLibre** — `maplibre-gl` on web, `@maplibre/maplibre-react-native` on Android |
| Tiles | **Operator-supplied style URL + API key** (MapTiler, Stadia, or self-hosted); OSM attribution required |
| Geometry | **Turf.js** (bbox, point-in-polygon, simplify) in `packages/shared` |
| Validation | **Zod** in `packages/shared`, shared by API and client |
| Auth | Email + password; **hand-rolled JWT** access + refresh over the `Session` table; Argon2id |
| Public links | GUID/UUID; Expo Router `p/[token]` with a server-rendered HTML shell for previews |
| Media | Content-addressed files on the API container volume + generated derivatives |

```text
locus/
  apps/
    api/          # Hono + Drizzle (Docker)
    app/          # Expo + Expo Router
  packages/
    shared/       # Zod schemas, sync types, geometry helpers
  deploy/
```

Use `*.native.tsx` / `*.web.tsx` where MapLibre APIs diverge.

### Why these, briefly

- **Postgres only** avoids maintaining two Drizzle schemas and two migration sets; PGlite keeps the "no external database" story for simple deployments.
- **WatermelonDB** supplies the local store, outbox, and per-column change tracking that we would otherwise hand-roll, and its web adapter avoids the COOP/COEP headers that SQLite-WASM would force on us (those headers conflict with third-party tiles and images).
- **Operator-supplied tiles** because the public OSM tile service does not permit application-scale use.
- **Hand-rolled auth** because the offline model needs month-long refresh TTLs and device-bound sessions that also feed sync echo suppression. A session library would own the schema and fight both. The scope stays small — password hashing, token issue/refresh/revoke, reset — and password hashing itself uses a vetted Argon2id implementation, never a bespoke one.

---

## 7. Backend

```
apps/api/src/
  index.ts
  env.ts
  db/schema.ts
  routes/          # auth, areas, places, points, collections, shares, publicLinks, media, sync, p
  services/        # permissions, syncApply, mediaStorage, mailer
  ws/live.ts
```

| Env | Purpose |
|-----|---------|
| `DATABASE_URL` | External Postgres; unset ⇒ embedded PGlite under `/data` |
| `SECRET_KEY` | JWT / token signing |
| `ACCESS_TOKEN_TTL` / `REFRESH_TOKEN_TTL` | Session TTLs (refresh must tolerate long offline periods) |
| `MEDIA_ROOT` | e.g. `/data/media` |
| `MAP_STYLE_URL` | Tile style served to clients (may embed the operator's key) |
| `CORS_ORIGINS` | Web origins for this instance |
| `PUBLIC_BASE_URL` | Link generation |
| `SMTP_*` | Password reset, verification, invites |

API surface: auth (incl. password reset); domain CRUD; media upload/derivatives; shares, invites, public links; `GET /p/:token`; `GET /sync/pull`, `POST /sync/push`; live WebSocket. Domain writes and sync apply share one path so ChangeLog stays consistent. A single `can(principal, action, resource)` backs REST, sync, media, and WS subscribe.

Operational: run migrations at startup behind a lock; expose a healthcheck; run as non-root; structured logs with no tokens.

---

## 8. Client

1. WatermelonDB is the UI source of truth; the network is a side effect.
2. Optimistic UI; sync driver and photo upload queue own all network I/O.
3. Sync mode indicator: Offline / Syncing / Live / Error.
4. Map-first: long-press, GPS, polygon drawing.
5. Expo Router routes shared between Android and Web.
6. A **server URL** screen precedes login, since every instance is self-hosted.
7. Never wipe local data on a 401; refresh must be single-flight to avoid logout loops.

```text
app/
  server-setup.tsx
  (auth)/login.tsx
  (auth)/register.tsx
  (app)/_layout.tsx
  (app)/index.tsx
  (app)/areas/[id].tsx
  (app)/places/[id].tsx
  (app)/points/[id].tsx
  (app)/collections/[id].tsx
  (app)/settings.tsx
  p/[token].tsx
```

**Polygon drawing** is a real workstream, not a library call: `terra-draw` or `mapbox-gl-draw` covers web, but MapLibre React Native has no draw tool, so native needs custom gestures over `ShapeSource`/`FillLayer`. Geometry maths lives in `packages/shared` so both platforms share one implementation.

---

## 9. Deployment

One **API** container. Postgres, when external, is user-supplied. No sync sidecar. Expo web is served as static assets by the API or a reverse proxy — never a second app service.

```text
# Simple / dev: embedded PGlite, no external database
docker run -p 8000:8000 -v locus-data:/data \
  -e MEDIA_ROOT=/data/media -e MAP_STYLE_URL=... locus-api
```

```yaml
services:
  db:
    image: postgres:16
  api:
    image: locus-api:latest
    environment:
      DATABASE_URL: postgresql://locus:…@db:5432/locus
      MEDIA_ROOT: /data/media
      MAP_STYLE_URL: https://api.maptiler.com/maps/…/style.json?key=…
    volumes: [locus-media:/data/media]
    ports: ["8000:8000"]
```

Android specifics: the app requires a **development build**; self-hosters on plain-HTTP LAN addresses need an explicit cleartext-traffic allowance or the app fails opaquely. Distribution (Play Store vs APK/F-Droid) is unresolved and affects background-location work at P7.

---

## 10. Security

- Argon2id for passwords, via a vetted library — never a bespoke hashing routine.
- Refresh tokens are hashed at rest, single-use with rotation, bound to a `Session` row that can be revoked per device.
- Public links: GUID/UUID in the URL, **hashed at rest**; revoke/expiry; no short or sequential ids.
- `Referrer-Policy: no-referrer` on public pages so tokens don't leak to tile or image hosts; keep tokens out of media URLs.
- WebSocket auth uses a short-lived ticket (browsers cannot set handshake headers; tokens in query strings end up in logs).
- Rate-limit auth, public, and upload endpoints (in-memory limits reset on restart — acceptable for one container).
- Media URLs enforce ACL / public-link scope.
- Soft-deleted and unauthorized data never appear in pull or public payloads.

---

## 11. Implementation phases

| Phase | Deliverable |
|-------|-------------|
| **P0** | pnpm scaffold; Hono + Drizzle + PGlite; Expo dev build with WatermelonDB and a map; CI gates; sync contract and permission matrix in `packages/shared` |
| **P1** | Auth (incl. server URL + reset) + points/places offline + pull/push sync |
| **P2** | Areas with polygon draw, collections, tags, notes, comments |
| **P3** | Photos: local capture, upload queue, derivatives, ACL |
| **P4** | Shares, invites, public GUID links + server-rendered preview shell |
| **P5** | Live WebSocket collaboration |
| **P6** | Hardening: late-grant backfill, revocation, compaction, conflicts, backups, export |
| **P7** | Breadcrumb tracks + high-volume sync; GPX |

### P0 must also deliver

Conventions are only real once something enforces them. P0 is not done until CI fails the build on:

- `tsc --noEmit` with `strict` and `noUncheckedIndexedAccess`.
- Lint rules banning `any`, and banning `fetch` inside `apps/app` outside the sync driver.
- The test suite, including the permission matrix iterated as a fixture.
- A licence checker with the allow-list from `.cursor/rules/licensing.mdc`.

P0 also carries two de-risking spikes, both cheap now and expensive later:

- **WatermelonDB schema shape.** Its columns are limited to string, number, and boolean with no foreign-key constraints, so `geom_geojson` is a serialised string and containment is enforced in application code. Confirm the client schema against §4 before P2 builds areas on top of it.
- **Cursor semantics.** WatermelonDB types `lastPulledAt` as a timestamp while we return a `server_seq` watermark. Prove the round-trip holds before P1.

### Verification

Web is built first and is the agent-facing feedback loop: Playwright drives it and screenshots are the evidence a UI change works. Android is verified by the maintainer on a dev build, because no automated check here can see a MapLibre native render. "Tests pass" is therefore **not** sufficient to call a visual change done — say plainly what was and was not verified.

---

## 12. Success criteria

- GPS point in airplane mode: instant UI; syncs after reconnect.
- Nest point → place → area; share any level; public GUID link is read-only and previews correctly when pasted into a chat app.
- Photo offline → uploads later for entitled users, with thumbnails on lists.
- Live collaborators see a tag within ~2 s; power-saving holds no socket.
- Deploy remains one API container, with or without external Postgres.

---

## 13. Risks and open items

### Known risks (accepted, mitigate during build)

| Risk | Mitigation |
|------|------------|
| PGlite is a WASM single-process Postgres; unproven for long-running self-host | Ship it for simple/dev; document external Postgres as the production path; same dialect either way |
| WatermelonDB web adapter (LokiJS/IndexedDB) is memory-resident | Cap synced working set; measure with realistic data before P4 |
| MapLibre native has no draw tooling | Treat polygon editing as its own workstream; share geometry logic in `packages/shared` |
| Dev build required (no Expo Go) | Set up EAS or local Android toolchain in P0 |
| WS fan-out is in-process | Documented single-replica constraint; revisit only if scaling demands it |
| P7 background location triggers Play Store policy review | Decide distribution before committing to Play |

### Open items

- **Distribution:** Play Store vs APK/F-Droid (drives signing, updates, background-location policy). Needed before P7.
- **OTA updates:** self-hosted `expo-updates` or none.
- **Polygon limits:** vertex cap and simplification tolerance. Needed before P2.
- **i18n library:** unchosen; strings are externalised by key from the start regardless, so the choice stays cheap.
- **Public browse:** whether `public` visibility ever gets a discovery index (and the moderation that implies).

### Settled — do not reopen without a design change

| Decision | Outcome |
|----------|---------|
| Effective visibility rule | Confirmed as written in §4; `visibility` gates anonymous exposure only |
| Auth | Hand-rolled JWT over the `Session` table with Argon2id, not a session library |
| Monorepo tooling | pnpm workspaces, no Turborepo |
| `device_id` lifecycle | New UUID per install, stored beside the local database |
| Notes vs comments | Notes are a personal visit timeline, private to their author forever; comments are collaborative and follow the target's view permission |
| Runtime | Node LTS in Docker |
