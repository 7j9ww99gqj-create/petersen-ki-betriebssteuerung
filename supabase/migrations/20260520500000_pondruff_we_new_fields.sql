alter table pondruff_wareneingaenge
  add column if not exists purchase_order text,
  add column if not exists positionen jsonb,
  add column if not exists lieferbedingungen text,
  add column if not exists eingelagert_am date,
  add column if not exists eingelagert_von text;
