import test from "node:test";
import assert from "node:assert/strict";

import { classifyHeuristicBundle } from "@/lib/recommendations/bundles";
import { resolveCanonicalRecommendation } from "@/lib/recommendations/canonical";
import { buildHybridRecommendation } from "@/lib/recommendations/orchestrate";

import type {
  BusinessArchitectureSource,
  RecommendationContext,
} from "@/lib/recommendations/types";

function createContext(params: {
  mode?: RecommendationContext["mode"];
  selectedPath?: string;
  scores?: Partial<RecommendationContext["scores"]>;
  mainFocus?: string;
} = {}): RecommendationContext {
  return {
    mode: params.mode ?? "growth",
    selectedPath: params.selectedPath ?? "sales",
    company: {
      name: "Acme",
      industry: "E-commerce",
      teamSize: "21-50 человек",
      revenue: "1-5 млн ₽",
      goal: "Прибыль",
    },
    scores: {
      owner: 3,
      market: 3,
      strategy: 3,
      product: 3,
      sales: 3,
      operations: 3,
      finance: 3,
      team: 3,
      management: 3,
      tech: 3,
      data: 3,
      ...params.scores,
    },
    summary: {
      main_summary: "Система пока держится на ручном управлении.",
      main_focus: params.mainFocus ?? "Сначала выровняйте контур «Роль собственника».",
      why_now: [
        "Причина 1 → эффект 1.",
        "Причина 2 → эффект 2.",
        "Причина 3 → эффект 3.",
      ],
      strengths: ["Опора 1", "Опора 2"],
      first_steps: ["Шаг 1", "Шаг 2", "Шаг 3"],
    },
  };
}

