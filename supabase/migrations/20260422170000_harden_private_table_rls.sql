alter table public.analytics_events enable row level security;
alter table public.entry_sessions enable row level security;
alter table public.result_snapshots enable row level security;
alter table public.symptoms enable row level security;
alter table public.symptom_tool_map enable row level security;
alter table public.tool_demand_signals enable row level security;

drop policy if exists "users can read own profile" on public.users;
create policy "users can read own profile"
on public.users
for select
to authenticated
using (id = auth.uid());

drop policy if exists "users can update own profile" on public.users;
create policy "users can update own profile"
on public.users
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "users can read own companies" on public.companies;
create policy "users can read own companies"
on public.companies
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "users can create own companies" on public.companies;
create policy "users can create own companies"
on public.companies
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "users can update own companies" on public.companies;
create policy "users can update own companies"
on public.companies
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "users can read own workspaces" on public.workspaces;
create policy "users can read own workspaces"
on public.workspaces
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "users can create own workspaces" on public.workspaces;
create policy "users can create own workspaces"
on public.workspaces
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "users can update own workspaces" on public.workspaces;
create policy "users can update own workspaces"
on public.workspaces
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "users can read own diagnosis sessions" on public.diagnosis_sessions;
create policy "users can read own diagnosis sessions"
on public.diagnosis_sessions
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.companies
    where companies.id = diagnosis_sessions.company_id
      and companies.user_id = auth.uid()
  )
);

drop policy if exists "users can create own diagnosis sessions" on public.diagnosis_sessions;
create policy "users can create own diagnosis sessions"
on public.diagnosis_sessions
for insert
to authenticated
with check (
  user_id = auth.uid()
  or exists (
    select 1
    from public.companies
    where companies.id = diagnosis_sessions.company_id
      and companies.user_id = auth.uid()
  )
);

drop policy if exists "users can update own diagnosis sessions" on public.diagnosis_sessions;
create policy "users can update own diagnosis sessions"
on public.diagnosis_sessions
for update
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.companies
    where companies.id = diagnosis_sessions.company_id
      and companies.user_id = auth.uid()
  )
)
with check (
  user_id = auth.uid()
  or exists (
    select 1
    from public.companies
    where companies.id = diagnosis_sessions.company_id
      and companies.user_id = auth.uid()
  )
);

drop policy if exists "users can read own diagnosis answers" on public.diagnosis_answers;
create policy "users can read own diagnosis answers"
on public.diagnosis_answers
for select
to authenticated
using (
  exists (
    select 1
    from public.diagnosis_sessions
    where diagnosis_sessions.id = diagnosis_answers.diagnosis_session_id
      and diagnosis_sessions.user_id = auth.uid()
  )
);

drop policy if exists "users can create own diagnosis answers" on public.diagnosis_answers;
create policy "users can create own diagnosis answers"
on public.diagnosis_answers
for insert
to authenticated
with check (
  exists (
    select 1
    from public.diagnosis_sessions
    where diagnosis_sessions.id = diagnosis_answers.diagnosis_session_id
      and diagnosis_sessions.user_id = auth.uid()
  )
);

drop policy if exists "users can update own diagnosis answers" on public.diagnosis_answers;
create policy "users can update own diagnosis answers"
on public.diagnosis_answers
for update
to authenticated
using (
  exists (
    select 1
    from public.diagnosis_sessions
    where diagnosis_sessions.id = diagnosis_answers.diagnosis_session_id
      and diagnosis_sessions.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.diagnosis_sessions
    where diagnosis_sessions.id = diagnosis_answers.diagnosis_session_id
      and diagnosis_sessions.user_id = auth.uid()
  )
);

drop policy if exists "users can read own result snapshots" on public.result_snapshots;
create policy "users can read own result snapshots"
on public.result_snapshots
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "users can create own result snapshots" on public.result_snapshots;
create policy "users can create own result snapshots"
on public.result_snapshots
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "users can read own cases" on public.cases;
create policy "users can read own cases"
on public.cases
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "users can create own cases" on public.cases;
create policy "users can create own cases"
on public.cases
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "users can update own cases" on public.cases;
create policy "users can update own cases"
on public.cases
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "users can read own case messages" on public.case_messages;
create policy "users can read own case messages"
on public.case_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.cases
    where cases.id = case_messages.case_id
      and cases.user_id = auth.uid()
  )
);

drop policy if exists "users can create own case messages" on public.case_messages;
create policy "users can create own case messages"
on public.case_messages
for insert
to authenticated
with check (
  exists (
    select 1
    from public.cases
    where cases.id = case_messages.case_id
      and cases.user_id = auth.uid()
  )
);

drop policy if exists "users can read own case results" on public.case_results;
create policy "users can read own case results"
on public.case_results
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "users can create own case results" on public.case_results;
create policy "users can create own case results"
on public.case_results
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "users can read own case artifacts" on public.case_artifacts;
create policy "users can read own case artifacts"
on public.case_artifacts
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "users can create own case artifacts" on public.case_artifacts;
create policy "users can create own case artifacts"
on public.case_artifacts
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "users can read own case tool recommendations" on public.case_tool_recommendations;
create policy "users can read own case tool recommendations"
on public.case_tool_recommendations
for select
to authenticated
using (
  exists (
    select 1
    from public.cases
    where cases.id = case_tool_recommendations.case_id
      and cases.user_id = auth.uid()
  )
);

drop policy if exists "users can create own case tool recommendations" on public.case_tool_recommendations;
create policy "users can create own case tool recommendations"
on public.case_tool_recommendations
for insert
to authenticated
with check (
  exists (
    select 1
    from public.cases
    where cases.id = case_tool_recommendations.case_id
      and cases.user_id = auth.uid()
  )
);

drop policy if exists "users can read own company snapshots" on public.company_snapshots;
create policy "users can read own company snapshots"
on public.company_snapshots
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "users can create own company snapshots" on public.company_snapshots;
create policy "users can create own company snapshots"
on public.company_snapshots
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "users can update own company snapshots" on public.company_snapshots;
create policy "users can update own company snapshots"
on public.company_snapshots
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "symptoms are readable by authenticated users" on public.symptoms;
create policy "symptoms are readable by authenticated users"
on public.symptoms
for select
to authenticated
using (true);

drop policy if exists "symptom tool map is readable by authenticated users" on public.symptom_tool_map;
create policy "symptom tool map is readable by authenticated users"
on public.symptom_tool_map
for select
to authenticated
using (true);
