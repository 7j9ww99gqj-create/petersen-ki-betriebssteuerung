# CONTRIBUTING.md — Petersen KI Betriebssteuerung

> Workflow für Code-Änderungen, Branches, Pull-Requests und Deployments.

---

## Grund-Strategie

- **`main`** ist die einzige langlebige Branch — sie spiegelt **Production** (https://app.petersen-ki-pilot.de) wider.
- **Jede Änderung** durchläuft entweder:
  - **Direct push** auf `main` (für autonome Agents mit explizitem User-Auftrag), **ODER**
  - **Feature-Branch + Pull-Request** (für Multi-Personen-Arbeit, größere Refactorings, externe Reviewer).

---

## Feature-Branch-Workflow (empfohlen für ≥2 Personen)

### 1. Branch erstellen

```bash
git checkout main
git pull origin main
git checkout -b feat/<kurzbeschreibung>
# Beispiele: feat/dsgvo-export · fix/lager-mhd-bug · docs/architecture-adr
```

### 2. Arbeiten + Commits

```bash
# Pro Commit: ein logischer Schritt, prägnante Message
git add <file1> <file2>      # ⚠️ NIE `git add -A` oder `git add .`
git commit -m "feat: kurze Beschreibung"

# Vor Push lokal validieren:
npx tsc --noEmit
npm test
npm run build
```

### 3. Pull-Request öffnen

```bash
git push -u origin feat/<kurzbeschreibung>
# GitHub-UI öffnen, PR gegen main aufmachen
```

Beim PR-Open erstellt Vercel **automatisch eine Preview-URL** (Format: `https://petersen-ki-betriebssteuerung-<branch>.vercel.app`).
Diese URL hängt am PR und nutzt die gleichen Env-Vars wie Production (außer Stripe → eigene Test-Keys empfohlen).

### 4. CI-Checks

Bei jedem Push auf den Feature-Branch und bei jedem PR läuft `.github/workflows/ci.yml`:
- `npx tsc --noEmit` (Type-Check)
- `npm test` (Vitest)
- `npm run build` (Production-Build)

**Merge nur bei grünem CI.**

### 5. Merge

- **Squash-Merge** bevorzugt (saubere `main`-Historie).
- Branch nach Merge **löschen** (GitHub macht das automatisch wenn aktiviert).

---

## Direct-Push-Workflow (für autonome Agents)

Wenn ein Agent autonom auftragsgemäß arbeitet (siehe `AGENTS.md`):

```bash
git add <files>
git commit -m "feat/fix/docs: ..."
git push origin main         # Vercel deployed automatisch
```

**Bedingungen für Direct-Push auf main:**
- ✅ tsc + tests + build lokal grün
- ✅ Klar abgegrenzter Auftrag vom User
- ✅ Keine parallelen Agenten an überlappenden Dateien

Bei **Multi-Agent-Setups** unbedingt zuerst:
```bash
git fetch origin && git rebase origin/main
```

---

## Branch-Naming-Konvention

| Prefix | Verwendung | Beispiel |
|---|---|---|
| `feat/` | Neue Features | `feat/sentry-error-tracking` |
| `fix/` | Bug-Fixes | `fix/lager-mhd-status` |
| `docs/` | Reine Doku-Änderungen | `docs/architecture-adr` |
| `refactor/` | Code-Umbau ohne Verhaltensänderung | `refactor/db-domain-split` |
| `test/` | Test-Erweiterungen | `test/zod-validation-suite` |
| `chore/` | Build/CI/Tooling | `chore/upgrade-next-15` |

---

## Commit-Message-Stil

Format: `<type>: <kurze Beschreibung im Imperativ>`

Gut:
- `feat: Sentry Error-Tracking einrichten`
- `fix: BüroPilot Rechnungs-PDF Encoding`
- `refactor: lib/db.ts Domain-Split (lager, buero, einkauf)`

Schlecht:
- `update stuff` (zu vage)
- `fixed bug` (kein Imperativ)
- `Hier kommt der neue Sentry-Sentry-Stack mit allem Drum und Dran und es ist wirklich toll` (zu lang)

Bei größeren Commits: Body mit zusätzlichen Details nach Leerzeile.

---

## Vercel Preview-URLs

- Jeder Push auf einen **Feature-Branch mit PR** → neue Preview-URL.
- URL findest du im PR-Kommentar (Vercel-Bot) oder unter https://vercel.com/<team>/petersen-ki-betriebssteuerung/deployments.
- **Preview-URLs nutzen die gleichen Env-Vars wie Production** (außer wenn ein Env auf „Preview"-Target separat gesetzt ist).

### Preview-URLs für Stakeholder teilen

Nach einem Push auf Feature-Branch:
1. PR öffnen
2. Warten bis Vercel-Bot kommentiert (~2 min)
3. Preview-URL aus PR-Kommentar kopieren → an Stakeholder schicken
4. Feedback einarbeiten → erneut pushen → Preview aktualisiert sich automatisch

---

## Was NIE direkt auf `main` darf

- ❌ Schema-Migrations ohne vorherigen Test auf Staging-Supabase
- ❌ Stripe-Webhook-Logik ohne lokalen End-to-End-Test
- ❌ Force-Push (`git push --force`)
- ❌ Commits die `.env*`-Files enthalten

---

## Migrationen (Supabase)

```bash
# 1. SQL-Datei anlegen
supabase/migrations/YYYYMMDDHHMMSS_kurzname.sql

# 2. Lokal mit exec_sql RPC ausführen (siehe AGENTS.md)
# 3. Im selben Commit wie die Code-Änderung pushen
```

**Wichtig:** Migrations sind **forward-only** — kein DROP, kein destruktives ALTER ohne Backup-Plan.

---

## Code-Review Checkliste (vor Merge)

- [ ] CI grün (tsc + test + build)
- [ ] Keine `console.log` in Production-Code
- [ ] Keine hardcoded Credentials
- [ ] Demo-Modus geprüft (`hasDemoCookie()`-Pfad funktioniert)
- [ ] Bestehende Tests passen weiterhin
- [ ] Bei UI-Änderungen: visueller Check in Preview-URL
- [ ] Migration vorhanden (falls Schema-Änderung)
- [ ] `PROJECT_STATUS.md` ggf. aktualisiert
