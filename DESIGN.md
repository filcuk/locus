# Locus — Design Document

> **Scope:** what Locus is, how it is built, and what has been decided. Product rules, domain model, architecture, and locked decisions live here and nowhere else.
> **Not here:** how to work in this repository — conventions, commands, quality gates, verification, and agent workflow are in [`AGENTS.md`](./AGENTS.md).

| § | Section | § | Section |
|---|---------|---|---------|
| [1](#1-product-vision) | Product vision | [8](#8-client) | Client |
| [2](#2-goals-and-non-goals) | Goals and non-goals | [9](#9-deployment) | Deployment |
| [3](#3-key-flows) | Key flows | [10](#10-security) | Security |
| [4](#4-domain-model) | Domain model, ACL | [11](#11-implementation-phases) | Implementation phases |
| [5](#5-sync) | Sync | [12](#12-success-criteria) | Success criteria |
| [6](#6-technology-stack) | Technology stack | [13](#13-risks-and-open-items) | Risks, open items, settled |
| [7](#7-backend) | Backend | | |

---

## 1. Product vision

**Locus** records geographic features at three nested levels—**points** (POIs/features), **places**, and **areas**—plus **collections** for cross-cutting organization. Users attach notes, tags, comments, and photos, and can view, save, and share any of these individually or in groups. Public links allow read-only access without an account.

```text
Area  (optional parent)
 ├── Place  (standalone or inside an area)
 │    └── Point / POI / feature  (standalone, in a place, or directly in an area)
 └── Point / POI / feature       (directly in an area, no intervening place)

Collection  (organizational; members may be areas, places, and/or points)
```

- A **point** may be standalone, belong to a **place**, or belong directly to an **area**.
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
- Public browse/discovery index (see [§13](#13-risks-and-open-items) open items)
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
3. Create a **place** / **area**; nest points into places or straight into areas, and places into areas; optionally add to **collections**.
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
| Point | Yes | Place **or** Area — at most one |
| Place | Yes | Area |
| Area | Yes | — |
| Collection | Yes | — (membership only) |

A point carries `place_id` **or** `area_id`, never both — enforced by a database check constraint. When a point sits in a place that sits in an area, its membership of that area is transitive and derived; never denormalised onto the point, or re-parenting the place silently leaves the point pointing at the wrong area.

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
  id, owner_id, place_id?, area_id?,     # at most one set; CHECK enforces it
  title, description?,
  lat, lon, elevation_m?, position_source (manual|map|gps)?,
  feature_kind?, recorded_at?,
  visibility, created_at, updated_at, updated_by, deleted_at?

Collection
  id, owner_id, title, description?,
  visibility, created_at, updated_at, updated_by, deleted_at?

CollectionItem
  id, collection_id, item_type (area|place|point), item_id, position?,
  added_at, updated_at, deleted_at?      # tombstoned like every synced table

Tag                    # scope=system → curated, global, read-only to users
  id, scope (system|user), owner_id?, label, colour?, icon?
  # scope=user → private to owner_id; invisible to everyone else, even on shared items
Tagging                # targets: area | place | point | collection

Note                   # personal timeline — private to its author, always
  id, author_id, target_type, target_id, body?, visited_at?,
  created_at, updated_at, deleted_at?
  # visited_at set ⇒ this note is a visit. Either body or visited_at must be present.
  # "last visit" and "visit count" are derived per-viewer, never stored.

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
- Geometric containment (point-in-polygon in TypeScript via Turf, with bbox as the SQL pre-filter) answers "what falls inside this shape". It is **not** membership: a point belongs to an area only when `area_id` is set. A point may sit inside an area's polygon while belonging to nothing, and the map should not imply otherwise.
- Validate rings; simplify (Douglas-Peucker) and cap vertices so sync payloads stay small.

### Sharing and ACL

- Any area, place, point, or collection can be shared or publicly linked.
- **Shares inherit downward:** a grant on a parent grants the same read access to its current children — place → its points; area → its places, those places' points, **and its direct points** — and to collection members the viewer may access.
- **`visibility` governs anonymous/public exposure only** (confirmed). A child marked `private` is excluded from a parent's public or unlisted exposure, but remains visible to users holding an explicit share on the parent.
- **Write:** `edit` on a place allows creating/editing points under that place, and `edit` on an area allows the same for its places and its direct points; neither grants edit over children owned by someone else.
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
2. **Notes and `user`-scoped tags ⇒ author/owner only.** A `Note`, and any `Tag` with `scope=user`, is invisible to every other principal regardless of shares, public links, or ownership of the target. No exceptions. Consequences to hold onto: visit counts differ per viewer, two people viewing one place see different tag chips, and tag filters return different results for each of them.
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
- `timestamp` is WatermelonDB's field name for what we return as a sequence watermark. Only advance it past fully-committed transactions (hard part 3 below).
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
- **Rejected records are parked, not retried forever** (hard part 5 below). They surface in the UI as conflicts and must not block later changes in the queue.
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
| Markdown | Descriptions only; sanitised **server-side** for public pages (library unchosen, [§13](#13-risks-and-open-items)) |
| Notifications | Optional operator-supplied outbound webhook. We ship no notifier — see below |

**Three workspaces, and only three:** `apps/api` (Hono + Drizzle), `apps/app` (Expo + Expo Router), and `packages/shared` (Zod schemas, sync types, geometry helpers) — anything both sides must agree on lives in `shared` so it cannot drift. Directory conventions are in `AGENTS.md`.

### Repository layout

Planned target, not yet scaffolded. Routes under `apps/app/app/` are listed in [§8](#8-client) rather than repeated here.

```text
locus/
  apps/
    api/
      src/
        index.ts               # Hono app + server bootstrap
        env.ts                 # Zod-validated process.env; fail fast on bad config
        db/
          schema.ts            # Drizzle pg-core tables — single source of truth
          client.ts            # PGlite or node-postgres, selected by DATABASE_URL
          migrate.ts           # startup migrations behind an advisory lock
        routes/                # auth · areas · places · points · collections
                               # tags · notes · comments · photos
                               # shares · invites · publicLinks
                               # media · sync · public (GET /p/:token + OG shell)
        services/
          permissions.ts       # can() — the only ACL implementation anywhere
          syncApply.ts         # shared by REST writes and /sync/push
          changeLog.ts         # server_seq watermark, compaction
          mediaStorage.ts      # content-addressed writes + derivatives
          markdown.ts          # server-side sanitiser for public pages
          mailer.ts · notifier.ts
        ws/live.ts             # change hints only; in-process fan-out
      drizzle/                 # generated migrations — never hand-edited once shipped
      test/
      Dockerfile · drizzle.config.ts · package.json
    app/
      app/                     # Expo Router routes (§8) — the doubled name is Expo's convention
      src/
        db/                    # WatermelonDB schema, models, local migrations
        sync/                  # synchronize() driver, outbox, photo upload queue
        map/                   # MapLibre wrappers; *.native.tsx / *.web.tsx splits
        features/              # screen composition by domain
        ui/                    # shared primitives
        i18n/                  # string catalogue
      assets/                  # user-supplied only — never agent-generated
      app.config.ts · package.json
  packages/
    shared/
      src/
        schemas/               # Zod: entities, sync wire contract, API payloads
        permissions/           # matrix fixture + predicates
        geometry/              # Turf: bbox, point-in-polygon, simplify, distance
        types/
      package.json
  deploy/
    docker-compose.yml · docker-compose.postgres.yml · .env.example
  .github/workflows/ci.yml     # typecheck · lint · test · licence gate
  .cursor/rules/
  package.json · pnpm-workspace.yaml · tsconfig.base.json
  DESIGN.md · AGENTS.md · README.md · ATTRIBUTION.md · LICENSE
```

Three placements are load-bearing rather than stylistic:

- **`shared/geometry`** holds distance and containment because Home ordering (client) and pull filtering (server) must agree to the metre. Two implementations would drift silently.
- **`shared/permissions`** exports the [§4](#4-domain-model) matrix as data, so `can()` and the API tests read one table.
- **`api/services/syncApply.ts`** is imported by the domain routes, not parallel to them — that is what keeps ChangeLog consistent.

No `utils/` or `helpers/` catch-alls: a module that cannot be named after what it does belongs somewhere else.

### Why these, briefly

- **Postgres only** avoids maintaining two Drizzle schemas and two migration sets; PGlite keeps the "no external database" story for simple deployments.
- **WatermelonDB** supplies the local store, outbox, and per-column change tracking that we would otherwise hand-roll, and its web adapter avoids the COOP/COEP headers that SQLite-WASM would force on us (those headers conflict with third-party tiles and images).
- **Operator-supplied tiles** because the public OSM tile service does not permit application-scale use.
- **Notifications are a webhook we POST to, not a notifier we bundle.** Apprise is a Python library (BSD-2-Clause) and its REST wrapper `apprise-api` (MIT) is a sidecar container — either would put Python in our Node image or add a second service, both of which we have ruled out. An operator who already runs Apprise, ntfy, or anything webhook-shaped sets `NOTIFY_WEBHOOK_URL` and we post to it. Operators who set nothing get email via existing SMTP config, or nothing. Notifications are off by default and opt-in per user, since outbound calls leave the self-hosted boundary.
- **Hand-rolled auth** because the offline model needs month-long refresh TTLs and device-bound sessions that also feed sync echo suppression. A session library would own the schema and fight both. The scope stays small — password hashing, token issue/refresh/revoke, reset — and password hashing itself uses a vetted Argon2id implementation, never a bespoke one.

---

## 7. Backend

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
| `NOTIFY_WEBHOOK_URL` | Optional; Apprise-compatible / ntfy / raw webhook. Unset ⇒ no outbound notifications |

API surface: auth (incl. password reset); domain CRUD; media upload/derivatives; shares, invites, public links; `GET /p/:token`; `GET /sync/pull`, `POST /sync/push`; live WebSocket.

Two architectural constraints on that surface:

- **Domain writes and sync apply share one path** so ChangeLog stays consistent — a REST write and a pushed change must be indistinguishable downstream.
- **A single `can(principal, action, resource)`** backs REST, sync, media, and WS subscribe, implementing [§4](#4-domain-model)'s resolution order once.

Operational requirements: run migrations at startup behind a lock, and never destructively on a default path; expose a healthcheck; run as non-root; structured logs that never contain tokens, coordinates, or user emails.

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
  (auth)/login.tsx · register.tsx · forgot-password.tsx
  (app)/_layout.tsx
  (app)/index.tsx              # Home — map + hierarchical entry list
  (app)/collections.tsx        # Home's second tab
  (app)/map.tsx                # Full-screen map; area drawing lives here
  (app)/new.tsx                # Type + parent picker
  (app)/search.tsx
  (app)/areas/[id].tsx · places/[id].tsx · points/[id].tsx
  (app)/collections/[id].tsx
  (app)/[type]/[id]/share.tsx  # Access management: shares, links, revoke
  (app)/settings/
    index · profile · security · invites · tags
    notifications · storage · sync · trash
  p/[token].tsx                # Public read-only
```

### Home

Map across the top (current fix, entry pins, area polygons), hierarchical list below, FAB to add. Two tabs: entries and collections.

**The list keeps the hierarchy and sorts roots by distance.** A child is never detached from its parent — you always see the containing area or place — so proximity reorders whole subtrees rather than promoting a lone nested point. An area's children are a mix of places and its own direct points, rendered at the same level.

Distance of a row is the distance to the nearest thing it contains:

- **Area:** `0` when the fix is inside the polygon, otherwise distance to the polygon edge. Containment gives "you are here" highlighting for free.
- **Place / point:** its own coordinates.
- **Any parent:** the minimum of its own distance and its descendants'.

Children sort by the same rule inside their parent. With no location fix, fall back to most-recently-updated. Recompute on screen focus and on pull-to-refresh — v1 takes one-shot fixes only, so there is no continuous tracking and no geofencing before P7.

### Entry screen

Photo gallery header, then title and **markdown** description, tag chips, visit stats, the note/visit timeline, and comments. FAB offers edit, add visit, add comment, add photo.

- **Notes and visits are one timeline.** A note with `visited_at` is a visit; without it, a plain note. Both are private to their author, so "last visit" and "visit count" are the viewer's own and are computed on read, never stored.
- **Comments are the collaborative channel**, visible to anyone who can view the entry.
- **Tags:** curated `system` set plus the viewer's own private tags. Never show another user's private tags.
- **Markdown must be sanitised**, and on `p/[token]` it renders to anonymous visitors, so sanitisation happens server-side in the preview shell rather than only in the client renderer.

**Polygon drawing** is a real workstream, not a library call: `terra-draw` or `mapbox-gl-draw` covers web, but MapLibre React Native has no draw tool, so native needs custom gestures over `ShapeSource`/`FillLayer`. Geometry maths lives in `packages/shared` so both platforms share one implementation.

---

## 9. Deployment

One **API** container, listening on **8000** by default. Postgres, when external, is user-supplied. No sync sidecar. Expo web is served as static assets by the API or a reverse proxy — never a second app service. The database (when PGlite) and media both persist under `/data`.

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
| **P1** | Auth (incl. server URL + reset) + points/places offline + pull/push sync; Home hierarchy with distance ordering; sync status indicator |
| **P2** | Areas with polygon draw; collections tab; system + private tags; notes/visits timeline; comments; markdown descriptions; search |
| **P3** | Photos: local capture, upload queue, derivatives, ACL |
| **P4** | Shares, invites, public GUID links + server-rendered preview shell; access-management screen; notification webhook |
| **P5** | Live WebSocket collaboration |
| **P6** | Hardening: late-grant backfill, revocation, compaction, conflict inbox, trash/restore, backups, export |
| **P7** | Breadcrumb tracks + high-volume sync; GPX |

### P0 must also deliver

Conventions are only real once something enforces them. **P0 is not done until CI fails the build on every gate listed in `AGENTS.md`** — typecheck, the lint bans, the test suite with the permission matrix iterated as a fixture, and the licence allow-list check.

P0 also carries two de-risking spikes, both cheap now and expensive later:

- **WatermelonDB schema shape.** Its columns are limited to string, number, and boolean with no foreign-key constraints, so `geom_geojson` is a serialised string and containment is enforced in application code. Confirm the client schema against [§4](#4-domain-model) before P2 builds areas on top of it.
- **Cursor semantics.** WatermelonDB types `lastPulledAt` as a timestamp while we return a `server_seq` watermark. Prove the round-trip holds before P1.

---

## 12. Success criteria

- GPS point in airplane mode: instant UI; syncs after reconnect.
- Nest point → place → area, and point → area directly; share any level; public GUID link is read-only and previews correctly when pasted into a chat app.
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
- **Markdown library:** unchosen, and needs one renderer that works on native and web plus a server-side sanitiser for public pages. Needed before P2.
- **Tagging a user in a comment.** The interaction is agreed; the permission story is not. A commenter often cannot grant access to a resource they do not own, so either only the owner may tag a user who lacks access, or the tag raises an access request the owner approves. Note also that tagging reveals a resource's existence to someone who cannot yet see it. Needed before P4.
- **Public browse:** whether `public` visibility ever gets a discovery index (and the moderation that implies).

### Settled — do not reopen without a design change

| Decision | Outcome |
|----------|---------|
| Effective visibility rule | Confirmed as written in [§4](#4-domain-model); `visibility` gates anonymous exposure only |
| Auth | Hand-rolled JWT over the `Session` table with Argon2id, not a session library |
| Monorepo tooling | pnpm workspaces, no Turborepo |
| `device_id` lifecycle | New UUID per install, stored beside the local database |
| Notes vs comments | Notes are a personal visit timeline, private to their author forever; comments are collaborative and follow the target's view permission |
| Visits | A note with `visited_at`; private, so visit counts are per-viewer and derived on read |
| Tags | Curated `system` set, plus `user`-scoped tags private to their owner |
| Home ordering | Hierarchy preserved; roots sorted by distance to their nearest descendant |
| Notifications | Optional operator-supplied webhook; we bundle no notifier and add no container |
| Sync engine | WatermelonDB client library over our own Hono/`ChangeLog` protocol; no external sync appliance |
| Server database | Postgres dialect only — PGlite embedded or external Postgres; no server-side SQLite |
| Container count | Exactly one Locus API container; optional user-supplied Postgres only |
| Runtime | Node LTS in Docker |
