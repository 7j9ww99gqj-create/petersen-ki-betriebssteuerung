-- FK werkstatt_material.karte_id → werkstatt_karten.id (ON DELETE SET NULL)
-- Ermöglicht referentielle Integrität ohne Breaking Change auf auftragsnr-Text

alter table werkstatt_material
  add column if not exists karte_id text references werkstatt_karten(id) on delete set null;

-- Bestehende Zeilen: karte_id aus auftragsnr-Match befüllen (best-effort, gleicher user)
update werkstatt_material m
   set karte_id = k.id
  from werkstatt_karten k
 where k.auftragsnr = m.auftragsnr
   and k.user_id = m.user_id
   and m.karte_id is null;
