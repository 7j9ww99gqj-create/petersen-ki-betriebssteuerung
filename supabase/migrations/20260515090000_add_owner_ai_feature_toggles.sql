alter table if exists firma_einstellungen
  add column if not exists ai_enabled boolean default true,
  add column if not exists ai_chat_enabled boolean default true,
  add column if not exists ai_document_enabled boolean default true;

update firma_einstellungen
set
  ai_enabled = coalesce(ai_enabled, true),
  ai_chat_enabled = coalesce(ai_chat_enabled, true),
  ai_document_enabled = coalesce(ai_document_enabled, true)
where ai_enabled is null
   or ai_chat_enabled is null
   or ai_document_enabled is null;

create or replace function pk_get_ai_settings()
returns table (
  ai_enabled boolean,
  ai_chat_enabled boolean,
  ai_document_enabled boolean
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    coalesce(f.ai_enabled, true) as ai_enabled,
    coalesce(f.ai_chat_enabled, true) as ai_chat_enabled,
    coalesce(f.ai_document_enabled, true) as ai_document_enabled
  from (
    select ai_enabled, ai_chat_enabled, ai_document_enabled
    from firma_einstellungen
    order by updated_at desc nulls last
    limit 1
  ) f
  union all
  select true, true, true
  where not exists (select 1 from firma_einstellungen);
$$;
