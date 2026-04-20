alter table public.cases
add column if not exists public_share_token text;

update public.cases
set public_share_token = encode(gen_random_bytes(18), 'hex')
where public_share_token is null;

alter table public.cases
alter column public_share_token set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cases_public_share_token_key'
      and conrelid = 'public.cases'::regclass
  ) then
    alter table public.cases
    add constraint cases_public_share_token_key unique (public_share_token);
  end if;
end;
$$;

create index if not exists cases_public_share_token_idx
  on public.cases(public_share_token);