function createSource(): BusinessArchitectureSource {
  return {
    framework: {
      entities: [],
      transformation_entities: [],
    },
    knowledge: {
      tools: [
        {
          id: "tool-sales-audit",
          title_ru: "Аудит системы продаж",
          description_ru: "Диагностика текущей системы продаж",
          when_to_apply_ru: "Когда продажи стагнируют",
          result_ru: "Карта проблем в продажах",
          section_ru: "МАРШРУТ Г",
        },
        {
          id: "tool-owner-audit",
          title_ru: "Аудит роли собственника",
          description_ru: "Разбор роли собственника",
          when_to_apply_ru: "Когда собственник перегружен",
          result_ru: "Карта перегруза собственника",
          section_ru: "МАРШРУТ Д",
        },
        {
          id: "tool-ansoff",
          title_ru: "Ansoff / Blue Ocean",
          description_ru: "Выбор вектора роста",
          when_to_apply_ru: "Когда нужен стратегический фокус",
          result_ru: "Обоснованный приоритет роста",
          section_ru: "МАРШРУТ Б",
        },
        {
          id: "tool-okr",
          title_ru: "OKR / KPI",
          description_ru: "Система целей и ритма управления",
          when_to_apply_ru: "Когда нужен управленческий ритм",
          result_ru: "KPI у каждого руководителя",
          section_ru: "МАРШРУТ В",
        },
      ],
      symptom_tool_map: [],
    },
    product: {
      navigator_tasks: [
        {
          id: "task-growth",
          section_ru: "Рост",
          task_ru: "Разобрать ограничение роста продаж",
          tools_sequence_ru: "Аудит -> Воронка",
          when_to_apply_ru: "Когда рост замедляется",
          expected_result_ru: "Понятно, где теряется выручка",
        },
      ],
      route_steps: [
        {
          id: "route-g-1",
          route_ru: "МАРШРУТ Г — «Продажи стагнируют, нужен рост выручки»",
          route_description_ru: "Рост выручки",
          step_code: "1.0",
          tool_ru: "PESTEL + Анализ конкурентов",
          step_goal_ru: "Проверить внешние факторы",
          step_result_ru: "Понять есть ли рыночные ограничения",
        },
        {
          id: "route-g-2",
          route_ru: "МАРШРУТ Г — «Продажи стагнируют, нужен рост выручки»",
          route_description_ru: "Рост выручки",
          step_code: "2.0",
          tool_ru: "Аудит системы продаж",
          step_goal_ru: "Диагностировать текущую систему",
          step_result_ru: "Карта проблем в продажах",
        },
        {
          id: "route-g-3",
          route_ru: "МАРШРУТ Г — «Продажи стагнируют, нужен рост выручки»",
          route_description_ru: "Рост выручки",
          step_code: "3.0",
          tool_ru: "Воронка продаж + конверсии",
          step_goal_ru: "Найти где теряются клиенты",
          step_result_ru: "Конверсии на каждом этапе",
        },
        {
          id: "route-b-6",
          route_ru: "МАРШРУТ Б — «Хочу разработать стратегию компании»",
          route_description_ru: "Стратегия",
          step_code: "6.0",
          tool_ru: "Ansoff / Blue Ocean",
          step_goal_ru: "Выбрать вектор роста",
          step_result_ru: "Обоснованный приоритет роста",
        },
        {
          id: "route-b-8",
          route_ru: "МАРШРУТ Б — «Хочу разработать стратегию компании»",
          route_description_ru: "Стратегия",
          step_code: "8.0",
          tool_ru: "Стратегическая сессия",
          step_goal_ru: "Согласовать стратегию с командой",
          step_result_ru: "Зафиксированная и разделяемая стратегия",
        },
        {
          id: "route-v-4",
          route_ru: "МАРШРУТ В — «Компания растёт, теряем управляемость»",
          route_description_ru: "Управляемость",
          step_code: "4.0",
          tool_ru: "Диагностика оргструктуры + RACI",
          step_goal_ru: "Увидеть структуру и ответственность as-is",
          step_result_ru: "Органиграмма с зонами хаоса",
        },
        {
          id: "route-v-8",
          route_ru: "МАРШРУТ В — «Компания растёт, теряем управляемость»",
          route_description_ru: "Управляемость",
          step_code: "8.0",
          tool_ru: "OKR / KPI",
          step_goal_ru: "Выстроить систему целей",
          step_result_ru: "KPI у каждого руководителя",
        },
        {
          id: "route-d-1",
          route_ru: "МАРШРУТ Д — «Хочу выйти из операционки»",
          route_description_ru: "Выход из операционки",
          step_code: "1.0",
          tool_ru: "Аудит роли собственника",
          step_goal_ru: "Понять текущую ситуацию",
          step_result_ru: "Карта где сейчас тратится время",
        },
        {
          id: "route-d-5",
          route_ru: "МАРШРУТ Д — «Хочу выйти из операционки»",
          route_description_ru: "Выход из операционки",
          step_code: "5.0",
          tool_ru: "Матрица полномочий",
          step_goal_ru: "Поэтапно передать решения",
          step_result_ru: "План делегирования по уровням",
        },
      ],
    },
  };
}

test("bundle classifier: owner + management -> owner_governance", () => {
  const result = classifyHeuristicBundle(
    createContext({
      scores: { owner: 1, management: 1, sales: 4 },
      mainFocus: "Сначала выровняйте контур «Роль собственника».",
    }),
  );

  assert.equal(result.bundle, "owner_governance");
});

test("bundle classifier: sales + product -> commercial_product", () => {
  const result = classifyHeuristicBundle(
    createContext({
      scores: { sales: 1, product: 1, owner: 4 },
      mainFocus: "Сначала выровняйте продукт и продажи.",
    }),
  );

  assert.equal(result.bundle, "commercial_product");
});

test("bundle classifier: operations + management -> operations_governance", () => {
  const result = classifyHeuristicBundle(
    createContext({
      scores: { operations: 1, management: 1, owner: 4 },
      mainFocus: "Сначала соберите регулярное управление.",
    }),
  );

  assert.equal(result.bundle, "operations_governance");
});

test("bundle classifier: strategy + market -> strategy_market", () => {
  const result = classifyHeuristicBundle(
    createContext({
      scores: { strategy: 1, market: 1, sales: 4 },
      mainFocus: "Сначала соберите стратегический фокус.",
    }),
  );

  assert.equal(result.bundle, "strategy_market");
});

test("bundle classifier: tie-case -> mixed", () => {
  const result = classifyHeuristicBundle(
    createContext({
      scores: { owner: 1, sales: 1, strategy: 4 },
      mainFocus: "Сначала определите одно главное ограничение.",
    }),
  );

  assert.equal(result.bundle, "mixed");
});

