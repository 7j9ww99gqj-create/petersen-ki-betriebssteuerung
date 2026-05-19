/**
 * lib/db/lager.ts — Lager-Domain-Barrel
 *
 * Re-exportiert alle Lager-Funktionen aus lib/db.ts.
 * Bestehende Imports (`from '@/lib/db'`) bleiben funktionsfähig.
 * Neuer Code kann gezielt `from '@/lib/db/lager'` importieren.
 *
 * Migration-Pfad: Schrittweise Implementierungen hierher verschieben,
 * bis lib/db.ts ein reiner Barrel-Exporter ist.
 */
export {
  getLagerArtikel,
  upsertLagerArtikel,
  deleteLagerArtikel,
  getLagerBildSignedUrl,
  getLagerBildSignedUrls,
  uploadLagerArtikelBild,
  deleteLagerArtikelBild,
  getLagerBestandSnapshots,
  insertLagerBestandSnapshot,
  getLagerBewegungen,
  insertLagerBewegung,
  syncWerkstattMaterialToLager,
  getLagerStellplaetze,
  upsertLagerStellplatz,
  deleteLagerStellplatz,
  getLagerStellplatzBestand,
  upsertLagerStellplatzBestand,
  deleteLagerStellplatzBestand,
  getLagerUmlagerungen,
  insertLagerUmlagerung,
  umlagerArtikel,
} from '../db'
