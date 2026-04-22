create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'owner'
    check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, user_id)
);

create index if not exists workspace_members_workspace_id_idx
  on public.workspace_members(workspace_id);

create index if not exists workspace_members_user_id_idx
  on public.workspace_members(user_id);

create trigger set_workspace_members_updated_at
before update on public.workspace_members
for each row
execute function public.set_updated_at();

alter table public.workspace_members enable row level security;

insert into public.workspace_members (workspace_id, user_id, role)
select id, user_id, 'owner'
from public.workspaces
on conflict (workspace_id, user_id) do update
set role = excluded.role;

alter table public.companies
add column if not exists workspace_id uuid;

update public.companies
set workspace_id = workspaces.id
from public.workspaces
where public.companies.workspace_id is null
  and workspaces.user_id = public.companies.user_id;

alter table public.companies
drop constraint if exists companies_workspace_id_fkey;

alter table public.companies
add constraint companies_workspace_id_fkey
foreign key (workspace_id)
references public.workspaces(id)
on delete set null;

create index if not exists companies_workspace_id_idx
  on public.companies(workspace_id);

alter table public.diagnosis_sessions
add column if not exists workspace_id uuid;

update public.diagnosis_sessions
set workspace_id = companies.workspace_id
from public.companies
where public.diagnosis_sessions.workspace_id is null
  and companies.id = public.diagnosis_sessions.company_id;

update public.diagnosis_sessions
set workspace_id = workspaces.id
from public.workspaces
where public.diagnosis_sessions.workspace_id is null
  and workspaces.user_id = public.diagnosis_sessions.user_id;

alter table public.diagnosis_sessions
drop constraint if exists diagnosis_sessions_workspace_id_fkey;

alter table public.diagnosis_sessions
add constraint diagnosis_sessions_workspace_id_fkey
foreign key (workspace_id)
references public.workspaces(id)
on delete set null;

create index if not exists diagnosis_sessions_workspace_id_idx
  on public.diagnosis_sessions(workspace_id);

alter table public.result_snapshots
add column if not exists workspace_id uuid;

update public.result_snapshots
set workspace_id = diagnosis_sessions.workspace_id
from public.diagnosis_sessions
where public.result_snapshots.workspace_id is null
  and diagnosis_sessions.id = public.result_snapshots.diagnosis_session_id;

update public.result_snapshots
set workspace_id = companies.workspace_id
from public.companies
where public.result_snapshots.workspace_id is null
  and companies.id = public.result_snapshots.company_id;

alter table public.result_snapshots
drop constraint if exists result_snapshots_workspace_id_fkey;

alter table public.result_snapshots
add constraint result_snapshots_workspace_id_fkey
foreign key (workspace_id)
references public.workspaces(id)
on delete set null;

create index if not exists result_snapshots_workspace_id_idx
  on public.result_snapshots(workspace_id, created_at desc);

alter table public.company_snapshots
add column if not exists workspace_id uuid;

update public.company_snapshots
set workspace_id = companies.workspace_id
from public.companies
where public.company_snapshots.workspace_id is null
  and companies.id = public.company_snapshots.company_id;

alter table public.company_snapshots
drop constraint if exists company_snapshots_workspace_id_fkey;

alter table public.company_snapshots
add constraint company_snapshots_workspace_id_fkey
foreign key (workspace_id)
references public.workspaces(id)
on delete set null;

create index if not exists company_snapshots_workspace_id_idx
  on public.company_snapshots(workspace_id, updated_at desc);

update public.cases
set workspace_id = companies.workspace_id
from public.companies
where public.cases.workspace_id is null
  and companies.id = public.cases.company_id;

update public.cases
set workspace_id = workspaces.id
from public.workspaces
where public.cases.workspace_id is null
  and workspaces.user_id = public.cases.user_id;

drop policy if exists "users can read own workspaces" on public.workspaces;
drop policy if exists "users can create own workspaces" on public.workspaces;
drop policy if exists "users can update own workspaces" on public.workspaces;

create policy "members can read their workspaces"
on public.workspaces
for select
to authenticated
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspaces.id
      and wm.user_id = auth.uid()
  )
);

create policy "owners can create workspaces"
on public.workspaces
for insert
to authenticated
with check (user_id = auth.uid());

create policy "members can update their workspaces"
on public.workspaces
for update
to authenticated
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspaces.id
      and wm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspaces.id
      and wm.user_id = auth.uid()
  )
);

