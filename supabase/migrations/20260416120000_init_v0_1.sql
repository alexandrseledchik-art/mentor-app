create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null unique,
  telegram_username text,
  first_name text not null,
  last_name text,
  language_code text,
  photo_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  name text not null,
  industry text not null,
  team_size text not null,
  revenue_range text,
  description text,
  primary_goal text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.diagnosis_question_sets (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  version integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.diagnosis_questions (
  id uuid primary key default gen_random_uuid(),
  question_set_id uuid not null references public.diagnosis_question_sets(id) on delete cascade,
  code text not null unique,
  title text not null,
  description text,
  dimension text not null,
  position integer not null,
  input_type text not null default 'scale',
  is_required boolean not null default true,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.diagnosis_sessions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  question_set_id uuid not null references public.diagnosis_question_sets(id) on delete restrict,
  status text not null default 'in_progress',
  total_score integer,
  summary_key text,
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz
);

create table if not exists public.diagnosis_answers (
  id uuid primary key default gen_random_uuid(),
  diagnosis_session_id uuid not null references public.diagnosis_sessions(id) on delete cascade,
  question_id uuid not null references public.diagnosis_questions(id) on delete cascade,
  answer_value integer not null,
  answer_label text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (diagnosis_session_id, question_id)
);

create table if not exists public.tool_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  position integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.tools (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.tool_categories(id) on delete restrict,
  slug text not null unique,
  title text not null,
  summary text not null,
  problem text,
  format text not null,
  stage text,
  estimated_minutes integer,
  is_featured boolean not null default false,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists diagnosis_questions_question_set_id_position_idx
  on public.diagnosis_questions(question_set_id, position);

create index if not exists diagnosis_sessions_company_id_created_at_idx
  on public.diagnosis_sessions(company_id, created_at desc);

create index if not exists diagnosis_answers_session_id_idx
  on public.diagnosis_answers(diagnosis_session_id);

create index if not exists tools_category_id_idx
  on public.tools(category_id);

create trigger set_users_updated_at
before update on public.users
for each row
execute function public.set_updated_at();

create trigger set_companies_updated_at
before update on public.companies
for each row
execute function public.set_updated_at();

alter table public.users enable row level security;
alter table public.companies enable row level security;
alter table public.diagnosis_question_sets enable row level security;
alter table public.diagnosis_questions enable row level security;
alter table public.diagnosis_sessions enable row level security;
alter table public.diagnosis_answers enable row level security;
alter table public.tool_categories enable row level security;
alter table public.tools enable row level security;

create policy "question sets are readable by authenticated users"
on public.diagnosis_question_sets
for select
to authenticated
using (true);

create policy "questions are readable by authenticated users"
on public.diagnosis_questions
for select
to authenticated
using (true);

create policy "tool categories are readable by authenticated users"
on public.tool_categories
for select
to authenticated
using (true);

create policy "tools are readable by authenticated users"
on public.tools
for select
to authenticated
using (true);

insert into public.diagnosis_question_sets (code, title, version, is_active)
values ('express_v1', 'Express Diagnosis', 1, true)
on conflict (code) do update
set title = excluded.title,
    version = excluded.version,
    is_active = excluded.is_active;

with question_set as (
  select id from public.diagnosis_question_sets where code = 'express_v1'
)
insert into public.diagnosis_questions (
  question_set_id,
  code,
  title,
  description,
  dimension,
  position,
  input_type,
  is_required,
  meta
)
select
  question_set.id,
  seed.code,
  seed.title,
  seed.description,
  seed.dimension,
  seed.position,
  'scale',
  true,
  jsonb_build_object(
    'min', 1,
    'max', 5,
    'minLabel', 'Слабо',
    'maxLabel', 'Сильно'
  )
from question_set
cross join (
  values
    ('sales_process', 'Насколько предсказуемо у вас работают продажи?', 'Есть ли стабильный поток лидов и понятная конверсия по воронке.', 'sales', 1),
    ('marketing_channel', 'Насколько стабилен основной канал привлечения?', 'Понимаете ли вы, откуда регулярно приходят клиенты.', 'marketing', 2),
    ('unit_economics', 'Насколько вам понятна экономика сделки?', 'Знаете ли вы маржу, CAC и окупаемость каналов.', 'finance', 3),
    ('operational_control', 'Насколько управляемы внутренние процессы?', 'Есть ли регламенты, роли и контроль выполнения задач.', 'operations', 4),
    ('team_focus', 'Насколько команда сфокусирована на одном приоритете?', 'Есть ли единая цель на ближайший цикл.', 'team', 5),
    ('product_value', 'Насколько четко сформулирована ценность продукта?', 'Понимают ли клиенты, за что они платят.', 'product', 6),
    ('customer_feedback', 'Насколько регулярно вы собираете обратную связь?', 'Есть ли системный цикл интервью, отзывов или аналитики.', 'product', 7),
    ('cash_visibility', 'Насколько прозрачен ваш денежный поток на 2-3 месяца?', 'Понимаете ли вы кассовые риски заранее.', 'finance', 8)
) as seed(code, title, description, dimension, position)
on conflict (code) do update
set title = excluded.title,
    description = excluded.description,
    dimension = excluded.dimension,
    position = excluded.position,
    meta = excluded.meta;

insert into public.tool_categories (slug, name, description, position)
values
  ('sales', 'Продажи', 'Инструменты для воронки, офферов и конверсии.', 1),
  ('marketing', 'Маркетинг', 'Шаблоны и чеклисты для привлечения спроса.', 2),
  ('operations', 'Операции', 'Практики для процессов, ролей и управляемости.', 3),
  ('finance', 'Финансы', 'Базовые инструменты для экономики и cash flow.', 4)
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    position = excluded.position;

with categories as (
  select id, slug from public.tool_categories
)
insert into public.tools (
  category_id,
  slug,
  title,
  summary,
  problem,
  format,
  stage,
  estimated_minutes,
  is_featured,
  content
)
select
  categories.id,
  seed.slug,
  seed.title,
  seed.summary,
  seed.problem,
  seed.format,
  seed.stage,
  seed.estimated_minutes,
  seed.is_featured,
  seed.content::jsonb
from categories
join (
  values
    (
      'sales',
      'sales-funnel-audit',
      'Аудит воронки продаж',
      'Быстрая проверка этапов воронки и узких мест конверсии.',
      'Непонятно, где именно теряются лиды и сделки.',
      'checklist',
      'early',
      15,
      true,
      '{
        "sections": [
          {"title": "Лиды", "items": ["Есть ли единое место учета лидов?", "Понятен ли источник каждого лида?"]},
          {"title": "Конверсия", "items": ["Замеряете ли вы переходы между этапами?", "Известно ли главное узкое место?"]}
        ]
      }'
    ),
    (
      'sales',
      'offer-clarity-template',
      'Шаблон проверки оффера',
      'Помогает быстро уточнить ценность продукта и аргументы для клиента.',
      'Клиенты не понимают, почему должны выбрать вас.',
      'template',
      'early',
      20,
      false,
      '{
        "fields": [
          "Для кого продукт",
          "Какую проблему решает",
          "Почему это важно сейчас",
          "Почему лучше альтернатив"
        ]
      }'
    ),
    (
      'marketing',
      'channel-stability-check',
      'Проверка устойчивости канала',
      'Чеклист для оценки зависимости от одного источника трафика.',
      'Бизнес зависит от одного канала и не понимает риски.',
      'checklist',
      'early',
      10,
      true,
      '{
        "items": [
          "Назван основной канал роста",
          "Понятна доля лидов из него",
          "Есть резервный канал",
          "Есть критерии отключения неэффективного канала"
        ]
      }'
    ),
    (
      'marketing',
      'customer-interview-guide',
      'Гайд по интервью с клиентами',
      'Список вопросов для быстрых проблемных интервью.',
      'Команда строит продукт без свежей обратной связи клиентов.',
      'guide',
      'early',
      25,
      false,
      '{
        "questions": [
          "Как вы сейчас решаете эту задачу?",
          "Что в текущем решении неудобно?",
          "Когда проблема проявляется сильнее всего?",
          "Что было бы для вас идеальным результатом?"
        ]
      }'
    ),
    (
      'operations',
      'weekly-priority-board',
      'Еженедельный board приоритетов',
      'Простой шаблон для фиксации главного фокуса команды на неделю.',
      'Команда распыляется и тянет слишком много задач одновременно.',
      'template',
      'early',
      15,
      true,
      '{
        "columns": [
          "Главный приоритет",
          "Ключевые задачи",
          "Блокеры",
          "Ответственный",
          "Статус"
        ]
      }'
    ),
    (
      'operations',
      'role-clarity-checklist',
      'Чеклист ролей и ответственности',
      'Проверка, насколько команда понимает зоны ответственности.',
      'Задачи теряются между сотрудниками и нет понятного владельца.',
      'checklist',
      'growth',
      15,
      false,
      '{
        "items": [
          "У каждой регулярной функции есть владелец",
          "Есть список решений, которые принимает владелец",
          "Команда знает, к кому идти по каждому вопросу"
        ]
      }'
    ),
    (
      'finance',
      'unit-economics-sheet',
      'Шаблон юнит-экономики',
      'Минимальный набор полей для расчета выручки, маржи и CAC.',
      'Бизнес растет, но не понимает, какие клиенты на самом деле прибыльны.',
      'calculator',
      'growth',
      20,
      true,
      '{
        "fields": [
          "Средний чек",
          "Валовая маржа",
          "CAC",
          "Повторные покупки",
          "Срок окупаемости"
        ]
      }'
    ),
    (
      'finance',
      'cash-gap-check',
      'Проверка кассового разрыва',
      'Короткий сценарий оценки входящих и исходящих платежей.',
      'Есть риск кассового разрыва, но нет простого контроля горизонта.',
      'checklist',
      'growth',
      10,
      false,
      '{
        "items": [
          "Есть план поступлений на 8 недель",
          "Есть план обязательных выплат",
          "Понятен минимальный остаток на счете",
          "Есть триггер для антикризисных действий"
        ]
      }'
    )
) as seed(category_slug, slug, title, summary, problem, format, stage, estimated_minutes, is_featured, content)
  on categories.slug = seed.category_slug
on conflict (slug) do update
set category_id = excluded.category_id,
    title = excluded.title,
    summary = excluded.summary,
    problem = excluded.problem,
    format = excluded.format,
    stage = excluded.stage,
    estimated_minutes = excluded.estimated_minutes,
    is_featured = excluded.is_featured,
    content = excluded.content;
