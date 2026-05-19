<!--
🧠 Petersen KI Pull-Request Template
   Bitte alle relevanten Abschnitte ausfüllen — leere lassen wenn nicht zutreffend.
-->

## Zusammenfassung

<!-- Kurz: was macht dieser PR und warum? 1-3 Sätze. -->

## Art der Änderung

- [ ] 🚀 Neues Feature (`feat:`)
- [ ] 🐛 Bug-Fix (`fix:`)
- [ ] 🧹 Refactoring ohne Verhaltensänderung (`refactor:`)
- [ ] 📚 Doku-Update (`docs:`)
- [ ] ⚙️ Build/CI/Tooling (`chore:`)
- [ ] 🧪 Test-Erweiterung (`test:`)

## Checkliste

- [ ] `npx tsc --noEmit` lokal grün
- [ ] `npm test` lokal grün
- [ ] `npm run build` lokal grün
- [ ] Bei Schema-Änderung: Migration in `supabase/migrations/` vorhanden
- [ ] Bei UI-Änderung: visueller Check in Vercel-Preview-URL
- [ ] Demo-Modus geprüft (`hasDemoCookie()`-Pfad funktioniert)
- [ ] `PROJECT_STATUS.md` aktualisiert (falls relevant)
- [ ] Keine `console.log` / Debug-Code im Production-Pfad
- [ ] Keine hardcoded Credentials oder API-Keys

## Test-Hinweise

<!-- Wie kann man das im Preview-Deploy testen?
     Beispiel: "Login als info@petersen-ki-pilot.de → /dashboard/einstellungen → 'Datenauskunft' klicken → JSON-Download" -->

## Screenshots / Demo

<!-- Bei UI-Änderungen: Vorher/Nachher-Screenshots oder Preview-URL einfügen. -->

## Verlinkte Aufgaben

<!-- z.B. PROJECT_STATUS §0.1.1 Aufgabe 16 -->

## Risiken / Breaking-Changes

<!-- Was könnte unerwartet brechen? Migrations-Reversibilität? -->
