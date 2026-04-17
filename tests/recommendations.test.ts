import test from "node:test";
import assert from "node:assert/strict";

import { classifyHeuristicBundle } from "@/lib/recommendations/bundles";
import { resolveCanonicalRecommendation } from "@/lib/recommendations/canonical";
import { buildHybridRecommendation } from "@/lib/recommendations/orchestrate";
import { buildToolContext } from "@/lib/recommendations/tool-context";

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
        {
          id: "tool-raci",
          title_ru: "Диагностика оргструктуры + RACI",
          description_ru: "Карта ответственности и зон хаоса",
          when_to_apply_ru: "Когда теряется управляемость",
          result_ru: "Органиграмма с зонами хаоса",
          section_ru: "МАРШРУТ В",
        },
        {
          id: "tool-matrix",
          title_ru: "Матрица полномочий",
          description_ru: "Передача решений по уровням",
          when_to_apply_ru: "Когда нужно разгрузить контур решений",
          result_ru: "План делегирования по уровням",
          section_ru: "МАРШРУТ Д",
        },
        {
          id: "tool-session",
          title_ru: "Стратегическая сессия",
          description_ru: "Согласование стратегии с командой",
          when_to_apply_ru: "Когда нужен общий стратегический контур",
          result_ru: "Зафиксированная и разделяемая стратегия",
          section_ru: "МАРШРУТ Б",
        },
        {
          id: "tool-pestel",
          title_ru: "PESTEL + Анализ конкурентов",
          description_ru: "Внешний анализ рынка и конкурентов",
          when_to_apply_ru: "Когда рост замедляется и нужен внешний контекст",
          result_ru: "Понять есть ли рыночные ограничения",
          section_ru: "ВНЕШНЯЯ СРЕДА",
        },
      ],
      symptom_tool_map: [
        {
          id: "symptom-market-1",
          section_ru: "ВНЕШНЯЯ СРЕДА",
          symptom_ru: "Не понимаем что происходит на рынке",
          recommended_tool_ru: "PESTEL + Анализ конкурентов",
          why_relevant_ru: "Нужен внешний ориентир для роста",
        },
        {
          id: "symptom-owner-1",
          section_ru: "КОНТУР СОБСТВЕННИКА",
          symptom_ru: "Собственник перегружен и тормозит решения",
          recommended_tool_ru: "Аудит роли собственника",
          why_relevant_ru: "Нужно снять перегруз собственника",
        },
      ],
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

test("phase 2B: route-linked tool handoff is included for direct tool match", async () => {
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

  assert.equal(result.hybridRecommendation?.toolHandoff?.source, "route_linked");
  assert.equal(result.hybridRecommendation?.toolHandoff?.tool.title, "Аудит системы продаж");
  assert.equal(result.hybridRecommendation?.toolHandoff?.reasonCode, "route_tool_exact_match");
});

test("phase 2B: route-linked tool handoff matches realistic alias titles from knowledge catalog", async () => {
  const source = createSource();
  const salesAuditTool = source.knowledge.tools.find(
    (item) => item.id === "tool-sales-audit",
  );

  if (!salesAuditTool) {
    throw new Error("Fixture tool not found");
  }

  salesAuditTool.title_ru = "Воронка продаж";

  const result = await buildHybridRecommendation(
    createContext({
      mode: "growth",
      selectedPath: "sales",
      scores: { sales: 1, product: 1, owner: 4 },
      mainFocus: "Сначала выровняйте продажи.",
    }),
    {
      getSource: async () => source,
      logEvent: () => undefined,
    },
  );

  assert.equal(result.hybridRecommendation?.toolHandoff?.source, "route_linked");
  assert.equal(result.hybridRecommendation?.toolHandoff?.tool.title, "Воронка продаж");
});

test("phase 2B: symptom-linked tool handoff is included when route-linked tool is unavailable", async () => {
  const source = createSource();
  source.product.route_steps[0]!.tool_ru = "Внешний рыночный разбор";

  const result = await buildHybridRecommendation(
    createContext({
      mode: "risk",
      selectedPath: "growth_slowdown",
      scores: { strategy: 1, market: 1, owner: 4 },
      mainFocus: "Сначала соберите стратегический фокус.",
    }),
    {
      getSource: async () => source,
      logEvent: () => undefined,
    },
  );

  assert.equal(result.hybridRecommendation?.toolHandoff?.source, "symptom_linked");
  assert.equal(result.hybridRecommendation?.toolHandoff?.reasonCode, "symptom_tool_match");
});

