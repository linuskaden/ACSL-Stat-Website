# Umzug auf ein neues GitHub-Repo (+ neuer Claude-Account)

Ausgangslage: Code liegt in Git, aktuelles Remote `linuskaden/ACSL-Media-Website`.
Supabase **und** Vercel bleiben auf demselben Account — es ändert sich nur das GitHub-Repo
(und der Claude-Account, von dem aus du arbeitest).

Der eigentliche Umzug ist klein. Das **einzige**, was nicht in Git liegt und mitgenommen
werden muss, sind die **Env-Variablen** (`.env.local`). Alles andere ist Repo-Geschichte.

---

## 0. Env-Werte sichern (WICHTIG, zuerst)
Die Secrets liegen lokal in `acsl-stats/.env.local` (gitignored). **Diese Datei behalten / Werte kopieren.**
Benötigt werden (siehe `.env.example`):
- `NEXT_PUBLIC_SUPABASE_URL` — `https://ujbypufnefqsxzpnczsp.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — aus Supabase Dashboard → Project Settings → API
- *(optional)* `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`

> Supabase selbst wird **nicht** migriert — gleiches Projekt, gleiche Daten/Policies. Das Repo
> spricht es nur über diese Variablen an.

---

## 1. Neues GitHub-Repo anlegen
Auf deinem eigenen GitHub-Account ein **leeres** Repo erstellen (ohne README/.gitignore/License,
damit der erste Push nicht kollidiert), z. B. `ACSL-Media-Website`. URL kopieren.

---

## 2. Lokales Remote umbiegen und pushen (volle Historie bleibt erhalten)
Im Projektordner (`…\acsl-stats`):

```bash
# Variante A — origin ersetzen
git remote set-url origin https://github.com/<DEIN-USER>/<NEUES-REPO>.git
git push -u origin main

# Variante B — altes Repo als Backup behalten
git remote rename origin old-origin
git remote add origin https://github.com/<DEIN-USER>/<NEUES-REPO>.git
git push -u origin main
```

Authentifizierung gegen dein GitHub: Browser-Login oder Personal Access Token. Mit der `gh`-CLI:
`gh auth login` (einmalig), danach funktioniert `git push`.

> Das pusht die **komplette Commit-Historie**. Falls du lieber „frisch" ohne Historie starten
> willst, sag Bescheid — dann machen wir einen sauberen Single-Commit-Start.

---

## 3. Vercel neu verbinden (gleicher Account)
Zwei Wege:

**A) Bestehendes Vercel-Projekt umhängen (empfohlen — Domain/Projekt bleibt):**
Vercel → dein Projekt → Settings → **Git** → vom alten Repo trennen → neues Repo verbinden.
Die in Vercel hinterlegten Env-Variablen bleiben bestehen.

**B) Neues Vercel-Projekt:** New Project → neues Repo importieren → Env-Variablen eintragen
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, ggf. Upstash) → Deploy → Domain umstellen.

In **beiden** Fällen müssen die Supabase-Env-Variablen im Vercel-Projekt gesetzt sein.

---

## 4. Neuer Claude-Account
- Dein **GitHub-Konto als Konnektor** verbinden, dann auf das neue Repo zeigen.
- Bei Bedarf **Supabase**- und **Vercel**-Konnektoren ebenfalls verbinden (gleiche Accounts wie bisher).
- `.env.local` für lokale Entwicklung mitbringen (liegt nicht im Git).
- Zum schnellen Reinkommen: `PROJECT_SUMMARY.md` lesen (technischer Handoff).

---

## 5. Nach dem Umzug verifizieren
```bash
npm install
npm run dev          # Seite öffnen
npx tsc --noEmit     # keine Typfehler
```
- Admin-Login testen (`/admin/login`) → Supabase-Auth ok?
- Eine Overlay-Route lädt (`/overlay/lower-third`)?
- Vercel-Deployment grün?

---

## Checkliste
- [ ] `.env.local`-Werte gesichert
- [ ] neues GitHub-Repo (leer) erstellt
- [ ] `git remote set-url` + `git push -u origin main`
- [ ] Vercel-Git-Verbindung aufs neue Repo + Env-Variablen vorhanden
- [ ] neuer Claude-Account: GitHub-Konnektor verbunden
- [ ] `npm install` + `npm run dev` läuft lokal
- [ ] (optional) Upstash-Variablen gesetzt, sonst In-Memory-Fallback

---

### Was NICHT migriert werden muss
- **Supabase** (Projekt, Daten, RLS, Realtime, Auth-User) — bleibt unverändert.
- **node_modules / .next / .vercel** — werden neu generiert (gitignored).
- Bereits in Vercel gesetzte Env-Variablen — bleiben, wenn du das bestehende Projekt umhängst.
