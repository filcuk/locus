# Locus

Offline-first app for areas, places, and points (POIs)—with collections, notes, tags, comments, photos, sharing, and public links.

**Platforms:** Android and Web (Expo). **API:** self-hosted Hono (TypeScript) in one Docker container, using an embedded PGlite database or an external Postgres. **Sync:** local-first store with pull/push against our own server.

## Docs

- [DESIGN.md](./DESIGN.md) — product and architecture
- [AGENTS.md](./AGENTS.md) — contributor / agent guidance
- [DEVELOPMENT.md](./DEVELOPMENT.md) — local API, Expo web, and Android dev-build runbook

## Status

Stack locked: TypeScript monorepo (Hono + Drizzle + Expo Router + WatermelonDB + MapLibre). Implementation not started.
