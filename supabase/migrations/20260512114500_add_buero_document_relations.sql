-- Petersen KI - Phase 1 follow-up: echte Dokumentrelationen im Bürobereich

alter table if exists buero_eingangsrechnungen
  add column if not exists dokument_id text;

alter table if exists buero_dokumente
  add column if not exists eingangsrechnung_id text references buero_eingangsrechnungen(id),
  add column if not exists rechnung_id text references buero_rechnungen(id),
  add column if not exists angebot_id text references buero_angebote(id),
  add column if not exists auftrag_id text references buero_auftraege(id);

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'buero_eingangsrechnungen'
      and constraint_name = 'buero_eingangsrechnungen_dokument_id_fkey'
  ) then
    alter table buero_eingangsrechnungen
      add constraint buero_eingangsrechnungen_dokument_id_fkey
      foreign key (dokument_id) references buero_dokumente(id);
  end if;
end $$;

update buero_dokumente d
set eingangsrechnung_id = er.id,
    kategorie = coalesce(nullif(d.kategorie, ''), 'Rechnung'),
    bezug = coalesce(nullif(d.bezug, ''), er.lieferant),
    updated_at = now()
from buero_eingangsrechnungen er
where er.dokument_id = d.id
  and coalesce(d.eingangsrechnung_id, '') <> er.id;

create index if not exists idx_buero_eingangsrechnungen_dokument_id on buero_eingangsrechnungen(dokument_id);
create index if not exists idx_buero_dokumente_eingangsrechnung_id on buero_dokumente(eingangsrechnung_id);
create index if not exists idx_buero_dokumente_rechnung_id on buero_dokumente(rechnung_id);
create index if not exists idx_buero_dokumente_angebot_id on buero_dokumente(angebot_id);
create index if not exists idx_buero_dokumente_auftrag_id on buero_dokumente(auftrag_id);
