create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  active_company_id uuid null,
  active_diagnosis_session_id uuid null,
  last_completed_diagnosis_session_id uuid null,
  last_visited_route text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists workspaces_active_company_id_idx
  on public.workspaces(active_company_id);

create index if not exists workspaces_active_diagnosis_session_id_idx
  on public.workspaces(active_diagnosis_session_id);

create index if not exists workspaces_last_completed_diagnosis_session_id_idx
  on public.workspaces(last_completed_diagnosis_session_id);

create trigger set_workspaces_updated_at
before update on public.workspaces
for each row
execute function public.set_updated_at();

alter table public.workspaces enable row level security;
