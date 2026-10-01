create table if not exists contacts (
  wa_id text primary key, name text, unread int not null default 0,
  last_message_at timestamptz, last_inbound_at timestamptz);
create table if not exists messages (
  id text primary key, wa_id text not null, direction text not null,
  body text, status text, error text, created_at timestamptz not null default now());
create index if not exists messages_wa_idx on messages (wa_id, created_at);
