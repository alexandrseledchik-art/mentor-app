alter table public.diagnosis_sessions
add column if not exists user_id uuid,
add column if not exists current_step integer,
add column if not exists answers jsonb,
add column if not exists score_overall integer,
add column if not exists started_at timestamptz,
add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table public.diagnosis_sessions
drop constraint if exists diagnosis_sessions_user_id_fkey;

alter table public.diagnosis_sessions
add constraint diagnosis_sessions_user_id_fkey
foreign key (user_id)
references public.users(id)
on delete cascade;

create index if not exists diagnosis_sessions_user_id_idx
  on public.diagnosis_sessions(user_id);

create index if not exists diagnosis_sessions_user_id_created_at_idx
  on public.diagnosis_sessions(user_id, created_at desc);

create index if not exists diagnosis_sessions_status_updated_at_idx
  on public.diagnosis_sessions(status, updated_at desc);

create trigger set_diagnosis_sessions_updated_at
before update on public.diagnosis_sessions
for each row
execute function public.set_updated_at();
