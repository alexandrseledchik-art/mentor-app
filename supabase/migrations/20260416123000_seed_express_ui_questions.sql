alter table public.diagnosis_question_sets
add column if not exists description text;

alter table public.diagnosis_questions
add column if not exists question_text text;

alter table public.diagnosis_questions
add column if not exists options jsonb not null default '[]'::jsonb;

alter table public.diagnosis_questions
add column if not exists weight integer not null default 1;

alter table public.diagnosis_questions
add column if not exists order_index integer;

update public.diagnosis_questions
set
  question_text = coalesce(question_text, title),
  order_index = coalesce(order_index, position)
where question_text is null
   or order_index is null;

insert into public.diagnosis_question_sets (
  code,
  title,
  description,
  version,
  is_active
)
values (
  'express_v1',
  'Экспресс диагностика',
  'Быстрая оценка состояния бизнеса',
  1,
  true
)
on conflict (code) do nothing;

with question_set as (
  select id
  from public.diagnosis_question_sets
  where code = 'express_v1'
)
insert into public.diagnosis_questions (
  question_set_id,
  code,
  title,
  question_text,
  dimension,
  position,
  order_index,
  input_type,
  is_required,
  options,
  weight,
  meta
)
select
  question_set.id,
  seed.code,
  seed.question_text,
  seed.question_text,
  seed.dimension,
  seed.order_index,
  seed.order_index,
  'single_select',
  true,
  seed.options,
  seed.weight,
  jsonb_build_object('source', 'express_ui_v1')
