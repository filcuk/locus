# AGENTS.md — Locus

How to work in this repository: conventions, workflow, quality gates, and verification.

**What Locus is, and every product or architecture decision, lives in [`DESIGN.md`](./DESIGN.md) — not here.** In one line: an offline-first, self-hosted app for geographic areas, places, and points, built as a TypeScript monorepo with a Hono API and an Expo client that syncs through WatermelonDB. Read the relevant DESIGN section before you implement anything.

---

## 1. Which document owns what

| Document | Owns | Do not put here |
|----------|------|-----------------|
| `DESIGN.md` | Product rules, domain model, ACL, sync protocol, stack choices and their rationale, phases, risks, settled decisions | Conventions, commands, workflow |
| `AGENTS.md` | This file — repo conventions, code organisation, CI gates, verification, agent workflow | Anything that decides *what* we build |
| `.cursor/rules/` | Enforced guardrails, one concern per file: doc structure, design adherence, decisions, security, privacy, licensing, attribution, assets, code quality, testing, i18n, API/data, offline-first client, native dependencies | Long-form specification |
| `ATTRIBUTION.md` | Every third-party library, asset, and data source we ship | — |
| `README.md` | Short human-facing intro | Deep guidance — that belongs here or in DESIGN |

A fact belongs in exactly one of these. If you need it in a second place, link to the first instead of copying it — two copies drift, and the next agent cannot tell which one is current. `.cursor/rules/doc-structure.mdc` is the enforced version of this table.

**If code and `DESIGN.md` disagree, stop and ask.** Do not quietly make the docs match the code.

### Where to read before you start

| Working on | Read |
|------------|------|
| Anything touching permissions, sharing, or public links | DESIGN §4 — the permission matrix and its resolution order |
| Sync, the wire contract, cursors, conflicts | DESIGN §5, including "hard parts that must be handled explicitly" |
| Adding or changing a dependency | DESIGN §6 and §13, then `.cursor/rules/licensing.mdc` — and ask first |
| API routes, env vars, operational behaviour | DESIGN §7 |
| Any screen, route, or list ordering | DESIGN §8 |
| Deployment, Docker, ports, volumes | DESIGN §9 |
| Deciding whether something is already settled | DESIGN §13 — open items need a decision, settled ones need a design change |

---

## 2. Repository layout

```text
locus/
  apps/
    api/                 # Hono + Drizzle (Docker)
    app/                 # Expo + Expo Router
  packages/
    shared/              # Zod schemas, sync types, permission fixture, Turf geometry helpers
  deploy/
  DESIGN.md
  AGENTS.md
  README.md
  ATTRIBUTION.md
```

```text
apps/api/src/
  index.ts
  env.ts
  db/schema.ts
  routes/                # auth, areas, places, points, collections, shares, publicLinks, media, sync, p
  services/              # permissions, syncApply, mediaStorage, mailer
  ws/live.ts
```

The client route tree is part of the product surface and is specified in DESIGN §8.

Anything both the API and the client must agree on — schemas, sync types, geometry maths, the permission fixture — goes in `packages/shared` so the two cannot drift.

---

## 3. Backend conventions (Hono / TypeScript)

- Validate every body, param, and query with a **Zod** schema imported from `packages/shared`. Never hand-roll a parallel schema in `apps/api`.
- **Drizzle** `pg-core` + drizzle-kit migrations. Use the query builder; never concatenate SQL.
- Permission checks go through the one `can(principal, action, resource)` service. No inline ownership checks in route handlers.
- Filter at the query level for list and pull endpoints. Never fetch-then-filter in JavaScript.
- Keep domain writes and sync apply on one path so `ChangeLog` cannot diverge between them.
- New config gets a placeholder row in `.env.example` in the same change. No secrets in git.
- Tests: **Vitest** + Hono's test client, with **Testcontainers** for real Postgres. Cover permissions, late-grant backfill, and sync idempotency early rather than at P6.

---

## 4. Client conventions (Expo)

