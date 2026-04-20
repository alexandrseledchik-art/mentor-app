alter table public.entry_sessions
  add column if not exists conversation_frame jsonb not null default '{}'::jsonb,
  add column if not exists active_unknown text null;
