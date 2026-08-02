# AGENTS.md — Locus

Instructions for AI agents and human contributors working in this repository.

Companion product/architecture spec: [`DESIGN.md`](./DESIGN.md). Read it before implementing features.

Human-facing overview: [`README.md`](./README.md) (keep short; put deep guidance here or in DESIGN).

---

## 1. What this project is

**Locus** is an offline-first app for geographic **areas**, **places**, and **points** (POIs/features), plus **collections**, notes, tags, comments, and photos—with sharing and public links.

**Containment:** Point → optional Place → optional Area. Collections organize any of these. All levels are viewable, savable, and shareable.

**Platforms:** Android + Web first; iOS only if cheap later.  
**Stack:** TypeScript monorepo — **Hono** API + **Expo** / **Expo Router** client + **Drizzle** (Postgres) + **WatermelonDB** local store + **MapLibre**.  
**Sync:** Our own server implementing WatermelonDB's pull/push protocol over a `ChangeLog` (DESIGN §5).  
**Deploy:** One API Docker container; embedded PGlite or external Postgres.

---

## 2. Source of truth

| Document | Role |
|----------|------|
| `DESIGN.md` | Product rules, domain model, sync architecture, locked decisions, risks |
| `AGENTS.md` | This file — conventions, workflows, agent behavior |
| `.cursor/rules/` | Enforced guardrails: design adherence, decisions, security, privacy, licensing, attribution, assets, code quality, testing |
| `ATTRIBUTION.md` | Third-party libraries, assets, and data we ship |
| `README.md` | Short human intro |

If code and DESIGN disagree, **stop and align docs or ask**.

Respect **DESIGN.md**. Do not add sync sidecars, change the database dialect, or swap the client stack without an explicit DESIGN change.

---

## 3. Non-negotiable product rules

1. **Offline-first:** UI reads/writes the local WatermelonDB store only. Sync is a side effect.
2. **Instant UI:** Acknowledge every interaction immediately; network never blocks the UI thread.
3. **Three sync modes:** offline, power-saving (no persistent socket), live (WebSocket hints that trigger a pull).
4. **Sync is ours:** WatermelonDB is a client library; the protocol is implemented by our Hono API. No PowerSync/Electric/Couch/etc.
5. **Client-generated UUIDs** for user-created entities.
6. **Exactly one Locus API container.** Optional user-supplied Postgres only.
7. **Postgres dialect only** — embedded PGlite for simple/dev, external Postgres for production. Do not reintroduce server-side SQLite.
8. **Domain:** Area / Place / Point hierarchy; Collections for organization; share any level.
9. **Area geometry:** GeoJSON Polygon/MultiPolygon is source of truth; maintain derived bbox on write; free-shape map drawing; never use bbox as the boundary.
10. **GPS:** v1 = one-shot current position. Breadcrumb trails later (P7) — keep storage/sync extensible.
11. **Photos in v1** — local-first, upload queue, server-side derivatives, ACL on media URLs.
12. **Public links:** GUID/UUID token, hashed at rest; revoke/expiry; Expo Router `/p/[token]` with a server-rendered preview shell.
13. **Email/password only**; **no** anonymous public comments; **self-host only** (the app must let users set the server URL).
14. **Maps:** MapLibre with an operator-supplied style URL. Never point at public OSM tile servers; always show OSM attribution.
15. **Do not** invent icons/images or use copyrighted assets without user approval.
16. **Apache-2.0:** every dependency and asset must be licence-compatible, free to use, and listed in `ATTRIBUTION.md`.
17. **No unilateral decisions:** new dependencies, schema changes, or unspecified behaviour need the user's approval first.
18. **No telemetry or third-party egress.** No analytics, crash reporting, phone-home, or runtime CDN assets. The only outbound calls are to the operator's own server and their configured tile provider.

---

## 4. Repository layout (target)

```text
locus/
  apps/
    api/                 # Hono + Drizzle
    app/                 # Expo + Expo Router
  packages/
    shared/              # Zod schemas, sync types, Turf geometry helpers
  deploy/
  DESIGN.md
  AGENTS.md
  README.md
```

---

## 5. Backend conventions (Hono / TypeScript)

- **Hono** + **Zod** validation, with schemas shared from `packages/shared`.
- **Drizzle** `pg-core` schema + drizzle-kit migrations; run migrations at startup behind a lock.
- Models: Area, Place, Point, Collection, CollectionItem, tags, notes, comments, photos, shares, invites, public links, sessions, ChangeLog.
- One `can(principal, action, resource)` for REST, sync apply, media, and WS subscribe — inheritance rules from DESIGN §4.
- Sync apply is **idempotent** and appends a monotonic `server_seq`; guard against out-of-order commits (DESIGN §5).
- ChangeLog rows carry `device_id` so clients can suppress their own echoes.
- Soft deletes via `deleted_at`; cascade soft-delete owned children as one event.
- Media under `MEDIA_ROOT`, content-addressed, with generated derivatives; never serve without ACL checks.
- Tests: Vitest + Hono's test client; Testcontainers for real Postgres. Cover permissions, late-grant backfill, and sync idempotency early.
- No secrets in git; `.env.example` only.

