-- Migration: pk_next_angebot_number() Race-Condition-Fix
-- Datum: 2026-05-20
-- Problem: Bisherige Implementierung nutzte SELECT MAX(...) + 1 → bei parallelen
--          Inserts können dieselbe Angebotsnummer doppelt vergeben werden.
-- Fix:     Atomare INSERT ... ON CONFLICT DO UPDATE auf der existierenden
--          Tabelle `billing_sequences` (analog zu pk_next_invoice_number).
--
-- Backwards-Compat: Sequenz wird pro Jahr mit dem aktuellen MAX seeded,
-- damit bestehende Angebotsnummern nicht doppelt vergeben werden.

-- 1) billing_sequences pro Jahr mit aktuellem MAX vorbelegen
insert into billing_sequences (key, value, updated_at)
select
  'angebot:' || yr,
  max_nr,
  now()
from (
  select
    substring(nummer from 5 for 4) as yr,
    max(cast(substring(nummer from 9) as integer)) as max_nr
  from buero_angebote
  where nummer ~ '^ANG-\d{4}-\d{5}$'
  group by substring(nummer from 5 for 4)
) seed
on conflict (key) do update set
  value = greatest(billing_sequences.value, excluded.value),
  updated_at = now();

-- 2) Funktion atomar neu erstellen
create or replace function pk_next_angebot_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_value bigint;
  current_year text := to_char(now(), 'YYYY');
begin
  insert into billing_sequences (key, value, updated_at)
  values ('angebot:' || current_year, 1, now())
  on conflict (key) do update set
    value = billing_sequences.value + 1,
    updated_at = now()
  returning value into next_value;

  return 'ANG-' || current_year || '-' || lpad(next_value::text, 5, '0');
end;
$$;

grant execute on function pk_next_angebot_number() to authenticated;
