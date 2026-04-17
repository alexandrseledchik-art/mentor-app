alter table public.companies
drop constraint if exists companies_user_id_key;

alter table public.companies
drop constraint if exists companies_user_id_fkey;

alter table public.companies
add constraint companies_user_id_fkey
foreign key (user_id)
references public.users(id)
on delete cascade;

alter table public.companies
add column if not exists is_active boolean not null default false;

create index if not exists companies_user_id_idx
  on public.companies(user_id);

create index if not exists companies_user_id_is_active_idx
  on public.companies(user_id, is_active);
