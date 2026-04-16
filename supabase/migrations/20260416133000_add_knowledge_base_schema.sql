create table if not exists public.symptoms (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  section text not null,
  reason text
);

create table if not exists public.symptom_tool_map (
  id uuid primary key default gen_random_uuid(),
  symptom_id uuid not null references public.symptoms(id) on delete cascade,
  tool_id uuid not null references public.tools(id) on delete cascade,
  priority integer not null default 1
);

create index if not exists symptom_tool_map_symptom_id_idx
  on public.symptom_tool_map(symptom_id);

create index if not exists symptom_tool_map_tool_id_idx
  on public.symptom_tool_map(tool_id);

create unique index if not exists symptom_tool_map_symptom_id_tool_id_key
  on public.symptom_tool_map(symptom_id, tool_id);
