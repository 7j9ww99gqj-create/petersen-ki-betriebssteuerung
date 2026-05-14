create table if not exists billing_sequences (
  key text primary key,
  value bigint not null default 0,
  updated_at timestamptz not null default now()
);

create or replace function pk_next_invoice_number()
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
  values ('invoice:' || current_year, 1, now())
  on conflict (key) do update set
    value = billing_sequences.value + 1,
    updated_at = now()
  returning value into next_value;

  return 'RE-' || current_year || '-' || lpad(next_value::text, 5, '0');
end;
$$;
