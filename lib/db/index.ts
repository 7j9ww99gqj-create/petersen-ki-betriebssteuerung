/**
 * lib/db/index.ts — Domain-orientierter Daten-Layer (Phase 2)
 *
 * Alle Funktionen aus lib/db.ts sind auch über die Domain-Barrel-Dateien verfügbar.
 * Bestehende Imports (`from '@/lib/db'`) bleiben unverändert funktionsfähig.
 *
 * Neuer Code soll Domain-spezifisch importieren:
 *   import { getLagerArtikel } from '@/lib/db/lager'
 *   import { getBueroKunden }  from '@/lib/db/buero'
 *
 * Alles re-exportieren für Abwärtskompatibilität:
 */
export * from '../db'
export * from './_shared'
