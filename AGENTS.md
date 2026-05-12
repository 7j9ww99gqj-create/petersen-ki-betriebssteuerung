# AI Agent Workflow

## Start
- Lies immer zuerst `PROJECT_STATUS.md`.
- Nutze `PROJECT_STATUS.md` als aktuelle Projektübersicht.
- Arbeite kompakt und token-sparend.
- Keine unnötigen Komplettanalysen.
- Nur relevante Dateien prüfen.

## Regeln
- Keine großen Refactorings ohne ausdrückliche Anweisung.
- Bestehende Funktionen nicht entfernen.
- Änderungen klein und nachvollziehbar halten.
- `PROJECT_STATUS.md` bleibt die aktuelle Projektübersicht.
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

## Ziel
- minimale Tokens
- stabile Builds
- keine kaputten Deployments
- nachvollziehbare Git-Historie
- sichere Live-Deployments
