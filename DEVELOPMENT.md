# Development — local run and device builds

Human-facing guide for running the API and the Expo client (web + Android development build) on a maintainer machine.

Product rules and stack choices live in [`DESIGN.md`](./DESIGN.md). Conventions, CI gates, and agent workflow live in [`AGENTS.md`](./AGENTS.md). This file only covers **how to run** the tree on your machine.

---

## Prerequisites

| Need | Notes |
|------|--------|
| **Node.js** | `>=24.7` (see root `package.json` `engines`; required for `node:crypto` Argon2id) |
| **pnpm** | `11.18.0` (`packageManager` field). Enable via Corepack: `corepack enable` |
| **Android SDK** (for native) | Install Android Studio / SDK. Set **both** `ANDROID_HOME` and `ANDROID_SDK_ROOT` to the **same real SDK root** (the directory that contains `platform-tools`, not a parent shortcuts folder) |
| **JDK** | Required by Gradle when building the Android app (Android Studio’s bundled JDK is fine) |
| **Docker** (optional) | Only if you prefer Compose over `pnpm dev` / `pnpm dev:api` |
| **Windows firewall** | First time Metro / Expo / adb listen on a port, Windows may prompt — **approve manually**; a silent block looks like a hung start |

From the repo root:

```powershell
pnpm install
```

---

## Run locally (API + Expo web)

Primary path — one command from the repo root starts the API (with local env defaults) and Expo web in parallel:

```powershell
pnpm dev
```

| Piece | How |
|-------|-----|
| **API** | `@locus/api` `dev` → `scripts/dev-api.mjs` sets `SECRET_KEY` / `MEDIA_ROOT` if unset, creates `.data/media`, then `tsx watch` |
| **Expo web** | `@locus/app` `dev` → `expo start --web` (same as `web`) |

Uses `pnpm --parallel` across those two workspace packages — no extra process runner.

- API listens on **port 8000** by default (`PORT`). Health: `GET http://localhost:8000/health`.
- Expo prints a Metro URL (often `http://localhost:8081`).
- `SECRET_KEY` defaulted by the script is **local-only** (`dev-secret-local-only`) — never use it in production or Compose deploys.
- Omit `DATABASE_URL` so the API uses embedded PGlite (data beside `.data/media`).
- Point the client at the API origin via the in-app server URL (never hardcode an instance — see AGENTS §4).
- First listen may trigger a **Windows Firewall** prompt for Node — approve for private networks or the start looks hung.

Individual halves: `pnpm dev:api` or `pnpm dev:web`.

---

## API (manual or Compose)