test("canonical resolver: growth / sales / commercial_product", () => {
  const result = resolveCanonicalRecommendation({
    source: createSource(),
    ctx: createContext({
      mode: "growth",
      selectedPath: "sales",
      scores: { sales: 1, product: 1, owner: 4 },
      mainFocus: "Сначала выровняйте продажи.",
    }),
  });

  assert.equal(result.trace.bundle, "commercial_product");
  assert.equal(result.recommendation?.canonicalRef?.entityType, "route_step");
  assert.equal(result.recommendation?.canonicalRef?.entityId, "route-g-2");
});

test("canonical resolver: growth / sales / owner_governance", () => {
  const result = resolveCanonicalRecommendation({
    source: createSource(),
    ctx: createContext({
      mode: "growth",
      selectedPath: "sales",
      scores: { owner: 1, management: 1, sales: 3 },
      mainFocus: "Сначала выровняйте контур «Роль собственника».",
    }),
  });

  assert.equal(result.trace.bundle, "owner_governance");
  assert.equal(result.recommendation?.canonicalRef?.entityId, "route-d-5");
});

test("canonical resolver: risk / growth_slowdown / strategy_market", () => {
  const result = resolveCanonicalRecommendation({
    source: createSource(),
    ctx: createContext({
      mode: "risk",
      selectedPath: "growth_slowdown",
      scores: { strategy: 1, market: 1, owner: 4 },
      mainFocus: "Сначала соберите стратегический фокус.",
    }),
  });

  assert.equal(result.trace.bundle, "strategy_market");
  assert.equal(result.recommendation?.canonicalRef?.entityId, "route-g-1");
});

test("canonical resolver: start / strategy / strategy_market", () => {
  const result = resolveCanonicalRecommendation({
    source: createSource(),
    ctx: createContext({
      mode: "start",
      selectedPath: "strategy",
      scores: { strategy: 1, market: 1, owner: 4 },
      mainFocus: "Сначала соберите стратегический фокус.",
    }),
  });

  assert.equal(result.trace.bundle, "strategy_market");
  assert.equal(result.recommendation?.canonicalRef?.entityId, "route-b-6");
});

test("canonical resolver: start / cadence / operations_governance", () => {
  const result = resolveCanonicalRecommendation({
    source: createSource(),
    ctx: createContext({
      mode: "start",
      selectedPath: "cadence",
      scores: { operations: 1, management: 1, strategy: 4 },
      mainFocus: "Сначала соберите регулярное управление.",
    }),
  });

  assert.equal(result.trace.bundle, "operations_governance");
  assert.equal(result.recommendation?.canonicalRef?.entityId, "route-v-8");
});

test("fallback: unknown selectedPath", async () => {
  const events: Array<{ event: string }> = [];
  const result = await buildHybridRecommendation(
    createContext({
      mode: "growth",
      selectedPath: "unknown_path",
    }),
    {
      getSource: async () => createSource(),
      logEvent: (event, payload) => {
        events.push({ event, ...(payload as object) } as { event: string });
      },
    },
  );

  assert.equal(result.fallbackRequired, true);
  assert.equal(result.fallbackReason, "canonical_resolution_failed");
  assert.equal(events.some((item) => item.event === "canonical_resolution_failed"), true);
});

test("fallback: missing canonical entity", async () => {
  const source = createSource();
  source.product.route_steps = [];
  source.product.navigator_tasks = [];
  source.knowledge.tools = [];

  const result = await buildHybridRecommendation(
    createContext({
      mode: "growth",
      selectedPath: "sales",
      scores: { sales: 1, product: 1 },
      mainFocus: "Сначала выровняйте продажи.",
    }),
    {
      getSource: async () => source,
      logEvent: () => undefined,
    },
  );

  assert.equal(result.fallbackRequired, true);
  assert.equal(result.fallbackReason, "canonical_resolution_failed");
});

test("fallback: source load failure", async () => {
  const result = await buildHybridRecommendation(createContext(), {
    getSource: async () => {
      throw new Error("boom");
    },
    logEvent: () => undefined,
  });

  assert.equal(result.fallbackRequired, true);
  assert.equal(result.fallbackReason, "source_or_orchestration_failure");
});

