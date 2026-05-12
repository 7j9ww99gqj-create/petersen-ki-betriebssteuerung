create table if not exists marketing_seo_keywords (
  id             text primary key,
  user_id        uuid references auth.users not null default auth.uid(),
  keyword        text not null,
  zielseite      text,
  intent         text default 'Transaktional',
  suchvolumen    integer default 0,
  schwierigkeit  integer default 0,
  ranking        integer default 0,
  klicks         integer default 0,
  status         text default 'Neu',
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

alter table marketing_seo_keywords enable row level security;

create policy "marketing_seo_keywords_user"
  on marketing_seo_keywords
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
