---
description: Vercel-Deploy-Status prüfen + bei Bedarf manuell anstoßen
allowed-tools: Bash(git log:*), Bash(git status:*), Bash(curl:*), Bash(git push:*)
---

Prüfe den Deploy-Status auf Vercel und GitHub.

**Was du tun sollst:**

1. **Lokal:** `git status` + `git log origin/main..HEAD --oneline` — gibt es ungepushte Commits?
2. **Wenn ungepusht:** `git push origin main` aufrufen (PreToolUse-Hook macht TS-Check automatisch)
3. **GitHub-API abfragen:** Aktuellen Commit-Build-Status:
   ```bash
   curl -s "https://api.github.com/repos/7j9ww99gqj-create/petersen-ki-betriebssteuerung/commits/main/status"
   ```
   Parse das JSON und zeige:
   - `state` (pending/success/failure)
   - `description`
   - `target_url` (Vercel-Deploy-URL)
4. **Live-URL prüfen:** `curl -I https://app.petersen-ki-pilot.de` — HTTP-Status + `x-vercel-id`-Header

**Format der Antwort:**

```
📤 Push: <ergebnis oder "nichts ungepushtes">
🏗️  Build: <state> — <description>
🌐 Vercel-URL: <target_url>
🚀 Live: HTTP <status>
```

Antwort knapp halten — keine langen Erklärungen.
