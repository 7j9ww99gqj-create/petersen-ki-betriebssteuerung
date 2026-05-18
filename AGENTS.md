# AI Agent Workflow

## Start
- Lies immer zuerst `PROJECT_STATUS.md`.
- Nutze `PROJECT_STATUS.md` als aktuelle Projektübersicht.
- Lies standardmäßig zuerst nur die kompakten Abschnitte:
  - `0. Schnellzugriff` (mit Quick Status Summary)
  - `2. Aktueller Arbeitsstand`
  - `5. Bekannte Probleme`
  - `6. Offene Aufgaben`
  - `15. Nächste Empfehlung`
- Lies die langen Verlaufs-/Analyseabschnitte (`8` bis `14`) nur bei echtem Bedarf.
- Arbeite kompakt und token-sparend.
- Keine unnötigen Komplettanalysen.
- Nur relevante Dateien prüfen.
- Keine Login-Daten, Secrets, Zugangsdaten oder Tokens ins Projekt schreiben.
- Für Owner-/Billing-Architektur zusätzlich diese Datei als Kontext nutzen:
  - `/Users/kevinpetersen/owner-dashboard-project/project-status.md`

## Status-Anfrage-Routine (Standard-Prompt)
**Kommando:** `Claude, Status?`  
**Modell:** Sonnet 4.6 (token-optimal)  
**Workflow:**
1. Lies AGENTS.md vollständig
2. Lies PROJECT_STATUS.md nur `0`, `2`, `5`, `6`, `15`
3. Kompakte Analyse (max. 3 Sätze) + Liste anstehender Aufgaben
4. Gib jede Aufgabe mit Modell-Empfehlung (Haiku/Sonnet/Opus) + geschätztem Token-Budget
5. Nennt eine konkrete Nächste Aktion mit Modellwahl

**Ausgabe-Format:**
- 📍 Aktueller Status (1–2 Sätze)
- 📋 Aufgaben-Tabelle (Priorität | Aufgabe | Modell | Tokens | Grund)
- 🎯 Empfehlung für nächste Session

---

## Feature-Implementierungs-Routine (Pilot-Arbeiten)
**Kommando:** `Claude, BüroPilot – [Aufgabe]` / `Lager – [Aufgabe]` / etc.  
**Modell:** Sonnet 4.6 (Standard) oder Opus 4.7 (komplexe Features)  
**Workflow:**
1. Lies AGENTS.md vollständig
2. Lies PROJECT_STATUS.md nur `0`, `2`, `5`, `6`, `15`
3. Implementiere die Aufgabe kompakt (nur nötige Änderungen)
4. `npm run lint` + `npm run build` (grün!)
5. `git commit` (noch NICHT pushen)
6. **FINALE SCHRITTE (IMMER durchführen):**
   - `git push` → GitHub
   - Warte auf Vercel-Deploy
   - `PROJECT_STATUS.md` aktualisieren:
     * Abschnitt `2`: neue Zeile mit Datum, Aufgabe, betroffene Dateien, Tests, Commit
     * Abschnitt `0.2`: diese Aufgabe abhaken/entfernen
     * Abschnitt `0.4 Quick Status Summary`: aktualisieren
   - `git add PROJECT_STATUS.md` + `git commit` + `git push`
7. Kurz sagen: "Erledigt, deployed zu [vercel-URL], Commit [HASH]"

**Token-Sparen:**
- Keine ausschweifenden Erklärungen
- Nur relevante Code-Teile prüfen
- Keine Komplettanalysen
- Schnell implementieren, schnell deployen

## Regeln
- Keine großen Refactorings ohne ausdrückliche Anweisung.
- Bestehende Funktionen nicht entfernen.
- Änderungen klein und nachvollziehbar halten.
- `PROJECT_STATUS.md` bleibt die aktuelle Projektübersicht.
- Historische Inhalte in `PROJECT_STATUS.md` nicht löschen, sondern bei Bedarf nach unten in Verlauf/Detail einordnen.
- Bei Widersprüchen gilt immer der neueste Eintrag im Abschnitt `Aktueller Arbeitsstand`.
- Owner-/Billing-Änderungen immer auch dort knapp dokumentieren:
  - Änderungen
  - betroffene Dateien
  - offene Punkte
  - Tests
- Nach relevanten Änderungen `PROJECT_STATUS.md` aktualisieren:
  - Änderungen
  - betroffene Dateien
  - offene Punkte
  - Tests
  - aktueller Branch

## Git Workflow
- Wenn aktueller Branch `main` oder `master` ist: neuen Branch `feature/<kurzer-name>` erstellen.
- Sonst aktuellen Branch verwenden.
- Vor Commit: geänderte Dateien auflisten und kurze Commit-Message erstellen.
- `git add .` und `git commit` ausführen.
- Nicht automatisch pushen.

Frage immer:

