create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  user_id uuid null,
  telegram_user_id bigint null,
  company_id uuid null,
  diagnosis_session_id uuid null,
  entry_session_telegram_user_id bigint null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_event_name_idx
  on public.analytics_events(event_name, created_at desc);

create index if not exists analytics_events_telegram_user_id_idx
  on public.analytics_events(telegram_user_id, created_at desc);

create index if not exists analytics_events_user_id_idx
  on public.analytics_events(user_id, created_at desc);

create index if not exists analytics_events_company_id_idx
  on public.analytics_events(company_id, created_at desc);

create index if not exists analytics_events_diagnosis_session_id_idx
  on public.analytics_events(diagnosis_session_id, created_at desc);
