# AI Agent Workflow

## Start
- Lies immer zuerst `PROJECT_STATUS.md`.
- Nutze `PROJECT_STATUS.md` als aktuelle Projektübersicht.
- Lies standardmäßig zuerst nur die kompakten Abschnitte:
  - `0. Schnellzugriff`
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

## Ziel
- minimale Tokens
- stabile Builds
- keine kaputten Deployments
- nachvollziehbare Git-Historie
- sichere Live-Deployments