test("phase 2A: includes intermediate_step for growth / sales / owner_governance", async () => {
  const result = await buildHybridRecommendation(
    createContext({
      mode: "growth",
      selectedPath: "sales",
      scores: { owner: 1, management: 1, sales: 3 },
      mainFocus: "Сначала выровняйте контур «Роль собственника».",
    }),
    {
      getSource: async () => createSource(),
      logEvent: () => undefined,
    },
  );

  assert.equal(result.hybridRecommendation?.composition, "canonical_plus_inferred");
  assert.equal(result.hybridRecommendation?.optionalExpansions.length, 1);
  assert.equal(result.hybridRecommendation?.optionalExpansions[0]?.kind, "intermediate_step");
  assert.equal(result.hybridRecommendation?.optionalExpansions[0]?.canonicalRef?.entityId, "route-d-1");
  assert.equal(result.hybridRecommendation?.expansionPolicy[0]?.reasonCode, "cross_domain_bridge");
});

test("phase 2A: includes intermediate_step for start / strategy / owner_governance", async () => {
  const result = await buildHybridRecommendation(
    createContext({
      mode: "start",
      selectedPath: "strategy",
      scores: { owner: 1, management: 1, strategy: 3 },
      mainFocus: "Сначала выровняйте решения собственника.",
    }),
    {
      getSource: async () => createSource(),
      logEvent: () => undefined,
    },
  );

  assert.equal(result.hybridRecommendation?.composition, "canonical_plus_inferred");
  assert.equal(result.hybridRecommendation?.optionalExpansions[0]?.canonicalRef?.entityId, "route-b-6");
});

test("phase 2A: includes intermediate_step for start / cadence / operations_governance", async () => {
  const result = await buildHybridRecommendation(
    createContext({
      mode: "start",
      selectedPath: "cadence",
      scores: { operations: 1, management: 1, strategy: 4 },
      mainFocus: "Сначала соберите регулярное управление.",
    }),
    {
      getSource: async () => createSource(),
      logEvent: () => undefined,
    },
  );

  assert.equal(result.hybridRecommendation?.composition, "canonical_plus_inferred");
  assert.equal(result.hybridRecommendation?.optionalExpansions[0]?.canonicalRef?.entityId, "route-v-4");
});

test("phase 2A: rejects expansion when canonical is already specific enough", async () => {
  const result = await buildHybridRecommendation(
    createContext({
      mode: "growth",
      selectedPath: "sales",
      scores: { sales: 1, product: 1, owner: 4 },
      mainFocus: "Сначала выровняйте продажи.",
    }),
    {
      getSource: async () => createSource(),
      logEvent: () => undefined,
    },
  );

  assert.equal(result.hybridRecommendation?.composition, "canonical_only");
  assert.equal(result.hybridRecommendation?.optionalExpansions.length, 0);
  assert.equal(result.hybridRecommendation?.expansionPolicy[0]?.reasonCode, "canonical_already_specific");
});

test("phase 2A: rejects expansion when no preparatory step exists", async () => {
  const result = await buildHybridRecommendation(
    createContext({
      mode: "risk",
      selectedPath: "growth_slowdown",
      scores: { strategy: 1, market: 1, owner: 4 },
      mainFocus: "Сначала соберите стратегический фокус.",
    }),
    {
      getSource: async () => createSource(),
      logEvent: () => undefined,
    },
  );

  assert.equal(result.hybridRecommendation?.composition, "canonical_only");
  assert.equal(result.hybridRecommendation?.optionalExpansions.length, 0);
  assert.equal(result.hybridRecommendation?.expansionPolicy[0]?.reasonCode, "no_preparatory_step");
});

test("phase 2A: rejects expansion for already diagnostic owner overload step", async () => {
  const result = await buildHybridRecommendation(
    createContext({
      mode: "risk",
      selectedPath: "owner_overload",
      scores: { owner: 1, management: 2, sales: 4 },
      mainFocus: "Сначала выровняйте контур «Роль собственника».",
    }),
    {
      getSource: async () => createSource(),
      logEvent: () => undefined,
    },
  );

  assert.equal(result.hybridRecommendation?.composition, "canonical_only");
  assert.equal(result.hybridRecommendation?.optionalExpansions.length, 0);
});
