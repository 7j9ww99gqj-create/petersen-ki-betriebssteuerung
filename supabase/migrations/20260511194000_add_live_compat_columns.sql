-- Petersen KI - Live compatibility columns for imports and Einkauf

alter table lager_artikel
  add column if not exists artikelnummer text,
  add column if not exists beschreibung text,
  add column if not exists einkaufspreis numeric default 0,
  add column if not exists verkaufspreis numeric default 0,
  add column if not exists lagerort text;

alter table buero_kunden
  add column if not exists adresse text,
  add column if not exists kundennummer text,
  add column if not exists notizen text;

alter table buero_rechnungen
  add column if not exists nummer text,
  add column if not exists datum text,
  add column if not exists faellig_am text,
  add column if not exists summe numeric default 0,
  add column if not exists notiz text;

alter table einkauf_lieferanten
  add column if not exists kontakt text,
  add column if not exists ort text,
  add column if not exists status text default 'Aktiv';

alter table steuer_belege
  add column if not exists belegnummer text,
  add column if not exists kategorie text;