### Coding style

- Match existing code once present.
- Strict TypeScript; small focused modules; no unrelated refactors.

---

## 6. Client conventions (Expo)

- Requires a **development build** (`expo-dev-client`); Expo Go cannot load MapLibre or WatermelonDB.
- **WatermelonDB** is the UI source of truth; components read observables, never fetch.
- The sync driver and the photo upload queue own all network I/O.
- MapLibre: `maplibre-gl` on web, `@maplibre/maplibre-react-native` on Android; split with `*.native.tsx` / `*.web.tsx`.
- Polygon drawing: `terra-draw`/`mapbox-gl-draw` on web, custom gestures on native; shared geometry maths in `packages/shared` (Turf).
- Server URL is user-configurable; never hardcode an instance.
- Never wipe local data on a 401; refresh must be single-flight.
- Instant interaction checklist in DESIGN §8.
- E2E: Maestro for Android, Playwright for web.

---

## 7. Sync checklist

- [ ] Offline queue + instant UI
- [ ] Power-saving without persistent socket
- [ ] Live WebSocket hints trigger a pull (one apply path)
- [ ] Survives app kill
- [ ] Late grants backfill; revocation purges local rows
- [ ] Echo suppression via `device_id`
- [ ] Poison changes parked, never head-of-line blocking
- [ ] ChangeLog compaction + "cursor too old → full resync"
- [ ] ACL enforced on pull, media, and public links (incl. inheritance)
- [ ] LWW uses server ordering, never client wall clocks

**Do not** add external sync appliances.

---

## 8. How agents should work

1. Read `DESIGN.md` + this file for the area you touch.
2. Ask on DESIGN §13 open items before locking new dependencies.
3. Keep changes scoped to the request.
4. Update DESIGN/AGENTS/README when architecture or product rules change.
5. Do not create git commits unless the user explicitly asks.
6. On multi-step plans: one step, propose commit message, wait for “continue”.
7. Next: P0 scaffold when asked to implement.

### Verifying your work

- Web is the automated feedback loop: run it under Playwright and use screenshots as evidence a UI change renders.
- Android is verified by the maintainer on a dev build. No automated check here can see a MapLibre native render.
- Passing tests is **not** the same as a working screen. State plainly what you verified and what you could not.
- Never report a task complete on the strength of a build succeeding alone.

### Commits / PRs

- Commits only when asked; message focuses on **why**.
- PRs via `gh` when asked; include test plan.

---

## 9. Deployment notes

- API port default **8000**.
- Persist database (PGlite) and media under `/data`.
- Compose may include Postgres; **never** a second Locus service.
- Expo web ships as static assets served by the API or a reverse proxy.
- Migrations must not destroy user data on default paths.
- Run as non-root; expose a healthcheck.

---

## 10. Stack status

| Layer | Status |
|-------|--------|
| TypeScript monorepo | **Locked** |
| Hono + Drizzle API | **Locked** |
| Postgres only (PGlite or external) | **Locked** |
| Expo + Expo Router (dev build) | **Locked** |
| WatermelonDB local store + sync driver | **Locked** |
| MapLibre + operator-supplied tiles | **Locked** |
| One API container | **Locked** |
| Area / Place / Point + Collections | **Locked** |
| Hand-rolled JWT auth + Argon2id | **Locked** |
| pnpm workspaces, Node LTS | **Locked** |
| Distribution, OTA updates, polygon limits, i18n library | **Open** (DESIGN §13) |

---

## 11. Useful commands (fill in as repo grows)

pnpm workspaces; no Turborepo. Commands below are the P0 target, not yet real.

```bash
pnpm install
pnpm --filter api dev
pnpm --filter app start
pnpm --filter api test
pnpm typecheck && pnpm lint && pnpm test    # what CI gates on
pnpm licences                               # allow-list check
```

---

## 12. What not to do

- Do not introduce FastAPI, Fastify, Flutter, or Capacitor-only as the primary stack.
- Do not add PowerSync, Electric, Couch, or other sync sidecars.
- Do not add a server-side SQLite path or a second Drizzle dialect.
- Do not build network-first with cache-as-afterthought.
- Do not require always-on sockets for normal use.
- Do not point any environment at public OSM tile servers.
- Do not implement breadcrumb/GPX until P7; keep sync/storage extensible.
- Do not add OAuth or anonymous public comments in v1.
- Do not expand into navigation, social feeds, or SaaS billing unless asked.
