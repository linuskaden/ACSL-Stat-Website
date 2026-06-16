# ACSL Media Website — Projekt-Handoff

Stand: 2026-06-16. Dieses Dokument fasst alles Wichtige zusammen, um an der Website weiterzubauen.

---

## 1. Überblick

Stats-/Broadcast-Plattform für die **ACSL** (Austrian College Sports League, American Football). Öffentliche Fan-Seiten + Admin-Bereich + Live-Stat-Tracking + **vMix-Overlays** für die Übertragung.

| | |
|---|---|
| **Repo** | https://github.com/linuskaden/ACSL-Media-Website (Branch `main`) |
| **Lokaler Pfad** | `C:\Users\linus\OneDrive\Desktop\ACSL CLaude Tool\acsl-stats` |
| **Deployment** | Vercel — https://acsl-media-website.vercel.app |
| **Framework** | Next.js 16 (App Router) + React + TypeScript |
| **Styling** | Tailwind v4, light-first mit `dark:`-Variante, Akzentfarbe `#ff1d25`, Font **Archivo** |
| **Backend** | Supabase (Postgres + Auth + Realtime) |
| **Dev-Start** | `npm run dev` (Port 3000) · Typecheck `npx tsc --noEmit` |

### ⚠️ Next.js 16 — WICHTIG
`AGENTS.md` (und `CLAUDE.md` → referenziert es) sagt: **Das ist nicht das bekannte Next.js.** Breaking changes. Vor dem Schreiben von Code die passende Anleitung in `node_modules/next/dist/docs/` lesen. Beispiel: dynamische Routen nutzen `params: Promise<{ id }>`.

---

## 2. Supabase

