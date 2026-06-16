# ACSL Media Website

Stats- und Broadcast-Plattform für die **ACSL** (Austrian College Sports League, American Football):
öffentliche Fan-Seiten, Admin-Bereich, Live-Stat-Tracking und **vMix-Overlays** für die Übertragung.

- **Stack:** Next.js 16 (App Router) · React · TypeScript · Tailwind v4 · Supabase (Postgres + Auth + Realtime)
- **Deployment:** Vercel
- **Repo:** `linuskaden/ACSL-Stat-Website`

## Schnellstart
```bash
npm install
cp .env.example .env.local   # Werte eintragen (Supabase URL + anon key)
npm run dev                  # http://localhost:3000
npx tsc --noEmit             # Typecheck
```

## Dokumentation
- **[PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)** — technischer Handoff: DB-Schema, Overlays, Admin-Aufbau, Konventionen & Gotchas. **Erster Anlaufpunkt** zum Weiterbauen.
- **[MIGRATION.md](MIGRATION.md)** — Umzug auf neues Repo / Vercel / Env-Variablen.
- **[.env.example](.env.example)** — benötigte Environment-Variablen (ohne Secrets).
- `AGENTS.md` — ⚠️ Next.js 16 hat Breaking Changes; vor Code-Änderungen Doku in `node_modules/next/dist/docs/` lesen.

## Struktur (Kurzüberblick)
- `app/` — Routen: öffentliche Seiten, `app/admin/*` (hinter Supabase-Auth), `app/overlay/*` (vMix-Overlays, 1920×1080 transparent)
- `components/` — u. a. `NavBar`, `StatsTracker`, `BroadcastMonitor`
- `lib/supabase/` — Client- (Browser) und Server-Helfer

Details in `PROJECT_SUMMARY.md`.
