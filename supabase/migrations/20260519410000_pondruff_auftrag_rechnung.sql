-- Pondruff: Auftrag → Rechnung Workflow
-- Erweitert pondruff_preisauftraege um Status + Rechnung-Felder.
-- Rollback: alter table pondruff_preisauftraege drop column status, invoice_no, invoice_date, parent_id, confirmed_at;

alter table pondruff_preisauftraege
  add column if not exists status text default 'preisauftrag',
  add column if not exists parent_id uuid references pondruff_preisauftraege(id) on delete set null,
  add column if not exists confirmed_at timestamp with time zone,
  add column if not exists invoice_no text,
  add column if not exists invoice_date date;

create index if not exists pondruff_preise_status_idx on pondruff_preisauftraege(user_id, status, created_at desc);

-- Sequenz fuer aufsteigende Rechnungsnummern pro Nutzer (Schema-weit eine Sequenz reicht — Praefix nutzt Jahr)
create sequence if not exists pondruff_invoice_seq start 1000;