create policy "users can read own workspace memberships"
on public.workspace_members
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "users can read own companies" on public.companies;
drop policy if exists "users can create own companies" on public.companies;
drop policy if exists "users can update own companies" on public.companies;

create policy "members can read workspace companies"
on public.companies
for select
to authenticated
using (
  workspace_id in (
    select wm.workspace_id
    from public.workspace_members wm
    where wm.user_id = auth.uid()
  )
);

create policy "members can create workspace companies"
on public.companies
for insert
to authenticated
with check (
  workspace_id in (
    select wm.workspace_id
    from public.workspace_members wm
    where wm.user_id = auth.uid()
  )
);

create policy "members can update workspace companies"
on public.companies
for update
to authenticated
using (
  workspace_id in (
    select wm.workspace_id
    from public.workspace_members wm
    where wm.user_id = auth.uid()
  )
)
with check (
  workspace_id in (
    select wm.workspace_id
    from public.workspace_members wm
    where wm.user_id = auth.uid()
  )
);

drop policy if exists "users can read own diagnosis sessions" on public.diagnosis_sessions;
drop policy if exists "users can create own diagnosis sessions" on public.diagnosis_sessions;
drop policy if exists "users can update own diagnosis sessions" on public.diagnosis_sessions;

create policy "members can read workspace diagnosis sessions"
on public.diagnosis_sessions
for select
to authenticated
using (
  workspace_id in (
    select wm.workspace_id
    from public.workspace_members wm
    where wm.user_id = auth.uid()
  )
);

create policy "members can create workspace diagnosis sessions"
on public.diagnosis_sessions
for insert
to authenticated
with check (
  workspace_id in (
    select wm.workspace_id
    from public.workspace_members wm
    where wm.user_id = auth.uid()
  )
);

create policy "members can update workspace diagnosis sessions"
on public.diagnosis_sessions
for update
to authenticated
using (
  workspace_id in (
    select wm.workspace_id
    from public.workspace_members wm
    where wm.user_id = auth.uid()
  )
)
with check (
  workspace_id in (
    select wm.workspace_id
    from public.workspace_members wm
    where wm.user_id = auth.uid()
  )
);

drop policy if exists "users can read own diagnosis answers" on public.diagnosis_answers;
drop policy if exists "users can create own diagnosis answers" on public.diagnosis_answers;
drop policy if exists "users can update own diagnosis answers" on public.diagnosis_answers;

create policy "members can read workspace diagnosis answers"
on public.diagnosis_answers
for select
to authenticated
using (
  exists (
    select 1
    from public.diagnosis_sessions ds
    join public.workspace_members wm on wm.workspace_id = ds.workspace_id
    where ds.id = diagnosis_answers.diagnosis_session_id
      and wm.user_id = auth.uid()
  )
);

create policy "members can create workspace diagnosis answers"
on public.diagnosis_answers
for insert
to authenticated
with check (
  exists (
    select 1
    from public.diagnosis_sessions ds
    join public.workspace_members wm on wm.workspace_id = ds.workspace_id
    where ds.id = diagnosis_answers.diagnosis_session_id
      and wm.user_id = auth.uid()
  )
);

create policy "members can update workspace diagnosis answers"
on public.diagnosis_answers
for update
to authenticated
using (
  exists (
    select 1
    from public.diagnosis_sessions ds
    join public.workspace_members wm on wm.workspace_id = ds.workspace_id
    where ds.id = diagnosis_answers.diagnosis_session_id
      and wm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.diagnosis_sessions ds
    join public.workspace_members wm on wm.workspace_id = ds.workspace_id
    where ds.id = diagnosis_answers.diagnosis_session_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists "users can read own result snapshots" on public.result_snapshots;
drop policy if exists "users can create own result snapshots" on public.result_snapshots;

create policy "members can read workspace result snapshots"
on public.result_snapshots
for select
to authenticated
using (
  workspace_id in (
    select wm.workspace_id
    from public.workspace_members wm
    where wm.user_id = auth.uid()
  )
);

create policy "members can create workspace result snapshots"
on public.result_snapshots
for insert
to authenticated
with check (
  workspace_id in (
    select wm.workspace_id
    from public.workspace_members wm
    where wm.user_id = auth.uid()
  )
);

drop policy if exists "users can read own cases" on public.cases;
drop policy if exists "users can create own cases" on public.cases;
drop policy if exists "users can update own cases" on public.cases;

create policy "members can read workspace cases"
on public.cases
for select
to authenticated
using (
  workspace_id in (
    select wm.workspace_id
    from public.workspace_members wm
    where wm.user_id = auth.uid()
  )
);

create policy "members can create workspace cases"
on public.cases
for insert
to authenticated
with check (
  workspace_id in (
    select wm.workspace_id
    from public.workspace_members wm
    where wm.user_id = auth.uid()
  )
);

create policy "members can update workspace cases"
on public.cases
for update
to authenticated
using (
  workspace_id in (
    select wm.workspace_id
    from public.workspace_members wm
    where wm.user_id = auth.uid()
  )
)
with check (
  workspace_id in (
    select wm.workspace_id
    from public.workspace_members wm
    where wm.user_id = auth.uid()
  )
);

drop policy if exists "users can read own case messages" on public.case_messages;
drop policy if exists "users can create own case messages" on public.case_messages;

create policy "members can read workspace case messages"
on public.case_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.cases
    join public.workspace_members wm on wm.workspace_id = cases.workspace_id
    where cases.id = case_messages.case_id
      and wm.user_id = auth.uid()
  )
);

