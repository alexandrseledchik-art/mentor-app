alter table public.companies
add column if not exists user_id uuid;

alter table public.companies
add column if not exists name text;

alter table public.companies
add column if not exists industry text;

alter table public.companies
add column if not exists team_size text;

alter table public.companies
add column if not exists revenue_range text;

alter table public.companies
add column if not exists primary_goal text;

alter table public.companies
add column if not exists onboarding_completed boolean not null default false;

alter table public.companies
drop constraint if exists companies_user_id_fkey;

alter table public.companies
add constraint companies_user_id_fkey
foreign key (user_id)
references auth.users(id)
on delete cascade;
