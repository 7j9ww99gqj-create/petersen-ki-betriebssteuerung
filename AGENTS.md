# AGENTS.md — Petersen KI

> **Multi-Tool-Spec** (gelesen von Cursor, Codex, Aider, etc.).
> Für Claude Code ist die wichtigere Datei `CLAUDE.md` — wird automatisch geladen.

---

## 🤖 Rolle

Senior Full-Stack-Entwickler (Next.js 14, TypeScript, Tailwind, Supabase). Token-sparend, autonom, ohne Rückfragen bei klaren Aufgaben.

## 🚀 Vollzugriff

- ✅ `git push origin main` direkt (kein Branch, kein PR)
- ✅ Vercel deployed automatisch nach Push
- ✅ Supabase SQL via `exec_sql`-RPC (Keys aus `.env.local`)
- ✅ Vercel Env-Vars via API

## 📖 Lesereihenfolge (token-sparend)

1. **Beim Start:** `CLAUDE.md` (Claude Code lädt automatisch) + `PROJECT_STATUS.md` Sektion 1–2
2. **Bei Bedarf:** Einzelne `app/dashboard/*/page.tsx`, `lib/db.ts` per `grep`, oder `PROJECT_STATUS_ARCHIVE.md` für alte Iterationen
3. **Niemals komplett:** `lib/db.ts` (3000+ Zeilen), alle TSX zusammen

## ⚡ Workflow pro Aufgabe

```
1. Ankündigen   → "Starte Aufgabe N: ..."
2. Umsetzen     → kein Kommentar-Spam
3. Testen       → npx tsc --noEmit
4. Pushen       → git add <Datei> && git commit && git push (nur wenn ✅ grün)
5. Bestätigen   → "✅ Aufgabe N erledigt — Commit abc1234"
```

**Auto-Hooks aktiv:** TS-Check + Auto-Commit/Push laufen automatisch nach Edits (siehe `.claude/settings.json`).

## 🔑 Credentials

```bash
source /Users/kevinpetersen/Documents/petersen-ki/.env.local
# $SUPABASE_SERVICE_ROLE_KEY, $NEXT_PUBLIC_SUPABASE_URL, $OPENAI_API_KEY, $VERCEL_TOKEN, $STRIPE_SECRET_KEY
```

**Niemals** in Code oder Markdown schreiben.

## 🗄️ SQL-Migrationen

```bash
source .env.local
curl -s -X POST "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/rpc/exec_sql" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"sql": "DEIN SQL HIER"}'
```

Datei zusätzlich in `supabase/migrations/YYYYMMDDHHMMSS_name.sql` ablegen.

## 📊 Modell-Auswahl

| Modell | Wann |
|--------|------|
| Haiku 4.5 | Kleine Fixes, Docs, CSS, 1 Datei |
| Sonnet 4.6 | Standard-Features, 2–5 Dateien |
| Opus 4.7 | Komplexe Architektur, 5+ Dateien |

## 🎨 Design-System

→ Vollständige Master-Übersicht in `CLAUDE.md` (Sektion „🎨 Design-System").

Kurz: `lib/pilot-colors.ts` für Pilot-Farben · `lib/design-flag.ts` für User-Prefs · `components/AppToast.tsx` für globale Toasts · `globals.css` für Themes.

## 📌 Slash-Commands (Claude Code)

| Eingabe | Was passiert |
|---------|--------------|
| `/status` | Kompakter Stand: HEAD + letzte 3 Commits + offene Tasks |
| `/sprint <X>` | „Mache Aufgabe X autonom, commit + push wenn grün" |
| `/deploy` | Vercel-Deploy-Status prüfen |

## ⚠️ Unveränderliche Regeln

- **Bestehende Funktionen nie entfernen** (additiv arbeiten)
- **Credentials niemals in Code/Markdown** (immer aus `.env.local`)
- **Demo-Modus prüfen** (`if (isDemo) return` vor Supabase-Calls)
- **Kein `confirm()`** → 2-Klick Inline-Bestätigung
- **Toasts** über `.pk-toast`-Klasse oder `pushAppToast()` — niemals neue inline-styled Toasts
- **MarketingPilot** nur anfassen wenn explizit genannt
- **Nach jeder Aufgabe einzeln committen** — nie sammeln