`PUSH BEREIT. Soll ich diesen Branch zu GitHub pushen? (ja/nein)`

Nur bei `ja`:
- `git push` ausführen.

Nach Push fragen:

`Soll ich diesen Branch in main mergen und live deployen? (ja/nein)`

Nur bei `ja`:
- nach `main` mergen
- `main` pushen

## Auto Check
Vor Commit/Push:
1. `npm run lint`
2. `npm run build`

Falls ESLint fehlt oder blockiert:
- minimal konfigurieren.
- kompatible ESLint-Version nutzen.
- keine neuesten Major-Versionen installieren, wenn sie Next.js inkompatibel machen.

Wenn Lint oder Build fehlschlagen:
- maximal 2-3 gezielte Fix-Versuche.
- keine großen Refactorings.
- wenn weiterhin Fehler bleiben: nicht committen, kurz erklären.

## Modell-Auswahl-Richtlinie
| Modell | Aufgaben | Token-Budget | Beispiele |
|--------|----------|--------------|----------|
| **Haiku 4.5** | Kleine Fixes, Linting, Dokumentation, Typos, Ein-Datei-Änderungen | ~300–800 | CSS-Justierung, Fehlerfix, README-Update, einfache Komponenten-Ergänzung |
| **Sonnet 4.6** | Standard-Features, Code-Review, Mittlere Implementierungen, Multi-File (2–5 Dateien) | ~2k–8k | Neue Tab in Pilot, API-Route, moderate UI-Änderung, mehrere zusammenhängende Edits |
| **Opus 4.7** | Komplexe Architektur, große Refactorings, Strategische Entscheidungen, Multi-Module (5+ Dateien) | ~10k–30k | SteuerPilot komplett, Komplette Migrationen, Datenbankschema-Redesign, Multi-Pilot-Features |

## Credentials & Secrets

**Alle Keys liegen NUR in `.env.local`** — nie im Code, nie in CLAUDE.md, nie in AGENTS.md.
Datei ist in `.gitignore` → wird niemals zu GitHub gepusht.

So liest du sie zu Beginn jeder Session:
```bash
source /Users/kevinpetersen/Documents/petersen-ki/.env.local
# Danach verfügbar als Umgebungsvariablen:
# $SUPABASE_SERVICE_ROLE_KEY  → Supabase Admin-Zugriff
# $NEXT_PUBLIC_SUPABASE_URL   → https://cchmjrnzaqvowqihcdte.supabase.co
# $OPENAI_API_KEY             → OpenAI
# $VERCEL_TOKEN               → Vercel API
# $STRIPE_SECRET_KEY          → Stripe
# $STRIPE_WEBHOOK_SECRET      → Stripe Webhooks
# $VAPID_PRIVATE_KEY          → Push Notifications
# $CRON_SECRET                → Backup-Cron Schutz
```

## SQL-Migrationen direkt ausführen

`exec_sql` RPC-Funktion ist permanent in Supabase hinterlegt:

```bash
source /Users/kevinpetersen/Documents/petersen-ki/.env.local
curl -s -X POST "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/rpc/exec_sql" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"sql": "DEIN SQL HIER"}'
# Leere Antwort = Erfolg | JSON mit "message" = Fehler
```
SQL-Datei immer zusätzlich unter `supabase/migrations/DATUM_name.sql` speichern.

## Vercel Env-Var setzen

```bash
source /Users/kevinpetersen/Documents/petersen-ki/.env.local
curl -s -X POST "https://api.vercel.com/v10/projects/prj_ovhLIo8GAvHKCjz5UWhVmLinVObI/env" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '[{"key":"KEY","value":"VALUE","type":"plain","target":["production","preview","development"]}]'
```

## Design-System (Kurzreferenz)

```
Background:  #05070b  |  Primary: #1684ff  |  Panel: #0b1420  |  Card: #101a28
Text: #f8fbff  |  Muted: #aeb9c8
```

CSS-Klassen: `.pk-card` `.pk-btn` `.pk-btn-ghost` `.pk-input` `.pk-table` `.badge` `.fade-in`

Toast-Position immer: `position:fixed, bottom:90px, right:24px, zIndex:9999`
Kein Browser `confirm()` — immer 2-Klick Inline-Bestätigung.
Demo-Modus: `if (isDemo) return` vor jedem Supabase-Call.

## Unveränderliche Projekt-Regeln

- Kein großes Refactoring ohne explizite Anweisung
- Bestehende Funktionen nie entfernen
- Credentials niemals in Code-Dateien schreiben
- MarketingPilot nur anfassen wenn explizit angefragt
- Nach jeder Aufgabe einzeln committen — nie sammeln
- `npx tsc --noEmit` + `npm run build` müssen grün sein vor jedem Push

## Ziel
- minimale Tokens
- stabile Builds
- keine kaputten Deployments
- nachvollziehbare Git-Historie
- sichere Live-Deployments