Env keys and defaults are documented in [`deploy/.env.example`](./deploy/.env.example) and DESIGN §7 / §9. The API fails fast if required vars are missing (`SECRET_KEY`, `MEDIA_ROOT`). Prefer [`pnpm dev`](#run-locally-api--expo-web) above when you want the client too.

### Local process only (two-terminal fallback)

`pnpm --filter api dev` already applies the local env defaults via `scripts/dev-api.mjs`. Use separate terminals when you do not want `pnpm dev`:

```powershell
# terminal 1
pnpm dev:api

# terminal 2
pnpm dev:web
```

To set env yourself (without the helper), omit `DATABASE_URL` for PGlite:

```powershell
$env:SECRET_KEY = "dev-secret-local-only"
$env:MEDIA_ROOT = "$PWD\.data\media"
New-Item -ItemType Directory -Force -Path $env:MEDIA_ROOT | Out-Null
pnpm --filter api exec tsx watch src/index.ts
```

### Docker Compose

Simple / PGlite (one API container):

```powershell
cd deploy
# Optional: copy .env.example to .env and set SECRET_KEY
docker compose -f docker-compose.yml up --build
```

External Postgres (optional):

```powershell
cd deploy
docker compose -f docker-compose.postgres.yml up --build
```

Compose maps **8000:8000**. Data/media for the simple file live under the `locus-data` volume (`MEDIA_ROOT=/data/media` inside the container).

---

## Expo web (alone)

Prefer [`pnpm dev`](#run-locally-api--expo-web) so the API is up too. To start only the client:

Requires the app workspace with Expo scripts (`web`, `start`, `test:e2e` in `apps/app/package.json`). Use a branch that has the real client (e.g. after I1 / `chore/p0-integration`), not an early stub that only has `typecheck`.

```powershell
pnpm --filter app web
# same as: pnpm dev:web
```

That runs `expo start --web`. Open the URL Metro prints (often `http://localhost:8081`).

### Web e2e (Playwright)

```powershell
pnpm --filter app test:e2e
```

Playwright starts its own Expo web server (default port **19006**, overridable with `LOCUS_E2E_PORT` — see `apps/app/playwright.config.ts`).

Unit tests for the app package:

```powershell
pnpm --filter app test
```

---

## Android development build

MapLibre and WatermelonDB need a **development build**. **Expo Go is not supported** and is not a valid verification path (AGENTS §4, DESIGN §6).

`apps/app/android/` is **generated** and gitignored (see root `.gitignore`). Create or refresh it with prebuild, then compile and install:

```powershell
# Ensure ANDROID_HOME and ANDROID_SDK_ROOT both point at the real SDK
cd apps/app
pnpm exec expo prebuild --platform android
pnpm exec expo run:android
```

Equivalent from the repo root:

```powershell
pnpm --filter app exec expo prebuild --platform android
pnpm --filter app exec expo run:android
```

- Device or emulator must be visible to `adb`.
- After native dependency or config-plugin changes, run `prebuild` again (or clean `android/` and regenerate).
- Day-to-day JS reload: `pnpm --filter app start` (`expo start --dev-client`) once a build is installed.

There is no automated native MapLibre check in CI — see the verification table below.

---

## Verification

| Surface | Who / how | What it proves |
|---------|-----------|----------------|
| **Web UI** | Automated: Playwright (`pnpm --filter app test:e2e`); screenshots as evidence | Routes and web MapLibre render in CI / local e2e |
| **Web unit** | Vitest (`pnpm --filter app test`) | Logic without a browser |
| **API** | Vitest + Testcontainers Postgres (`pnpm --filter api test`) | Sync, permissions, migrations |
| **Android MapLibre / native modules** | **Maintainer** on a local `expo run:android` dev build | Native map and WatermelonDB — **not** claimable from agent environments or Expo Go |

Repo-wide gates (typecheck, lint, tests, licences): see AGENTS §6.

---

## Common pitfalls

| Symptom | Likely cause |
|---------|----------------|
| Gradle / `expo run:android` cannot find the SDK | `ANDROID_HOME` or `ANDROID_SDK_ROOT` unset, mismatched, or pointing at Android Studio’s install root instead of the **SDK** directory |
| App cannot reach `http://…` LAN / localhost API on device | Android blocks cleartext HTTP by default; self-hosted plain-HTTP URLs need an explicit cleartext allowance (DESIGN risks / Android notes) or use HTTPS |
| `pnpm --filter app web` / missing `expo` scripts | Checked out a **stub** or pre-client tip (e.g. early `main` or a paths-only branch) — use a tip that includes the Expo app (post–I1 / `chore/p0-integration`) |
| Metro / adb “does nothing” on Windows | Firewall denied the listen/connect prompt; approve for private networks |
| “Works in Expo Go” | Irrelevant here — native modules will not load; use a dev build |
| Compose up but empty `SECRET_KEY` in production-like deploys | Set a real secret in `deploy/.env`; the compose default is only for local convenience |

---

## Related docs

- [`DESIGN.md`](./DESIGN.md) — domain, sync, stack, deployment
- [`AGENTS.md`](./AGENTS.md) — conventions, CI, verification policy
- [`deploy/.env.example`](./deploy/.env.example) — operator env keys