from question_set
cross join (
  values
    (
      'owner_contour',
      'Контур собственника',
      'owner',
      1,
      '[
        {"value": 1, "label": "Собственники часто меняют курс, и команда не понимает приоритеты."},
        {"value": 2, "label": "Цели есть в голове, но редко проговариваются и фиксируются."},
        {"value": 3, "label": "Команда в целом понимает цели владельцев и рамки решений."},
        {"value": 4, "label": "Цели собственников регулярно обновляются и учитываются в важных решениях."},
        {"value": 5, "label": "Всем понятны цели владельцев, поэтому решения принимаются быстро и спокойно."}
      ]'::jsonb,
      1
    ),
    (
      'external_environment_ecosystem',
      'Внешняя среда и экосистема',
      'external_environment',
      2,
      '[
        {"value": 1, "label": "Компания замечает изменения на рынке слишком поздно."},
        {"value": 2, "label": "За рынком следят время от времени, но без общей системы."},
        {"value": 3, "label": "Команда понимает главные внешние факторы и учитывает их в решениях."},
        {"value": 4, "label": "Изменения рынка регулярно обсуждаются, угрозы и возможности видны заранее."},
        {"value": 5, "label": "Компания хорошо чувствует рынок и вовремя подстраивается под него."}
      ]'::jsonb,
      1
    ),
    (
      'strategy',
      'Стратегия',
      'strategy',
      3,
      '[
        {"value": 1, "label": "Общего направления нет, и бизнес постоянно дергается в стороны."},
        {"value": 2, "label": "Есть общие идеи роста, но без четких выборов и фокуса."},
        {"value": 3, "label": "Основное направление уже описано, но еще не везде работает."},
        {"value": 4, "label": "Ключевые решения сверяются со стратегией, лишние идеи отсеиваются."},
        {"value": 5, "label": "Стратегию понимают все, и компания держит курс даже в изменениях."}
      ]'::jsonb,
      1
    ),
    (
      'product',
      'Продукт',
      'product',
      4,
      '[
        {"value": 1, "label": "Продукт меняется хаотично, и ценность для клиента неясна."},
        {"value": 2, "label": "Команда примерно понимает продукт, но не описывает его системно."},
        {"value": 3, "label": "Продукт и его ценность уже описаны, есть базовые метрики."},
        {"value": 4, "label": "Продукт улучшают по данным клиентов и бизнес-целям."},
        {"value": 5, "label": "Продукт дает сильное преимущество и постоянно становится лучше."}
      ]'::jsonb,
      1
    ),
    (
      'commercial',
      'Коммерция',
      'commercial',
      5,
      '[
        {"value": 1, "label": "Продажи случайны, и выручка сильно скачет."},
        {"value": 2, "label": "Продажи есть, но маркетинг и воронка работают несвязно."},
        {"value": 3, "label": "Привлечение, продажи и удержание уже работают как единый цикл."},
        {"value": 4, "label": "Коммерческие решения принимаются по цифрам, а не по ощущениям."},
        {"value": 5, "label": "Продажи работают как сильная система и дают предсказуемый рост."}
      ]'::jsonb,
      1
    ),
    (
      'operations',
      'Операции',
      'operations',
      6,
      '[
        {"value": 1, "label": "Каждый работает по-своему, и проблемы тушатся уже по факту."},
        {"value": 2, "label": "Полезные практики есть, но они разрознены и нестабильны."},
        {"value": 3, "label": "Основные процессы описаны, замеряются и планируются заранее."},
        {"value": 4, "label": "Операции управляются по метрикам, а улучшения идут системно."},
        {"value": 5, "label": "Процессы сами улучшаются, а команда заранее видит проблемы."}
      ]'::jsonb,
      1
    ),
    (
      'finance',
      'Финансы',
      'finance',
      7,
      '[
        {"value": 1, "label": "Деньги заканчиваются неожиданно, и реальная прибыль непонятна."},
        {"value": 2, "label": "Базовый учет есть, но решений по цифрам почти нет."},
        {"value": 3, "label": "Есть бюджет, отчеты и прогноз денег на ближайший период."},
        {"value": 4, "label": "Финансы помогают управлять бизнесом, а не только считать итог."},
        {"value": 5, "label": "Компания хорошо понимает деньги и вкладывает их в рост."}
      ]'::jsonb,
      1
    ),
    (
      'team',
      'Команда',
      'team',
      8,
      '[
        {"value": 1, "label": "Найм и увольнения происходят стихийно, без понятной системы."},
        {"value": 2, "label": "Кадровые задачи закрываются, но развитием команды почти не занимаются."},
        {"value": 3, "label": "Найм, адаптация и оценка команды уже выстроены базово."},
        {"value": 4, "label": "Решения по людям принимаются по данным и регулярным правилам."},
        {"value": 5, "label": "Сильная команда дает бизнесу заметное преимущество на рынке."}
      ]'::jsonb,
      1
    ),
    (
      'governance_risk',
      'Управление и риски',
      'governance',
      9,
      '[
        {"value": 1, "label": "Решения принимаются хаотично, а риски замечают слишком поздно."},
        {"value": 2, "label": "Отдельные управленческие практики есть, но они не связаны."},
        {"value": 3, "label": "Есть регулярное управление, отчеты и базовый контроль рисков."},
        {"value": 4, "label": "Планы, факты и риски регулярно сверяются и ведут к решениям."},
        {"value": 5, "label": "Компания быстро управляет изменениями и заранее видит отклонения."}
      ]'::jsonb,
      1
    ),
    (
      'technology',
      'Технологии',
      'technology',
      10,
      '[
        {"value": 1, "label": "Системы разрознены, дублируются и мешают нормальной работе."},
        {"value": 2, "label": "Отдельные решения есть, но общей картины по технологиям нет."},
        {"value": 3, "label": "Основные системы и ответственность уже описаны и упорядочены."},
        {"value": 4, "label": "Технологии развиваются по правилам и поддерживают цели бизнеса."},
        {"value": 5, "label": "Технологии помогают компании быстрее расти и сильнее масштабироваться."}
      ]'::jsonb,
      1
    ),
    (
      'data_analytics',
      'Данные и аналитика',
      'data',
      11,
      '[
        {"value": 1, "label": "Данные разбросаны, и у каждого своя версия правды."},
        {"value": 2, "label": "Отчеты есть, но общей системы работы с данными нет."},
        {"value": 3, "label": "Ключевые данные и отчеты собраны в базовый общий контур."},
        {"value": 4, "label": "Данные регулярно используются в управлении и принятии решений."},
        {"value": 5, "label": "Данные дают компании сильное преимущество и новые возможности роста."}
      ]'::jsonb,
      1
    )
) as seed(code, question_text, dimension, order_index, options, weight)
on conflict (code) do nothing;
