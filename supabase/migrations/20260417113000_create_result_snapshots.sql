create table if not exists public.result_snapshots (
  id uuid primary key default gen_random_uuid(),
  diagnosis_session_id uuid not null unique references public.diagnosis_sessions(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  overall_score integer,
  dimension_scores jsonb not null,
  weakest_zones jsonb not null,
  strongest_zones jsonb not null,
  summary jsonb not null,
  recommended_tools jsonb not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists result_snapshots_user_id_created_at_idx
  on public.result_snapshots(user_id, created_at desc);

create index if not exists result_snapshots_company_id_created_at_idx
  on public.result_snapshots(company_id, created_at desc);
