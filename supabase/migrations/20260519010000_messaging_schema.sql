-- Messaging & Postfach-System
-- user_messages: User → Owner Support-Anfragen
-- broadcast_messages: Owner → User/All Broadcasts

create table if not exists user_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  message_type text not null default 'support_request' check (message_type in ('support_request', 'broadcast')),
  subject text not null,
  body text not null,
  is_read boolean default false,
  read_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table user_messages enable row level security;

create policy "user_messages_select" on user_messages
  for select using (
    auth.uid() = user_id
    or pk_is_owner()
  );

create policy "user_messages_insert" on user_messages
  for insert with check (auth.uid() = user_id);

create policy "user_messages_update" on user_messages
  for update using (pk_is_owner())
  with check (pk_is_owner());

create index if not exists idx_user_messages_user_created on user_messages(user_id, created_at desc);
create index if not exists idx_user_messages_is_read on user_messages(is_read, created_at desc);

-- Owner → User Broadcast Nachrichten
create table if not exists broadcast_messages (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users not null,
  subject text not null,
  body text not null,
  recipient_type text not null default 'all' check (recipient_type in ('all', 'single')),
  recipient_user_id uuid references auth.users,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table broadcast_messages enable row level security;

create policy "broadcast_messages_select" on broadcast_messages
  for select using (
    auth.uid() = recipient_user_id
    or auth.uid() = owner_user_id
    or recipient_type = 'all'
  );

create policy "broadcast_messages_insert" on broadcast_messages
  for insert with check (pk_is_owner());

create index if not exists idx_broadcast_messages_created on broadcast_messages(created_at desc);
create index if not exists idx_broadcast_messages_recipient on broadcast_messages(recipient_user_id, created_at desc);