- Requires a **development build** (`expo-dev-client`). Expo Go cannot load MapLibre or WatermelonDB, so "it runs in Expo Go" is not a signal.
- Components read WatermelonDB observables. A component must never fetch — the sync driver and the photo upload queue own all network I/O, and lint enforces it.
- Split platform-divergent files with `*.native.tsx` / `*.web.tsx`, which is where MapLibre's two APIs are reconciled (`maplibre-gl` on web, `@maplibre/maplibre-react-native` on Android).
- Polygon drawing: `terra-draw` / `mapbox-gl-draw` on web, custom gestures on native, shared geometry maths in `packages/shared`.
- The server URL is user-configurable. Never hardcode an instance, in code, tests, or fixtures.
- Never wipe local data on a 401. Token refresh must be single-flight or you get logout loops.
- Externalise user-facing strings by key from the start, even though the i18n library is unchosen.
- E2E: **Maestro** for Android, **Playwright** for web.

---

## 5. Coding style

- Match the surrounding code once it exists; its idiom wins over a general preference.
- Strict TypeScript, small focused modules, no unrelated refactors in a feature change.
- Comments explain a constraint the code cannot show. Do not narrate what the next line does.

---

## 6. Quality gates

These are what CI fails on, and they are a P0 deliverable — a convention nothing enforces is not a convention.

- `tsc --noEmit` with `strict` and `noUncheckedIndexedAccess`.
- Lint bans `any`, and bans `fetch` inside `apps/app` outside the sync driver.
- The test suite, including DESIGN §4's permission matrix iterated as a fixture exported from `packages/shared`.
- A licence checker against the allow-list in `.cursor/rules/licensing.mdc`.

```bash
pnpm install
pnpm --filter api dev
pnpm --filter app start
pnpm --filter api test
pnpm typecheck && pnpm lint && pnpm test    # what CI gates on
pnpm licences                               # allow-list check
```

pnpm workspaces, no Turborepo. These commands are the P0 target and are not real yet — update this section as they land.

---

## 7. Verifying your work

- **Web is the automated feedback loop.** Drive it under Playwright and use screenshots as the evidence that a UI change actually renders.
- **Android is verified by the maintainer** on a dev build. No automated check in this repo can see a MapLibre native render, so do not claim one.
- Passing tests is not the same as a working screen, and a successful build is not verification of anything visual.
- State plainly what you verified and what you could not. An unverified change described as done is worse than one described as unverified.

---

## 8. Workflow

1. Read the DESIGN sections for the area you touch (see the table in §1).
2. Keep changes scoped to what was asked.
3. Ask before anything in DESIGN §13's open items, before any new dependency, and before inventing behaviour the spec does not describe. Ambiguity is a question, not a free choice.
4. When a decision is made, record it in `DESIGN.md` in the same change that implements it, so the next session does not re-litigate it.
5. On a multi-step plan: complete one step, propose a commit message, then wait for "continue".
6. Never create a git commit unless explicitly asked. Commit messages explain **why**; PRs go through `gh` and include a test plan.
7. Next up when asked to implement: the P0 scaffold.

---

## 9. What not to do

Failure modes that have to be actively avoided. DESIGN is authoritative for why each one is closed.

- Do not swap the stack: no FastAPI, Fastify, Flutter, or Capacitor-as-primary.
- Do not add PowerSync, Electric, Couch, or any other sync sidecar. WatermelonDB is a client library; the protocol is ours.
- Do not add a server-side SQLite path or a second Drizzle dialect.
- Do not add a second container to the Compose file. Postgres is the only exception, and it is user-supplied.
- Do not bundle a notification service. We POST to an operator-supplied webhook; that is the whole feature.
- Do not build network-first with caching bolted on afterwards, and do not make normal use depend on an always-on socket.
- Do not point any environment at public OSM tile servers, and never hide the OSM attribution.
- Do not implement breadcrumbs or GPX before P7, but keep sync and storage extensible for them.
- Do not add OAuth or anonymous public comments in v1.
- Do not expand into navigation, social feeds, or SaaS billing unless asked.
- Do not add telemetry, crash reporting, phone-home calls, or runtime CDN assets. The only outbound calls are to the operator's own server, their tile provider, and their configured webhook.
- Do not invent icons, images, or brand marks, and do not use copyrighted assets without approval.
