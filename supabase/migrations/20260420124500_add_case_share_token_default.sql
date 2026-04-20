alter table public.cases
alter column public_share_token set default encode(gen_random_bytes(18), 'hex');
