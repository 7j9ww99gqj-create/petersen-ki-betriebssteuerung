-- Pondruff Feature-Flags pro User
-- Inhaber (Petersen-KI Owner) kann zentral steuern, welche OpenAI-Funktionen
-- der Pondruff-User benutzen darf. Defaults: alle an.
-- Rollback: drop table pondruff_feature_flags cascade;

create table if not exists pondruff_feature_flags (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ocr_wareneingang boolean not null default true,
  ocr_preisrechner boolean not null default true,
  ki_bauteilsuche boolean not null default true,
  wiso_sync boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table pondruff_feature_flags enable row level security;

-- User darf seine eigenen Flags lesen
drop policy if exists pondruff_feature_flags_select_self on pondruff_feature_flags;
create policy pondruff_feature_flags_select_self
  on pondruff_feature_flags for select
  using (auth.uid() = user_id);

-- Nur Service-Role (Owner-Admin-API) darf schreiben — keine User-Policies fuer insert/update/delete.
-- Updates laufen ueber updateBillingSubscriptionControls-aehnliche Server-Routes mit Service-Role-Key.

-- Initial-Eintrag fuer den bekannten Pondruff-User, falls noch nicht vorhanden
insert into pondruff_feature_flags (user_id)
values ('7eb541ca-ca2e-4890-9c20-51ee20a00b43')
on conflict (user_id) do nothing;
