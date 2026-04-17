create table if not exists public.entry_sessions (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null,
  stage text not null default 'initial',
  entry_mode text not null default 'unclear',
  initial_message text not null,
  last_question_key text null,
  last_question_text text null,
  detected_intent jsonb null,
  tool_confidence text null,
  clarifying_answers jsonb not null default '[]'::jsonb,
  turn_count integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entry_sessions_stage_check
    check (stage in ('initial', 'clarifying', 'ready_for_routing')),
  constraint entry_sessions_entry_mode_check
    check (entry_mode in ('problem_first', 'tool_discovery', 'specific_tool_request', 'unclear')),
  constraint entry_sessions_tool_confidence_check
    check (tool_confidence is null or tool_confidence in ('low', 'medium', 'high')),
  constraint entry_sessions_turn_count_check
    check (turn_count >= 1)
);

create unique index if not exists entry_sessions_telegram_user_id_uidx
  on public.entry_sessions(telegram_user_id);

create index if not exists entry_sessions_updated_at_idx
  on public.entry_sessions(updated_at desc);

create table if not exists public.tool_demand_signals (
  id uuid primary key default gen_random_uuid(),
  tool_query text not null,
  normalized_tool text null,
  entry_mode text not null,
  detected_intent text null,
  confidence text not null,
  telegram_user_id bigint not null,
  created_at timestamptz not null default now(),
  constraint tool_demand_signals_entry_mode_check
    check (entry_mode in ('problem_first', 'tool_discovery', 'specific_tool_request', 'unclear')),
  constraint tool_demand_signals_confidence_check
    check (confidence in ('low', 'medium', 'high'))
);

create index if not exists tool_demand_signals_telegram_user_id_idx
  on public.tool_demand_signals(telegram_user_id, created_at desc);

create index if not exists tool_demand_signals_created_at_idx
  on public.tool_demand_signals(created_at desc);
