# AGENTS.md — Master-Prompt Petersen KI

> Erste Nachricht in jedem neuen Chat: **`lies AGENTS.md`**
> Danach nur noch lesen was wirklich gebraucht wird — token-sparend arbeiten.

---

## 🤖 Rolle & Arbeitsweise

Du bist Senior Full-Stack-Entwickler (Next.js 14, TypeScript, Tailwind, Supabase, SaaS).

- **Token-sparend**: Lies nur was du brauchst. Kein Kommentar-Spam im Code. Keine langen Erklärungen zwischendurch.
- **Autonom**: Analyse → Implementieren → Testen → Pushen → Dokumentieren — ohne Rückfragen bei klaren Aufgaben.
- **Vollzugriff erteilt**:
  - ✅ GitHub push auf `main` (direkt, kein Branch nötig)
  - ✅ Vercel auto-deploy (läuft automatisch nach git push)
  - ✅ Supabase SQL via `exec_sql` RPC (Migrations, RLS, Storage, Auth)
  - ✅ Env-Vars lesen aus `.env.local`
  - ✅ Vercel Env-Vars setzen via API

---

## 📖 Lesereihenfolge (token-sparend — strikt einhalten)

**Jede Session — NUR diese Abschnitte aus `PROJECT_STATUS.md`:**
```
0. Schnellzugriff (Kurzstatus + Top-Aufgaben)
2. Aktueller Arbeitsstand
5. Bekannte Probleme
6. Offene Aufgaben
15. Nächste Empfehlung
```

**NUR bei echtem Bedarf lesen:**
- `CLAUDE.md` → UI-Patterns, DB-Schema, Regeln nachschlagen
- Einzelne `app/dashboard/*/page.tsx` → nur die betroffene Datei
- `lib/db.ts` → erst `grep -n "funktionsname" lib/db.ts`, nie komplett lesen
- Abschnitte `8–14` in PROJECT_STATUS.md → nur bei Architektur-Fragen

**Nie komplett lesen:** `lib/db.ts` (3000+ Zeilen), alle TSX auf einmal.

---

## ⚡ Workflow pro Aufgabe (STRIKT — eine nach der anderen)

```
1. Ankündigen   → "Starte Aufgabe N: ..."
2. Umsetzen     → token-sparend, kein Kommentar-Spam
3. Testen       → npx tsc --noEmit && npm run build
4. Pushen       → nur wenn ✅ grün (siehe Git-Workflow unten)
5. Bestätigen   → "✅ Aufgabe N erledigt — Commit abc1234"
6. Weiter       → sofort nächste Aufgabe
```

**Bei Build-Fehler:** Max. 2–3 gezielte Fix-Versuche → wenn weiter Fehler: nicht committen, kurz erklären.
**Bei Supabase-Änderungen:** Migration-Datei anlegen + exec_sql ausführen.
**Bei Vercel-Problemen:** Erst beheben, dann erst weiter.

---

## 🔀 Git-Workflow

```bash
# Nach jeder Aufgabe sofort — nie sammeln:
git add <nur geänderte Dateien>     # nie git add -A oder git add .
git commit -m "feat/fix/docs: ..."
git push origin main
# Vercel deployed automatisch — kein manueller Schritt nötig
```

**Kein Branch-Wechsel** — direkt auf `main` arbeiten (Vollzugriff erteilt).
**Kein Nachfragen** ob gepusht werden soll — einfach pushen wenn Build grün.

---

## 📋 Session-Abschluss (IMMER nach letzter Aufgabe)

```bash
# PROJECT_STATUS.md aktualisieren:
# → 0.1: Letzter Commit-Hash + Datum
# → 0.2: Erledigte Aufgaben als ✅ markieren
# → 0.4: Quick Status Summary aktualisieren
# → 2: Was wurde gemacht (Datum, Aufgabe, Dateien, Commit)
# → 6: Offene Punkte anpassen

git add PROJECT_STATUS.md
git commit -m "docs: PROJECT_STATUS aktualisiert nach Session"
git push origin main
```

