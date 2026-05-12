-- Petersen KI - Kernrelationen zwischen Buero/Einkauf weiter absichern

alter table if exists buero_angebote
  add column if not exists kunde_id text references buero_kunden(id);

alter table if exists buero_auftraege
  add column if not exists kunde_id text references buero_kunden(id);

alter table if exists buero_rechnungen
  add column if not exists kunde_id text references buero_kunden(id);

alter table if exists buero_eingangsrechnungen
  add column if not exists lieferant_id text references einkauf_lieferanten(id);

update buero_angebote a
set kunde_id = k.id
from buero_kunden k
where a.user_id = k.user_id
  and coalesce(a.kunde_id, '') = ''
  and coalesce(a.kunde, '') <> ''
  and lower(trim(a.kunde)) = lower(trim(k.name));

update buero_auftraege a
set kunde_id = k.id
from buero_kunden k
where a.user_id = k.user_id
  and coalesce(a.kunde_id, '') = ''
  and coalesce(a.kunde, '') <> ''
  and lower(trim(a.kunde)) = lower(trim(k.name));

update buero_rechnungen r
set kunde_id = k.id
from buero_kunden k
where r.user_id = k.user_id
  and coalesce(r.kunde_id, '') = ''
  and coalesce(r.kunde, '') <> ''
  and lower(trim(r.kunde)) = lower(trim(k.name));

update buero_eingangsrechnungen er
set lieferant_id = l.id
from einkauf_lieferanten l
where er.user_id = l.user_id
  and coalesce(er.lieferant_id, '') = ''
  and coalesce(er.lieferant, '') <> ''
  and lower(trim(er.lieferant)) = lower(trim(l.name));

create index if not exists idx_buero_angebote_kunde_id on buero_angebote(kunde_id);
create index if not exists idx_buero_auftraege_kunde_id on buero_auftraege(kunde_id);
create index if not exists idx_buero_rechnungen_kunde_id on buero_rechnungen(kunde_id);
create index if not exists idx_buero_eingangsrechnungen_lieferant_id on buero_eingangsrechnungen(lieferant_id);