- **Project ID / ref:** `ujbypufnefqsxzpnczsp` (Name „Football stats tracking Project", Region eu-west-1, Postgres 17)
- Client-Helfer: `@/lib/supabase/client` (Browser, anon) und `@/lib/supabase/server` (Server, liest Auth-Cookies)
- **RLS** auf allen Tabellen: i. d. R. `public read` (SELECT true) + `auth write` (`auth.role() = 'authenticated'`)
- **Realtime**: Tabellen in Publication `supabase_realtime`: `games`, `game_stats`, `overlay_state`, `team_overlay_state`, `key_player_overlay_state`. Abos via `postgres_changes`.

### Tabellen (public)
| Tabelle | Zweck | wichtige Spalten |
|---|---|---|
| `teams` (6) | Teams | id, name, short_name, slug, primary_color, secondary_color, logo_url |
| `players` (236) | Spieler | id, team_id, jersey_number, **positions (text[])**, first_name, last_name, nickname, is_active, + Bio-Felder |
| `games` (30) | Spiele | id, season, week, game_type, home_team_id, away_team_id, home_score, away_score, scheduled_at, status (`scheduled`/`live`/`final`), location |
| `game_stats` (246) | Live-Stats **pro Spieler pro Quarter** | siehe unten — **mehrere Zeilen pro Spieler, muss summiert werden** |
| `career_stats` (95) | Saison-/Karrierewerte | gleiche Stat-Felder, season, games_played |
| `standings` (12) | Tabelle | team_id, season, wins, losses, points_for, points_against, playoff_seed (auto via Trigger) |
| `playoff_bracket` (6) | Playoff-Baum | season, round, match_order, home/away_team_id, home/away_seed, winner_id, game_id |
| `overlay_state` (1) | Lower-Third-Overlay-Steuerung | siehe Overlays |
| `team_overlay_state` (1) | Team-Stats-Overlay-Steuerung | siehe Overlays |
| `key_player_overlay_state` (1) | Key-Player-Ticker-Steuerung | siehe Overlays |

### `game_stats` Spalten (alle numerisch außer ids/quarter)
```
id, game_id, player_id, team_id, quarter,
pass_yards, pass_attempts, pass_completions, pass_tds, interceptions_thrown,
qb_rush_yards, qb_rush_tds, qb_fumbles,
rush_carries, rush_yards, rush_tds,
rb_rec_yards, rb_receptions, rb_targets, rb_fumbles,
rec_yards, receptions, rec_targets, rec_tds, rec_fumbles,
sacks, def_interceptions, def_tackles, def_fumble_recovered, def_tds,
fg_made, fg_attempts, ep_made, ep_attempts
```
**Aggregation:** Stats liegen pro Quarter in separaten Zeilen → für Summen alle Zeilen eines `player_id` (für ein `game_id`) holen und numerische Felder aufsummieren.

### Teams (id → Name, Farbe)
| short | name | id | primary |
|---|---|---|---|
| Beez | BOKU Beez | `ac45a617-0def-4a75-be4f-d6659696e49b` | #FFC200 |
| Astros | JKU Astros | `d00fe289-4147-4920-972b-e40542171a87` | #18162F |
| Serpents | MedUni Serpents | `72582b9a-d676-4f57-b392-c777893cbd42` | #04a550 |
| Robots | TU Robots | `cbe6eff0-c1d1-4e51-a041-e81ad02d48ef` | #000000 |
| Emperors | Uni Wien Emperors | `4cd48e0f-4d57-4f99-a3b0-1a30f439e32b` | #4CB9FC |
| Tigers | WU Tigers | `739ad93a-ce76-4db2-8b9f-e46b5063397a` | #3e00ff |

---

## 3. Positions-Logik (KRITISCH)

**`positions` ist ein Array. `positions[0]` = Primärposition** und steuert, welche Stats angezeigt werden.

- **Niemals `positions.includes('RB')` o.Ä. für die Stat-Auswahl benutzen** — das war der ursprüngliche Bug (ein `["WR","RB"]`-Spieler bekam RB-Stats). Immer `const primaryPos = positions[0]`.
- **Reihenfolge-Regel im Array:** **Kicker zuerst** (falls vorhanden) → dann Offense → dann Defense. Z. B. Reichart = `["K","WR","RB"]`.
- **Dual-Role-Kicker:** Wenn `positions` ein K oder P enthält (`hasKP = positions.some(p => ['K','P'].includes(p))`), werden **zusätzlich** Kicker-Stats (FG/EP/PTS) angehängt — unabhängig von der Primärposition.
- **Score aus Stats berechnen** (nicht aus `games.home_score`, das nur aktualisiert wird wenn der StatsTracker offen ist):
  `score = tds*6 + fg_made*3 + ep_made`

### Stat-Anzeige pro Position
- **Lower-Third** (`buildStats`): QB → PASS YDS, TDs, INT, COMP/ATT, RUSH YDS · RB → RUSH YDS, TDs, CAR, YPC, REC YDS · WR/TE → REC YDS, TDs, REC, TARGETS, YPR · Def → SACKS, INT · +K/P angehängt → FG, EP, PTS
- **Key-Player-Ticker** (`buildTickerStats`): nur **QB/WR/TE/RB**. QB → COMP/ATT + TOTAL YDS (pass+rush) · WR/TE → REC/TAR + REC YDS · RB → CAR + RUSH YDS + YPC
- **Team-Stats**: PASS YDS, RUSH YDS, TOTAL YDS, COMP/ATT, TOTAL TDs, FIELD GOALS, INT, FUMBLES

> Hinweis: TDs werden nur QB-seitig (`pass_tds`) gezählt, `rec_tds` wird in Team-Summen übersprungen, um Doppelzählung zu vermeiden.

---

## 4. vMix-Overlays (3 separate Browser-Inputs)

Alle unter `app/overlay/*`, gerendert im Overlay-Layout (`app/overlay/layout.tsx` → erzwingt **1920×1080, transparenter** Hintergrund für vMix/OBS). Jedes Overlay liest seine Singleton-State-Zeile (`id=1`) und abonniert Realtime.

| Route | Datei | State-Tabelle | Position/Look |
|---|---|---|---|
| `/overlay/lower-third` | `app/overlay/lower-third/page.tsx` | `overlay_state` | Spielerkarte unten links |
| `/overlay/team-stats` | `app/overlay/team-stats/page.tsx` | `team_overlay_state` | Vollbild Team-Vergleich |
| `/overlay/key-players` | `app/overlay/key-players/page.tsx` | `key_player_overlay_state` | rotierender Key-Player-Ticker, **cleaner weißer Text**, unten rechts |

### State-Schemas
- `overlay_state`: `active_player_id (uuid)`, `game_id (uuid)`, `mode ('live'|'career'|'intro')`, `visible (bool)`
- `team_overlay_state`: `game_id`, `display_team ('both'|'home'|'away')`, `visible`
- `key_player_overlay_state`: `game_id`, `player_ids (uuid[])`, `rotation_seconds (int, default 6)`, `visible`

### Verhalten
- **Lower-Third ↔ Team-Stats: gegenseitig exklusiv** (wird beim Sichtbarmachen des einen das andere ausgeblendet — in Admin-Push-Funktionen + in den Overlays per Realtime).
- **Key-Player-Ticker: unabhängig/permanent** (keine Exklusivität, läuft parallel).
- Key-Player: **max. 4 pro Team** (bis 8), nur QB/WR/TE/RB wählbar, rotiert mit Crossfade alle `rotation_seconds`.

---

## 5. Admin-Bereich

Hinter Supabase-Auth. Jede Seite macht serverseitig `supabase.auth.getUser()` → bei fehlender Session `redirect('/admin/login')`. **Admin-UI ist nur eingeloggt sichtbar** (Login `/admin/login`, E-Mail/Passwort).

Admin-Nav (in `components/NavBar.tsx`, nur wenn `pathname.startsWith('/admin')`): **Dashboard · Players · Games · Overlay · Broadcast**.

| Route | Zweck |
|---|---|
| `/admin` | Dashboard |
| `/admin/players`, `/admin/players/[id]` | Spielerverwaltung (Server Actions `savePlayer`/`deletePlayer`) |
| `/admin/games`, `/admin/games/[id]/track` | Spiele + Live-Stat-Tracking (`components/StatsTracker.tsx`) |
| `/admin/overlay` | **vMix Overlay Control** (Hauptsteuerung, siehe unten) |
| `/admin/broadcast` | **Programm-Monitor + Web-Input** (siehe unten) |

### `/admin/overlay` — vMix Overlay Control
Eine große Client-Seite (`app/admin/overlay/page.tsx`). **Reihenfolge (Stand zuletzt):**
1. **Top-Leiste:** nur Match-Selector (Dropdown der Spiele der Saison 2026)
2. **Overlay-Vorschau** (`OperatorPreview`): echtes **16:9-Stage** (1920×1080 herunterskaliert), das alle drei Overlays an ihren echten Koordinaten zeigt (Team-Stats fullscreen, Lower-Third unten links, Key-Player-Ticker unten rechts), über video-artigem Hintergrund.
3. **Team Stats** (`TeamStatsControl`): SHOW/HIDE + Copy-Link
4. **Key Player Ticker** (`KeyPlayerControl`): SHOW/HIDE, Wechsel-Tempo (4/6/8/10s), Copy-Link, Auswahl als **Popup** (Button „＋ Spieler auswählen" öffnet beide Teams; gewählte als Chips, Klick = entfernen)
5. **Spieler-Einblendung (Lower Third):** LIVE/CAREER-Umschalter, SHOW, Status, Copy-Link, darunter die **Spielerkarten** (HOME/AWAY, `TeamColumn`); Klick auf Karte öffnet `PlayerModal` mit Detail-Einblende-Optionen.

**Achtung — Logik-Duplikate:** Die Admin-Vorschau hat **eigene Kopien** der Stat-Builder (`buildStatItems`, `buildKeyTickerStats`, `calcTeamTotals`), getrennt von den echten Overlay-Dateien. **Bei Stat-Änderungen müssen beide Stellen angepasst werden** (Overlay-Datei + Admin-Vorschau).

State-Sync: `pushOverlay` / `pushTeamOverlay` / `pushKeyPlayerOverlay` schreiben in die jeweilige State-Tabelle (id=1); Realtime hält mehrere Admins in Sync.

### `/admin/broadcast` — Programm-Monitor (`components/BroadcastMonitor.tsx`)
vMix-artiger „Program"-Monitor:
- **16:9-Stage**, in das die **echten Overlay-Komponenten** importiert und live gerendert werden (`@/app/overlay/lower-third/page` etc.), skaliert via `ResizeObserver` in einen 1920×1080-Container (`pointer-events:none`, damit der Web-Input klickbar bleibt).
- **Web-Input** als Hintergrund (iframe): URL eingeben → „Laden". `toEmbeddable()` wandelt YouTube-/Twitch-Links automatisch in Embed-Player. Buttons: Hintergrund an/aus, Leeren.
- **Größe & Position-Editor** (Popup, schwebend rechts, Monitor bleibt sichtbar): Layout `{x,y,w,h}` in % des Stages, Slider + Zahlenfelder, Presets (Vollbild, Unten Mitte, Oben Mitte, Unten Links/Rechts).
- **Limit:** Manche Seiten verbieten Einbetten (X-Frame-Options/CSP) → bleiben leer. Browser-Sicherheit, nicht umgehbar.

---

## 6. Öffentliche Seiten
`app/page.tsx` (Home: Hero, Teams, Standings, LIVE-Banner), `app/teams`, `app/teams/[slug]`, `app/players` (+ `PlayerPageClient`), `app/schedule`, `app/playoffs`, `app/live`, `app/leaders`. Globaler **Saison-Switcher** in der NavBar (`SeasonSwitcher`, gespeicherte Auswahl via `@/lib/season` → `getSelectedSeason()`). Seiten lesen die gewählte Saison.

---

## 7. Arbeits-Konventionen & Gotchas

- **Verifikation hinter Login:** Admin-Seiten kann man nicht eingeloggt screenshotten (kein Passwort-Eintippen). Bewährt: temporäre **öffentliche Debug-Route** unter `app/debug-*/page.tsx` anlegen, die die Komponente mit Mock-/Live-Daten rendert, im Browser prüfen, **danach wieder löschen**. (Komponenten-Logik braucht keinen Auth, nur der Seiten-Wrapper.)
- **`preview_screenshot` hängt** bei Seiten mit Gradient-Hintergründen → stattdessen Geometrie via `preview_eval` + `getBoundingClientRect()` prüfen (Stage-Ratio, Element-Positionen).
- **Overlays testen:** State-Tabelle (`*_overlay_state`, id=1) per SQL auf `visible=true` + Test-Spieler/Spiel setzen, danach wieder auf `visible=false`, `player_ids='{}'` zurücksetzen.
- **Git:** Commits enden mit `Co-Authored-By: Claude …`. **`.claude/`-Verzeichnis nicht committen** (lokale `launch.json`). Direkt auf `main` (User-Workflow). LF→CRLF-Warnungen unter Windows sind normal.
- **`npx tsc --noEmit`** vor jedem Commit; Dev-Server-Logs auf Fehler prüfen.
- **`Arial Black`/Impact** ist die durchgängige Broadcast-Schrift in den Overlays.

---

## 8. Zuletzt gebaut (Commit-Verlauf, neueste zuerst)

```
e6d02ef vMix-style size & position editor for broadcast web input
d56cd57 ACSL Broadcast admin tab (program monitor + web input)
9a06b02 reorganize vMix overlay admin layout
0389d41 consolidated vMix inputs bar (später wieder entfernt)
bb74243 rebuild operator preview as true 16:9 vMix stage with key player ticker
384a372 vMix-accurate preview to key player ticker admin panel
4c81cc7 permanent key player ticker overlay (3. vMix overlay)
dd49bbf calculate score from stats directly in team stats overlay
08bd710 remove accent lines from team stats overlay
6eacce0 replace REC/TAR with COMP/ATT on team stats scoreboard
10d174b use primary position (positions[0]) for all stat display logic
```

### Roster-Stand (manuell gepflegt, relevant für Tests)
- Philipp Hundertpfund — WR #9, Astros (neu)
- Jakob Reichart — #88 Astros, `["K","WR","RB"]` (Hauptkicker)
- Alexander Gothe — #9 Tigers, `["RB","DB"]`
- Globale K-zuerst-Reihenfolge auf alle Multi-Positions-Spieler angewandt.

---

## 9. Mögliche nächste Schritte / offen
- Broadcast-Web-Input optional per **Maus ziehen/resizen** statt nur %-Felder (vMix-Drag-Style).
- Beim QB-Ticker bedeutet „TOTAL YDS" aktuell **pass + rush** — falls nur Passing gewünscht, eine Zeile in `buildTickerStats` (Overlay **und** Admin-Vorschau) ändern.
- Overlays/Vorschau teilen Stat-Logik nicht (Duplikate) — bei Bedarf in geteilte Helfer auslagern.
