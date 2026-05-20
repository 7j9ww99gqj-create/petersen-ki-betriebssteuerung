-- Trigger: werkstatt_karten.stunden_ist nach Zeitbuchung aktualisieren
-- Aktualisiert stunden in werkstatt_karten auf Summe aller Zeitbuchungen für auftragsnr+user_id

create or replace function update_werkstatt_karte_stunden()
returns trigger language plpgsql as $$
declare
  v_auftragsnr text;
  v_user_id uuid;
  v_summe numeric;
begin
  if TG_OP = 'DELETE' then
    v_auftragsnr := OLD.auftragsnr;
    v_user_id := OLD.user_id;
  else
    v_auftragsnr := NEW.auftragsnr;
    v_user_id := NEW.user_id;
  end if;

  select coalesce(sum(stunden), 0)
    into v_summe
    from werkstatt_zeitbuchungen
   where auftragsnr = v_auftragsnr
     and user_id = v_user_id;

  update werkstatt_karten
     set stunden = v_summe,
         updated_at = now()
   where auftragsnr = v_auftragsnr
     and user_id = v_user_id;

  return null;
end;
$$;

drop trigger if exists trg_werkstatt_zeitbuchung_stunden on werkstatt_zeitbuchungen;
create trigger trg_werkstatt_zeitbuchung_stunden
  after insert or update or delete on werkstatt_zeitbuchungen
  for each row execute function update_werkstatt_karte_stunden();
