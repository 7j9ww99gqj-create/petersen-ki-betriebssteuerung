-- FK steuer_buchungen.beleg_id → steuer_belege.id (ON DELETE SET NULL)
-- Verhindert Buchungen auf nicht-existierende Belege (GoBD-Anforderung)

-- Bestehende verwaiste beleg_ids bereinigen
update steuer_buchungen sb
   set beleg_id = null
 where beleg_id is not null
   and not exists (
     select 1 from steuer_belege b
      where b.id::text = sb.beleg_id
        and b.user_id = sb.user_id
   );

-- steuer_belege.id von text auf uuid ändern falls nötig — nur FK anlegen wenn types matchen
-- Beide Spalten sind text, daher kein Cast nötig

alter table steuer_buchungen
  add constraint fk_steuer_buchungen_beleg
  foreign key (beleg_id) references steuer_belege(id)
  on delete set null
  deferrable initially deferred;
