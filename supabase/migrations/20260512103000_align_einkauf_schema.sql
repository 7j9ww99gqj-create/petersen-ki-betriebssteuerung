-- Petersen KI - Einkauf schema alignment between UI, lib/db and live migrations

alter table einkauf_bestellungen
  add column if not exists lieferant_id text references einkauf_lieferanten(id),
  add column if not exists lieferant text,
  add column if not exists einheit text default 'Stk',
  add column if not exists einkaufspreis text,
  add column if not exists gesamt text,
  add column if not exists bestellt_am text,
  add column if not exists erwartet_am text,
  add column if not exists geliefert_am text,
  add column if not exists einzelpreis numeric default 0,
  add column if not exists gesamtpreis numeric default 0,
  add column if not exists bestelldatum text,
  add column if not exists lieferdatum_soll text;

update einkauf_bestellungen eb
set lieferant = coalesce(nullif(eb.lieferant, ''), lf.name),
    einheit = coalesce(nullif(eb.einheit, ''), 'Stk'),
    einkaufspreis = coalesce(
      nullif(eb.einkaufspreis, ''),
      to_char(coalesce(eb.einzelpreis, 0), 'FM999999990D00') || ' €'
    ),
    gesamt = coalesce(
      nullif(eb.gesamt, ''),
      to_char(coalesce(eb.gesamtpreis, 0), 'FM999999990D00') || ' €'
    ),
    bestellt_am = coalesce(nullif(eb.bestellt_am, ''), eb.bestelldatum),
    erwartet_am = coalesce(nullif(eb.erwartet_am, ''), eb.lieferdatum_soll)
from einkauf_lieferanten lf
where eb.lieferant_id = lf.id;

update einkauf_bestellungen
set einheit = coalesce(nullif(einheit, ''), 'Stk'),
    einzelpreis = coalesce(einzelpreis, 0),
    gesamtpreis = coalesce(gesamtpreis, 0),
    bestelldatum = coalesce(nullif(bestelldatum, ''), bestellt_am),
    lieferdatum_soll = coalesce(nullif(lieferdatum_soll, ''), erwartet_am),
    einkaufspreis = coalesce(
      nullif(einkaufspreis, ''),
      to_char(coalesce(einzelpreis, 0), 'FM999999990D00') || ' €'
    ),
    gesamt = coalesce(
      nullif(gesamt, ''),
      to_char(coalesce(gesamtpreis, 0), 'FM999999990D00') || ' €'
    );

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'einkauf_wareneingaenge'
      and column_name = 'id'
      and data_type = 'bigint'
  ) then
    alter table einkauf_wareneingaenge alter column id drop default;
    alter table einkauf_wareneingaenge alter column id type text using id::text;
  end if;
end $$;

alter table einkauf_wareneingaenge
  add column if not exists lieferant text,
  add column if not exists artikel text,
  add column if not exists menge numeric default 0,
  add column if not exists einheit text default 'Stk',
  add column if not exists datum text,
  add column if not exists mitarbeiter text,
  add column if not exists notiz text,
  add column if not exists eingangsdatum text,
  add column if not exists menge_bestellt numeric default 0,
  add column if not exists menge_erhalten numeric default 0;

update einkauf_wareneingaenge we
set lieferant = coalesce(nullif(we.lieferant, ''), eb.lieferant),
    artikel = coalesce(nullif(we.artikel, ''), eb.artikel),
    menge = coalesce(we.menge, we.menge_erhalten, we.menge_bestellt, eb.menge, 0),
    einheit = coalesce(nullif(we.einheit, ''), eb.einheit, 'Stk'),
    datum = coalesce(nullif(we.datum, ''), we.eingangsdatum),
    eingangsdatum = coalesce(nullif(we.eingangsdatum, ''), we.datum),
    menge_bestellt = coalesce(we.menge_bestellt, we.menge, eb.menge, 0),
    menge_erhalten = coalesce(we.menge_erhalten, we.menge, 0)
from einkauf_bestellungen eb
where we.bestellung_id = eb.id;

update einkauf_wareneingaenge
set menge = coalesce(menge, menge_erhalten, menge_bestellt, 0),
    einheit = coalesce(nullif(einheit, ''), 'Stk'),
    datum = coalesce(nullif(datum, ''), eingangsdatum),
    eingangsdatum = coalesce(nullif(eingangsdatum, ''), datum),
    menge_bestellt = coalesce(menge_bestellt, menge, 0),
    menge_erhalten = coalesce(menge_erhalten, menge, 0),
    mitarbeiter = coalesce(nullif(mitarbeiter, ''), '—');
