create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  company_id uuid null references public.companies(id) on delete set null,
  workspace_id uuid null references public.workspaces(id) on delete set null,
  source text not null default 'telegram'
    check (source in ('telegram', 'mini_app', 'manual')),
  status text not null default 'draft'
    check (status in ('draft', 'clarifying', 'completed', 'archived')),
  initial_message text not null,
  current_stage text not null default 'quick_scan',
  turn_count integer not null default 1 check (turn_count >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz null
);

create index if not exists cases_user_id_created_at_idx
  on public.cases(user_id, created_at desc);

create index if not exists cases_company_id_updated_at_idx
  on public.cases(company_id, updated_at desc);

create index if not exists cases_status_updated_at_idx
  on public.cases(status, updated_at desc);

create trigger set_cases_updated_at
before update on public.cases
for each row
execute function public.set_updated_at();

alter table public.cases enable row level security;

create table if not exists public.case_messages (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  text text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists case_messages_case_id_created_at_idx
  on public.case_messages(case_id, created_at asc);

alter table public.case_messages enable row level security;

create table if not exists public.case_results (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null unique references public.cases(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  company_id uuid null references public.companies(id) on delete set null,
  structured_result jsonb not null,
  confidence_level text null,
  main_constraint text null,
  dominant_situation text null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists case_results_user_id_created_at_idx
  on public.case_results(user_id, created_at desc);

create index if not exists case_results_company_id_created_at_idx
  on public.case_results(company_id, created_at desc);

alter table public.case_results enable row level security;

create table if not exists public.case_artifacts (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  company_id uuid null references public.companies(id) on delete set null,
  title text not null,
  summary text not null,
  content_markdown text not null,
  artifact_type text not null default 'diagnostic_result',
  created_at timestamptz not null default timezone('utc', now()),
  unique (case_id, artifact_type)
);

create index if not exists case_artifacts_user_id_created_at_idx
  on public.case_artifacts(user_id, created_at desc);

create index if not exists case_artifacts_company_id_created_at_idx
  on public.case_artifacts(company_id, created_at desc);

alter table public.case_artifacts enable row level security;

create table if not exists public.case_tool_recommendations (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  tool_title text not null,
  reason_now text not null,
  task_solved text not null,
  why_not_secondary text null,
  tool_slug text null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (case_id, tool_title)
);

create index if not exists case_tool_recommendations_case_id_idx
  on public.case_tool_recommendations(case_id);

alter table public.case_tool_recommendations enable row level security;

create table if not exists public.company_snapshots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  source_case_id uuid null references public.cases(id) on delete set null,
  current_goal text null,
  main_constraint text null,
  dominant_situation text null,
  first_wave_summary text null,
  tool_recommendations jsonb not null default '[]'::jsonb,
  summary text not null,
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists company_snapshots_user_id_updated_at_idx
  on public.company_snapshots(user_id, updated_at desc);

create index if not exists company_snapshots_source_case_id_idx
  on public.company_snapshots(source_case_id);

create trigger set_company_snapshots_updated_at
before update on public.company_snapshots
for each row
execute function public.set_updated_at();

alter table public.company_snapshots enable row level security;