test("phase 2B: symptom-linked tool handoff resolves combined recommended tool strings", async () => {
  const source = createSource();
  source.product.route_steps[0]!.tool_ru = "Внешний рыночный разбор";
  const pestelTool = source.knowledge.tools.find((item) => item.id === "tool-pestel");

  if (!pestelTool) {
    throw new Error("Fixture tool not found");
  }

  pestelTool.title_ru = "PESTEL-анализ внешней среды";
  source.knowledge.symptom_tool_map[0]!.recommended_tool_ru =
    "PESTEL + Porter's Five Forces + Анализ конкурентов";

  const result = await buildHybridRecommendation(
    createContext({
      mode: "risk",
      selectedPath: "growth_slowdown",
      scores: { strategy: 1, market: 1, owner: 4 },
      mainFocus: "Сначала соберите стратегический фокус.",
    }),
    {
      getSource: async () => source,
      logEvent: () => undefined,
    },
  );

  assert.equal(result.hybridRecommendation?.toolHandoff?.source, "symptom_linked");
  assert.equal(result.hybridRecommendation?.toolHandoff?.tool.title, "PESTEL-анализ внешней среды");
});

test("phase 2B: no handoff is returned when no confident match exists", async () => {
  const source = createSource();
  source.knowledge.tools = [];
  source.knowledge.symptom_tool_map = [];

  const result = await buildHybridRecommendation(
    createContext({
      mode: "start",
      selectedPath: "strategy",
      scores: { strategy: 1, market: 1 },
      mainFocus: "Сначала соберите стратегический фокус.",
    }),
    {
      getSource: async () => source,
      logEvent: () => undefined,
    },
  );

  assert.equal(result.hybridRecommendation?.toolHandoff ?? null, null);
});

test("phase 2B: duplicate route-linked handoff without useful metadata falls back to symptom-linked", async () => {
  const source = createSource();
  const matrixTool = source.knowledge.tools.find(
    (item) => item.title_ru === "Матрица полномочий",
  );

  if (!matrixTool) {
    throw new Error("Fixture tool not found");
  }

  matrixTool.description_ru = null;
  matrixTool.when_to_apply_ru = null;
  matrixTool.result_ru = null;

  const result = await buildHybridRecommendation(
    createContext({
      mode: "growth",
      selectedPath: "decisions",
      scores: { owner: 1, management: 1, sales: 4 },
      mainFocus: "Сначала выровняйте контур «Роль собственника».",
    }),
    {
      getSource: async () => source,
      logEvent: () => undefined,
    },
  );

  assert.equal(result.hybridRecommendation?.toolHandoff?.source, "symptom_linked");
  assert.equal(result.hybridRecommendation?.toolHandoff?.reasonCode, "symptom_tool_match");
});

test("tool context enrichment appears when handoff has good metadata", async () => {
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

  assert.equal(result.hybridRecommendation?.toolHandoff?.toolContext !== null, true);
  assert.equal(
    Boolean(result.hybridRecommendation?.toolHandoff?.toolContext?.expectedOutputType),
    true,
  );
});

test("tool context enrichment does not appear when metadata is too empty", () => {
  const result = buildToolContext({
    ctx: createContext({
      mode: "growth",
      selectedPath: "sales",
      scores: { sales: 1, product: 1, owner: 4 },
      mainFocus: "Сначала выровняйте продажи.",
    }),
    handoff: {
      source: "route_linked",
      confidence: "high",
      reasonCode: "route_tool_exact_match",
      humanReadableReason: "direct match",
      tool: {
        origin: "canonical",
        kind: "tool",
        title: "Аудит системы продаж",
        description: undefined,
        canonicalRef: {
          entityType: "tool",
          entityId: "tool-sales-audit",
        },
        explanation: {
          why: "direct match",
          basedOn: {},
          confidence: "high",
        },
        details: {
          whenToApply: null,
          result: null,
        },
      },
    },
  });

  assert.equal(result.toolContext, null);
  assert.equal(result.meta.reasonCode, "insufficient_metadata");
});

test("tool context enrichment does not appear without handoff", () => {
  const result = buildToolContext({
    ctx: createContext(),
    handoff: null,
  });

  assert.equal(result.toolContext, null);
  assert.equal(result.meta.reasonCode, "no_handoff");
});

test("tool context enrichment stays compact", async () => {
  const result = await buildHybridRecommendation(
    createContext({
      mode: "start",
      selectedPath: "strategy",
      scores: { strategy: 1, market: 1, owner: 4 },
      mainFocus: "Сначала соберите стратегический фокус.",
    }),
    {
      getSource: async () => createSource(),
      logEvent: () => undefined,
    },
  );

  const toolContext = result.hybridRecommendation?.toolHandoff?.toolContext;

  assert.equal(Boolean(toolContext), true);
  assert.equal((toolContext?.whyThisToolNow.length ?? 0) < 170, true);
  assert.equal((toolContext?.whatItClarifies.length ?? 0) < 170, true);
  assert.equal((toolContext?.expectedOutputType.length ?? 0) < 170, true);
});