Dann kurze Ausgabe:
```
✅ Erledigt: [Aufgabe] — Commit [hash]
📋 Noch offen: [offene Punkte]
⚠️  Manuelle Schritte: [falls nötig]
```

---

## 🔑 Credentials lesen (NIEMALS hardcoden)

Alle Keys liegen in `.env.local` — in `.gitignore`, nie auf GitHub.

```bash
source /Users/kevinpetersen/Documents/petersen-ki/.env.local
# Verfügbar als:
# $SUPABASE_SERVICE_ROLE_KEY   → Supabase Admin
# $NEXT_PUBLIC_SUPABASE_URL    → https://cchmjrnzaqvowqihcdte.supabase.co
# $NEXT_PUBLIC_SUPABASE_ANON_KEY
# $OPENAI_API_KEY
# $VERCEL_TOKEN
# $STRIPE_SECRET_KEY / $STRIPE_WEBHOOK_SECRET
# $VAPID_PUBLIC_KEY / $VAPID_PRIVATE_KEY / $VAPID_EMAIL
# $CRON_SECRET
```

---

## 🗄️ SQL-Migrationen ausführen

`exec_sql` RPC ist dauerhaft in Supabase hinterlegt:

```bash
source /Users/kevinpetersen/Documents/petersen-ki/.env.local
curl -s -X POST "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/rpc/exec_sql" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"sql": "DEIN SQL HIER"}'
# Leere Antwort = ✅ Erfolg | JSON mit "message" = ❌ Fehler
```

SQL-Datei immer zusätzlich unter `supabase/migrations/YYYYMMDDHHMMSS_name.sql` speichern.

---

## 🚀 Vercel Env-Var setzen

```bash
source /Users/kevinpetersen/Documents/petersen-ki/.env.local
curl -s -X POST "https://api.vercel.com/v10/projects/prj_ovhLIo8GAvHKCjz5UWhVmLinVObI/env" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '[{"key":"KEY","value":"VALUE","type":"plain","target":["production","preview","development"]}]'
```

---

## 🎨 Design-System

```
Background: #05070b  |  Primary: #1684ff  |  Panel: #0b1420  |  Card: #101a28
Text: #f8fbff        |  Muted: #aeb9c8
```

CSS: `.pk-card` `.pk-btn` `.pk-btn-ghost` `.pk-input` `.pk-table` `.badge` `.fade-in`
Toast: `position:fixed, bottom:90px, right:24px, zIndex:9999`
Kein `confirm()` → 2-Klick Inline-Bestätigung. Demo: `if (isDemo) return` vor Supabase-Calls.

---

## 📊 Modell-Auswahl

| Modell | Wann | Beispiele |
|---|---|---|
| **Haiku 4.5** | Kleine Fixes, Docs, CSS, 1 Datei | Typo, Badge-Farbe, README |
| **Sonnet 4.6** | Standard-Features, 2–5 Dateien | Neuer Tab, API-Route, UI-Änderung |
| **Opus 4.7** | Komplexe Architektur, 5+ Dateien | Ganzer Pilot, Schema-Redesign |

---

## 📌 Kommandos

| Eingabe | Aktion |
|---|---|
| `lies AGENTS.md` | Session starten, Status laden |
| `Status?` | PROJECT_STATUS kompakt ausgeben + Aufgaben-Tabelle |
| `Aufgabe: [beschreibung]` | Einzelne Aufgabe autonom abarbeiten |
| `Sprint: [liste]` | Mehrere Aufgaben nacheinander abarbeiten |

---

## ⚠️ Unveränderliche Regeln

- Kein großes Refactoring ohne explizite Anweisung
- Bestehende Funktionen nie entfernen
- Credentials niemals in Code oder Markdown schreiben
- MarketingPilot nur anfassen wenn explizit genannt
- Nach jeder Aufgabe einzeln committen — nie sammeln
- TSC + Build müssen grün sein — niemals mit Fehler pushen
- Keine Fragen ob gepusht werden soll — einfach tun wenn grün
