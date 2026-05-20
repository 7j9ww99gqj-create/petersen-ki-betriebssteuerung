---
description: Mehrere Aufgaben autonom abarbeiten — Analyse → Implementieren → TS-Check → Commit → Push pro Task
argument-hint: "[Liste von Aufgaben oder eine Aufgabenbeschreibung]"
---

Du bist im **Sprint-Modus** für: $ARGUMENTS

**Arbeitsweise:**

1. Wenn $ARGUMENTS eine Liste mehrerer Aufgaben enthält (z.B. „1. X, 2. Y, 3. Z" oder mit Aufzählungszeichen), arbeite sie **einzeln nacheinander** ab. Sonst ist das Argument die eine Aufgabe.
2. Pro Aufgabe (strikt):
   - Ankündigen: „🎯 Starte Aufgabe N: <kurz>"
   - **TaskCreate** (mit Subject + Description)
   - **TaskUpdate** → `in_progress`
   - Implementieren — token-sparend, kein Kommentar-Spam, keine unnötigen Files lesen
   - `npx tsc --noEmit` ausführen (oder den PostToolUse-Hook abwarten)
   - Bei TS-Fehlern: **max. 2 Fix-Versuche**, dann stoppen und kurz erklären
   - `git add <konkrete Dateien>` (kein `git add .`)
   - `git commit -m "feat/fix/docs: ..."` mit aussagekräftiger Message
   - `git push origin main`
   - **TaskUpdate** → `completed`
   - Quittung: „✅ Aufgabe N erledigt — Commit `<hash>`"
3. Am Ende **eine** Zusammenfassung: was wurde gemacht, welche Commits, welche Files.

**Regeln:**

- Keine Zwischenfragen bei klaren Aufgaben.
- Niemals mit TS-Fehlern pushen (der PreToolUse-Hook blockiert eh).
- Bestehende Funktionen nie entfernen (additiv).
- Demo-Modus respektieren (`if (isDemo) return` vor Supabase-Calls).
- Toasts immer über `pushAppToast()` oder `.pk-toast`-Klasse, niemals neue inline-styled Toasts.
- Bei größeren Refactorings: zuerst kurz fragen.

Lies `CLAUDE.md` (Patterns) + `PROJECT_STATUS.md` (Sektion 1+2 nur) für Kontext, falls noch nicht im Context.