create policy "members can create workspace case messages"
on public.case_messages
for insert
to authenticated
with check (
  exists (
    select 1
    from public.cases
    join public.workspace_members wm on wm.workspace_id = cases.workspace_id
    where cases.id = case_messages.case_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists "users can read own case results" on public.case_results;
drop policy if exists "users can create own case results" on public.case_results;

create policy "members can read workspace case results"
on public.case_results
for select
to authenticated
using (
  exists (
    select 1
    from public.cases
    join public.workspace_members wm on wm.workspace_id = cases.workspace_id
    where cases.id = case_results.case_id
      and wm.user_id = auth.uid()
  )
);

create policy "members can create workspace case results"
on public.case_results
for insert
to authenticated
with check (
  exists (
    select 1
    from public.cases
    join public.workspace_members wm on wm.workspace_id = cases.workspace_id
    where cases.id = case_results.case_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists "users can read own case artifacts" on public.case_artifacts;
drop policy if exists "users can create own case artifacts" on public.case_artifacts;

create policy "members can read workspace case artifacts"
on public.case_artifacts
for select
to authenticated
using (
  exists (
    select 1
    from public.cases
    join public.workspace_members wm on wm.workspace_id = cases.workspace_id
    where cases.id = case_artifacts.case_id
      and wm.user_id = auth.uid()
  )
);

create policy "members can create workspace case artifacts"
on public.case_artifacts
for insert
to authenticated
with check (
  exists (
    select 1
    from public.cases
    join public.workspace_members wm on wm.workspace_id = cases.workspace_id
    where cases.id = case_artifacts.case_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists "users can read own case tool recommendations" on public.case_tool_recommendations;
drop policy if exists "users can create own case tool recommendations" on public.case_tool_recommendations;

create policy "members can read workspace case tool recommendations"
on public.case_tool_recommendations
for select
to authenticated
using (
  exists (
    select 1
    from public.cases
    join public.workspace_members wm on wm.workspace_id = cases.workspace_id
    where cases.id = case_tool_recommendations.case_id
      and wm.user_id = auth.uid()
  )
);

create policy "members can create workspace case tool recommendations"
on public.case_tool_recommendations
for insert
to authenticated
with check (
  exists (
    select 1
    from public.cases
    join public.workspace_members wm on wm.workspace_id = cases.workspace_id
    where cases.id = case_tool_recommendations.case_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists "users can read own company snapshots" on public.company_snapshots;
drop policy if exists "users can create own company snapshots" on public.company_snapshots;
drop policy if exists "users can update own company snapshots" on public.company_snapshots;

create policy "members can read workspace company snapshots"
on public.company_snapshots
for select
to authenticated
using (
  workspace_id in (
    select wm.workspace_id
    from public.workspace_members wm
    where wm.user_id = auth.uid()
  )
);

create policy "members can create workspace company snapshots"
on public.company_snapshots
for insert
to authenticated
with check (
  workspace_id in (
    select wm.workspace_id
    from public.workspace_members wm
    where wm.user_id = auth.uid()
  )
);

create policy "members can update workspace company snapshots"
on public.company_snapshots
for update
to authenticated
using (
  workspace_id in (
    select wm.workspace_id
    from public.workspace_members wm
    where wm.user_id = auth.uid()
  )
)
with check (
  workspace_id in (
    select wm.workspace_id
    from public.workspace_members wm
    where wm.user_id = auth.uid()
  )
);
