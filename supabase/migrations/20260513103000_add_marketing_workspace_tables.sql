-- Petersen KI - Marketing workspaces aus local-only Zustand auf echte Persistenz heben

create table if not exists marketing_content_ideas (
  id             text primary key,
  user_id        uuid references auth.users not null default auth.uid(),
  titel          text not null,
  kanal          text default 'LinkedIn',
  ziel           text,
  keyword        text,
  hook           text,
  cta            text,
  status         text default 'Idee',
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create table if not exists marketing_posting_plans (
  id             text primary key,
  user_id        uuid references auth.users not null default auth.uid(),
  titel          text not null,
  kanal          text default 'LinkedIn',
  datum          text,
  status         text default 'Entwurf',
  owner          text,
  quelle         text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create table if not exists marketing_automation_rules (
  id             text primary key,
  user_id        uuid references auth.users not null default auth.uid(),
  name           text not null,
  trigger        text,
  aktion         text,
  kanal          text default 'CRM',
  owner          text,
  status         text default 'Entwurf',
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create table if not exists marketing_integration_items (
  id                text primary key,
  user_id           uuid references auth.users not null default auth.uid(),
  name              text not null,
  status            text default 'Nicht gestartet',
  datenbasis        text,
  letzterSync       text,
  naechsterSchritt  text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

alter table marketing_content_ideas enable row level security;
alter table marketing_posting_plans enable row level security;
alter table marketing_automation_rules enable row level security;
alter table marketing_integration_items enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'marketing_content_ideas' and policyname = 'marketing_content_ideas_user'
  ) then
    create policy "marketing_content_ideas_user"
      on marketing_content_ideas
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'marketing_posting_plans' and policyname = 'marketing_posting_plans_user'
  ) then
    create policy "marketing_posting_plans_user"
      on marketing_posting_plans
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'marketing_automation_rules' and policyname = 'marketing_automation_rules_user'
  ) then
    create policy "marketing_automation_rules_user"
      on marketing_automation_rules
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'marketing_integration_items' and policyname = 'marketing_integration_items_user'
  ) then
    create policy "marketing_integration_items_user"
      on marketing_integration_items
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;
