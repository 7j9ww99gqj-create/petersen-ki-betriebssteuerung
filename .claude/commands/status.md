---
description: Kompakter Status — HEAD, letzte 3 Commits, ungepushte Änderungen, offene Tasks
allowed-tools: Bash(git log:*), Bash(git status:*), Bash(git diff:*), Bash(grep:*), Read
---

Zeige mir einen kompakten Status-Überblick — kurz und präzise (keine langen Erklärungen).

**Was du tun sollst:**

1. `git status --short` ausführen — zeige nur tatsächliche Änderungen (filtere `.claude/worktrees`)
2. `git log --oneline -5` — die letzten 5 Commits
3. `git log origin/main..HEAD --oneline` — ungepushte Commits
4. Aus `PROJECT_STATUS.md` Sektion 1 + Sektion 4 (Offene Aufgaben) extrahieren — kurz zusammenfassen

**Format der Antwort:**

```
📍 HEAD: <hash> <subject>
📤 Ungepusht: <X> Commits | 📝 Uncommitted: <X> Files
🕐 Letzte 3 Commits:
   - <hash> <subject>
   - <hash> <subject>
   - <hash> <subject>

🔴 Pre-Release-Blocker: <kurz>
🟡 Feature-Vervollständigung: <kurz>
```

**Wichtig:** Antwort soll < 200 Wörter sein. Keine Tool-Calls außerhalb des Skripts. Lies KEINE großen Dateien (insbesondere nicht PROJECT_STATUS_ARCHIVE.md).
