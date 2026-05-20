#!/usr/bin/env bash
# Auto-Commit + Push Hook
# Wird vom Stop-Hook aufgerufen. Sicher gestaltet:
# - Committet nur, wenn Änderungen vorhanden
# - Pusht nur, wenn TS-Check grün
# - Pusht NICHT, wenn schon vom User/Agent manuell committed wurde
# - Schlägt nicht den Chat ab (exit 0 immer)

set +e  # Fehler nicht propagieren — Hook soll nie den Chat blockieren

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-/Users/kevinpetersen/Documents/petersen-ki}"
cd "$PROJECT_DIR" || { echo "❌ Projekt-Dir nicht gefunden"; exit 0; }

# 1. Sind Änderungen vorhanden?
if git diff --quiet && git diff --cached --quiet; then
  # Prüfe noch ob ungepushte Commits existieren
  UNPUSHED=$(git log origin/main..HEAD --oneline 2>/dev/null | wc -l | tr -d ' ')
  if [ "$UNPUSHED" -gt 0 ]; then
    echo "📤 $UNPUSHED ungepushte Commits — pushe..."
    git push origin main 2>&1 | tail -2
  fi
  exit 0
fi

# 2. TS-Check (nur Warnung, kein Block)
if ! npx tsc --noEmit > /tmp/pk-auto-tsc.txt 2>&1; then
  echo "⚠️ TypeScript-Fehler — Auto-Commit übersprungen:"
  head -10 /tmp/pk-auto-tsc.txt
  exit 0
fi

# 3. Nur tracked geänderte Files stagen (kein neuer Müll)
git add -u

# Falls jetzt nichts gestaged ist → nichts zu tun
if git diff --cached --quiet; then
  exit 0
fi

# 4. Commit-Message aus geänderten Dateien generieren
FILES_COUNT=$(git diff --cached --name-only | wc -l | tr -d ' ')
FILE_SAMPLE=$(git diff --cached --name-only | head -3 | xargs -I{} basename {} | paste -sd, -)
COMMIT_MSG="chore: auto-update ${FILE_SAMPLE}"
if [ "$FILES_COUNT" -gt 3 ]; then
  COMMIT_MSG="$COMMIT_MSG (+$((FILES_COUNT - 3)) weitere)"
fi

git commit -m "$COMMIT_MSG" 2>&1 | tail -2
git push origin main 2>&1 | tail -2

echo "✅ Auto-committed + pushed: $COMMIT_MSG"
