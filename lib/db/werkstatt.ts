/**
 * lib/db/werkstatt.ts — Werkstatt-Domain-Barrel
 * Re-exportiert alle Werkstatt-Funktionen aus lib/db.ts.
 */
export {
  getWerkstattKarten,
  upsertWerkstattKarte,
  deleteWerkstattKarte,
  getWerkstattMitarbeiter,
  upsertWerkstattMitarbeiter,
  deleteWerkstattMitarbeiter,
  getWerkstattBereiche,
  upsertWerkstattBereich,
  deleteWerkstattBereich,
  getWerkstattZeitbuchungen,
  insertWerkstattZeitbuchung,
  getWerkstattMaterial,
  insertWerkstattMaterial,
  getWerkstattPruefprotokolle,
  insertWerkstattPruefprotokoll,
  getWerkstattWartungen,
  upsertWerkstattWartung,
  deleteWerkstattWartung,
  getWerkstattStoerungen,
  upsertWerkstattStoerung,
  deleteWerkstattStoerung,
} from '../db'
