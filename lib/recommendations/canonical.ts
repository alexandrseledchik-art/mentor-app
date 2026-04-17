import "server-only";

import { classifyHeuristicBundle } from "./bundles";

import type {
  BusinessArchitectureSource,
  CanonicalResolutionTrace,
  HeuristicBundle,
  RecommendationContext,
  RecommendationItem,
  RouteStepEntry,
} from "./types";

type CanonicalQuery = {
  routeName?: string;
  stepCode?: string;
  navigatorTaskKeywords: string[];
  toolKeywords: string[];
};

type CanonicalResolutionResult = {
  recommendation: RecommendationItem | null;
  trace: CanonicalResolutionTrace;
};

const CANONICAL_QUERY_MAP: Record<
  string,
  Partial<Record<HeuristicBundle, CanonicalQuery>>
> = {
  "growth:sales": {
    commercial_product: {
      routeName: "МАРШРУТ Г",
      stepCode: "2.0",
      navigatorTaskKeywords: ["рост", "выручк", "продаж"],
      toolKeywords: ["Аудит системы продаж"],
    },
    strategy_market: {
      routeName: "МАРШРУТ Г",
      stepCode: "1.0",
      navigatorTaskKeywords: ["рост", "рын", "сегмент"],
      toolKeywords: ["PESTEL", "Анализ конкурентов"],
    },
    owner_governance: {
      routeName: "МАРШРУТ Д",
      stepCode: "5.0",
      navigatorTaskKeywords: ["делег", "решени", "операционк"],
      toolKeywords: ["Матрица полномочий"],
    },
    operations_governance: {
      routeName: "МАРШРУТ Г",
      stepCode: "2.0",
      navigatorTaskKeywords: ["рост", "выручк", "продаж"],
      toolKeywords: ["Аудит системы продаж"],
    },
    mixed: {
      routeName: "МАРШРУТ Г",
      stepCode: "2.0",
      navigatorTaskKeywords: ["рост", "выручк", "продаж"],
      toolKeywords: ["Аудит системы продаж"],
    },
  },
  "growth:product": {
    commercial_product: {
      routeName: "МАРШРУТ Г",
      stepCode: "6.0",
      navigatorTaskKeywords: ["клиент", "продукт", "лояльн"],
      toolKeywords: ["CJM", "NPS"],
    },
    strategy_market: {
      routeName: "МАРШРУТ Г",
      stepCode: "4.0",
      navigatorTaskKeywords: ["сегмент", "рын", "продукт"],
      toolKeywords: ["STP", "Tier-сегментация"],
    },
    owner_governance: {
      routeName: "МАРШРУТ Д",
      stepCode: "5.0",
      navigatorTaskKeywords: ["решени", "делег", "собственник"],
      toolKeywords: ["Матрица полномочий"],
    },
    operations_governance: {
      routeName: "МАРШРУТ Г",
      stepCode: "6.0",
      navigatorTaskKeywords: ["клиент", "сервис", "продукт"],
      toolKeywords: ["CJM", "NPS"],
    },
    mixed: {
      routeName: "МАРШРУТ Г",
      stepCode: "6.0",
      navigatorTaskKeywords: ["продукт", "клиент"],
      toolKeywords: ["CJM", "NPS"],
    },
  },
  "growth:decisions": {
    owner_governance: {
      routeName: "МАРШРУТ Д",
      stepCode: "5.0",
      navigatorTaskKeywords: ["делег", "решени", "собственник"],
      toolKeywords: ["Матрица полномочий"],
    },
    operations_governance: {
      routeName: "МАРШРУТ В",
      stepCode: "7.0",
      navigatorTaskKeywords: ["решени", "полномоч", "управляем"],
      toolKeywords: ["Матрица полномочий"],
    },
    commercial_product: {
      routeName: "МАРШРУТ Д",
      stepCode: "5.0",
      navigatorTaskKeywords: ["делег", "решени"],
      toolKeywords: ["Матрица полномочий"],
    },
    strategy_market: {
      routeName: "МАРШРУТ Б",
      stepCode: "8.0",
      navigatorTaskKeywords: ["стратег", "приоритет", "команд"],
      toolKeywords: ["Стратегическая сессия"],
    },
    mixed: {
      routeName: "МАРШРУТ Д",
      stepCode: "5.0",
      navigatorTaskKeywords: ["делег", "решени"],
      toolKeywords: ["Матрица полномочий"],
    },
  },
  "risk:growth_slowdown": {
    strategy_market: {
      routeName: "МАРШРУТ Г",
      stepCode: "1.0",
      navigatorTaskKeywords: ["рост", "рын", "конкурент"],
      toolKeywords: ["PESTEL", "Анализ конкурентов"],
    },
    commercial_product: {
      routeName: "МАРШРУТ Г",
      stepCode: "2.0",
      navigatorTaskKeywords: ["рост", "продаж", "выручк"],
      toolKeywords: ["Аудит системы продаж"],
    },
    owner_governance: {
      routeName: "МАРШРУТ Д",
      stepCode: "1.0",
      navigatorTaskKeywords: ["собственник", "операционк", "делег"],
      toolKeywords: ["Аудит роли собственника"],
    },
    operations_governance: {
      routeName: "МАРШРУТ В",
      stepCode: "4.0",
      navigatorTaskKeywords: ["управляем", "хаос", "структур"],
      toolKeywords: ["RACI", "оргструктур"],
    },
    mixed: {
      routeName: "МАРШРУТ Г",
      stepCode: "1.0",
      navigatorTaskKeywords: ["рост", "рын", "выручк"],
      toolKeywords: ["PESTEL", "Анализ конкурентов"],
    },
  },
  "risk:loss_of_control": {
    operations_governance: {
      routeName: "МАРШРУТ В",
      stepCode: "4.0",
      navigatorTaskKeywords: ["управляем", "хаос", "структур"],
      toolKeywords: ["RACI", "оргструктур"],
    },
    owner_governance: {
      routeName: "МАРШРУТ Д",
      stepCode: "6.0",
      navigatorTaskKeywords: ["ответствен", "решени", "собственник"],
      toolKeywords: ["RACI"],
    },
    commercial_product: {
      routeName: "МАРШРУТ В",
      stepCode: "8.0",
      navigatorTaskKeywords: ["цели", "контрол", "управлен"],
      toolKeywords: ["OKR", "KPI"],
    },
    strategy_market: {
      routeName: "МАРШРУТ В",
      stepCode: "8.0",
      navigatorTaskKeywords: ["цели", "ритм", "управлен"],
      toolKeywords: ["OKR", "KPI"],
    },
    mixed: {
      routeName: "МАРШРУТ В",
      stepCode: "4.0",
      navigatorTaskKeywords: ["управляем", "структур"],
      toolKeywords: ["RACI", "оргструктур"],
    },
  },
  "risk:owner_overload": {
    owner_governance: {
      routeName: "МАРШРУТ Д",
      stepCode: "1.0",
      navigatorTaskKeywords: ["собственник", "операционк", "время"],
      toolKeywords: ["Аудит роли собственника"],
    },
    operations_governance: {
      routeName: "МАРШРУТ Д",
      stepCode: "5.0",
      navigatorTaskKeywords: ["делег", "решени", "полномоч"],
      toolKeywords: ["Матрица полномочий"],
    },
    commercial_product: {
      routeName: "МАРШРУТ Д",
      stepCode: "1.0",
      navigatorTaskKeywords: ["собственник", "операционк"],
      toolKeywords: ["Аудит роли собственника"],
    },
    strategy_market: {
      routeName: "МАРШРУТ Д",
      stepCode: "1.0",
      navigatorTaskKeywords: ["собственник", "операционк"],
      toolKeywords: ["Аудит роли собственника"],
    },
    mixed: {
      routeName: "МАРШРУТ Д",
      stepCode: "1.0",
      navigatorTaskKeywords: ["собственник", "операционк"],
      toolKeywords: ["Аудит роли собственника"],
    },
  },
  "start:decisions": {
    owner_governance: {
      routeName: "МАРШРУТ Д",
      stepCode: "5.0",
      navigatorTaskKeywords: ["делег", "решени", "собственник"],
      toolKeywords: ["Матрица полномочий"],
    },
    operations_governance: {
      routeName: "МАРШРУТ В",
      stepCode: "7.0",
      navigatorTaskKeywords: ["полномоч", "решени", "управляем"],
      toolKeywords: ["Матрица полномочий"],
    },
    commercial_product: {
      routeName: "МАРШРУТ Д",
      stepCode: "5.0",
      navigatorTaskKeywords: ["решени", "делег"],
      toolKeywords: ["Матрица полномочий"],
    },
    strategy_market: {
      routeName: "МАРШРУТ Д",
      stepCode: "5.0",
      navigatorTaskKeywords: ["решени", "делег"],
      toolKeywords: ["Матрица полномочий"],
    },
    mixed: {
      routeName: "МАРШРУТ Д",
      stepCode: "5.0",
      navigatorTaskKeywords: ["решени", "делег"],
      toolKeywords: ["Матрица полномочий"],
    },
  },
  "start:strategy": {
    strategy_market: {
      routeName: "МАРШРУТ Б",
      stepCode: "6.0",
      navigatorTaskKeywords: ["стратег", "приоритет", "рост"],
      toolKeywords: ["Ansoff", "Blue Ocean"],
    },
    commercial_product: {
      routeName: "МАРШРУТ Г",
      stepCode: "4.0",
      navigatorTaskKeywords: ["сегмент", "рын", "клиент"],
      toolKeywords: ["STP", "Tier-сегментация"],
    },
    owner_governance: {
      routeName: "МАРШРУТ Б",
      stepCode: "8.0",
      navigatorTaskKeywords: ["стратег", "команд", "согласоват"],
      toolKeywords: ["Стратегическая сессия"],
    },
    operations_governance: {
      routeName: "МАРШРУТ Б",
      stepCode: "8.0",
      navigatorTaskKeywords: ["стратег", "команд", "согласоват"],
      toolKeywords: ["Стратегическая сессия"],
    },
    mixed: {
      routeName: "МАРШРУТ Б",
      stepCode: "6.0",
      navigatorTaskKeywords: ["стратег", "приоритет"],
      toolKeywords: ["Ansoff", "Blue Ocean"],
    },
  },
  "start:cadence": {
    operations_governance: {
      routeName: "МАРШРУТ В",
      stepCode: "8.0",
      navigatorTaskKeywords: ["ритм", "управлен", "цели"],
      toolKeywords: ["OKR", "KPI"],
    },
    owner_governance: {
      routeName: "МАРШРУТ Д",
      stepCode: "8.0",
      navigatorTaskKeywords: ["встреч", "ритм", "okr"],
      toolKeywords: ["Ритм встреч", "OKR"],
    },
    commercial_product: {
      routeName: "МАРШРУТ В",
      stepCode: "8.0",
      navigatorTaskKeywords: ["ритм", "управлен", "цели"],
      toolKeywords: ["OKR", "KPI"],
    },
    strategy_market: {
      routeName: "МАРШРУТ В",
      stepCode: "8.0",
      navigatorTaskKeywords: ["ритм", "управлен", "цели"],
      toolKeywords: ["OKR", "KPI"],
    },
    mixed: {
      routeName: "МАРШРУТ В",
      stepCode: "8.0",
      navigatorTaskKeywords: ["ритм", "управлен", "цели"],
      toolKeywords: ["OKR", "KPI"],
    },
  },
};

function includesKeyword(value: string | undefined, keywords: string[]) {
  const normalized = (value ?? "").toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

function buildCanonicalReason(
  ctx: RecommendationContext,
  params: {
    title: string;
    weakZoneLabels: string[];
    strongestZoneLabel: string | null;
  },
) {
  const weakLead =
    params.weakZoneLabels.length > 0
      ? params.weakZoneLabels.join(" и ")
      : "ключевой управленческий контур";
  const strongestLead = params.strongestZoneLabel
    ? ` При этом на ${params.strongestZoneLabel} уже можно опереться.`
    : "";
  const focus = ctx.summary.main_focus.toLowerCase();

  return `Сейчас логично идти через «${params.title}», потому что слабее всего выглядят ${weakLead}, а главный фокус уже указывает в эту сторону: ${focus}.${strongestLead}`;
}

function findNextRouteStep(
  source: BusinessArchitectureSource,
  routeStep: RouteStepEntry,
) {
  const routeGroup = source.product.route_steps
    .filter((item) => item.route_ru === routeStep.route_ru)
    .sort((a, b) => Number.parseFloat(a.step_code) - Number.parseFloat(b.step_code));
  const routeIndex = routeGroup.findIndex((item) => item.id === routeStep.id);

  return routeIndex >= 0 ? routeGroup[routeIndex + 1] ?? null : null;
}

function resolveRouteStep(
  source: BusinessArchitectureSource,
  query: CanonicalQuery,
  ctx: RecommendationContext,
  bundleInfo: ReturnType<typeof classifyHeuristicBundle>,
): RecommendationItem | null {
  if (!query.routeName || !query.stepCode) {
    return null;
  }

  const routeName = query.routeName;
  const stepCode = query.stepCode;

  const routeStep = source.product.route_steps.find(
    (item) => item.route_ru.includes(routeName) && item.step_code === stepCode,
  );

  if (!routeStep) {
    return null;
  }

  const nextStep = findNextRouteStep(source, routeStep);

  return {
    origin: "canonical",
    kind: "route",
    title: routeStep.tool_ru,
    description: `Цель — ${routeStep.step_goal_ru}. Результат — ${routeStep.step_result_ru}.`,
    canonicalRef: {
      entityType: "route_step",
      entityId: routeStep.id,
    },
    explanation: {
      why: buildCanonicalReason(ctx, {
        title: routeStep.route_ru,
        weakZoneLabels: bundleInfo.weakZoneLabels,
        strongestZoneLabel: bundleInfo.strongestZoneLabel,
      }),
      basedOn: {
        weakZones: bundleInfo.weakZoneLabels,
        strongestZone: bundleInfo.strongestZoneLabel,
        summarySignals: [ctx.summary.main_focus],
        contextSignals: [bundleInfo.bundle],
      },
      confidence: "high",
    },
    details: {
      route: routeStep.route_ru,
      stepCode: routeStep.step_code,
      goal: routeStep.step_goal_ru,
      result: routeStep.step_result_ru,
      nextStepGoal: nextStep?.step_goal_ru ?? null,
    },
  };
}

function resolveNavigatorTask(
  source: BusinessArchitectureSource,
  query: CanonicalQuery,
  ctx: RecommendationContext,
  bundleInfo: ReturnType<typeof classifyHeuristicBundle>,
): RecommendationItem | null {
  const task = source.product.navigator_tasks.find(
    (item) =>
      includesKeyword(item.task_ru, query.navigatorTaskKeywords) ||
      includesKeyword(item.when_to_apply_ru, query.navigatorTaskKeywords) ||
      includesKeyword(item.section_ru, query.navigatorTaskKeywords),
  );

  if (!task) {
    return null;
  }

  return {
    origin: "canonical",
    kind: "task",
    title: task.task_ru,
    description: `Когда применять — ${task.when_to_apply_ru}. Результат — ${task.expected_result_ru}.`,
    canonicalRef: {
      entityType: "navigator_task",
      entityId: task.id,
    },
    explanation: {
      why: buildCanonicalReason(ctx, {
        title: task.task_ru,
        weakZoneLabels: bundleInfo.weakZoneLabels,
        strongestZoneLabel: bundleInfo.strongestZoneLabel,
      }),
      basedOn: {
        weakZones: bundleInfo.weakZoneLabels,
        strongestZone: bundleInfo.strongestZoneLabel,
        summarySignals: [ctx.summary.main_focus],
        contextSignals: [bundleInfo.bundle],
      },
      confidence: "medium",
    },
    details: {
      route: task.section_ru,
      result: task.expected_result_ru,
      nextStepGoal: task.tools_sequence_ru,
    },
  };
}

function resolveTool(
  source: BusinessArchitectureSource,
  query: CanonicalQuery,
  ctx: RecommendationContext,
  bundleInfo: ReturnType<typeof classifyHeuristicBundle>,
): RecommendationItem | null {
  const tool = source.knowledge.tools.find(
    (item) =>
      includesKeyword(item.title_ru, query.toolKeywords) ||
      includesKeyword(item.description_ru, query.toolKeywords),
  );

  if (!tool) {
    return null;
  }

  return {
    origin: "canonical",
    kind: "tool",
    title: tool.title_ru,
    description: `Когда применять — ${tool.when_to_apply_ru ?? "по текущему кейсу"}. Результат — ${tool.result_ru ?? "понятный следующий шаг"}.`,
    canonicalRef: {
      entityType: "tool",
      entityId: tool.id,
    },
    explanation: {
      why: buildCanonicalReason(ctx, {
        title: tool.title_ru,
        weakZoneLabels: bundleInfo.weakZoneLabels,
        strongestZoneLabel: bundleInfo.strongestZoneLabel,
      }),
      basedOn: {
        weakZones: bundleInfo.weakZoneLabels,
        strongestZone: bundleInfo.strongestZoneLabel,
        summarySignals: [ctx.summary.main_focus],
        contextSignals: [bundleInfo.bundle],
      },
      confidence: "medium",
    },
    details: {
      route: tool.section_ru ?? null,
      result: tool.result_ru ?? null,
    },
  };
}

function getCanonicalQuery(
  ctx: RecommendationContext,
  bundle: HeuristicBundle,
): { queryKey: string; query: CanonicalQuery | null } {
  const queryKey = `${ctx.mode}:${ctx.selectedPath}`;
  const bundleQueries = CANONICAL_QUERY_MAP[queryKey];

  if (!bundleQueries) {
    return { queryKey, query: null };
  }

  return {
    queryKey,
    query: bundleQueries[bundle] ?? bundleQueries.mixed ?? null,
  };
}

export function resolveCanonicalRecommendation(params: {
  source: BusinessArchitectureSource;
  ctx: RecommendationContext;
}): CanonicalResolutionResult {
  const bundleInfo = classifyHeuristicBundle(params.ctx);
  const { queryKey, query } = getCanonicalQuery(params.ctx, bundleInfo.bundle);

  if (!query) {
    return {
      recommendation: null,
      trace: {
        bundle: bundleInfo.bundle,
        resolutionPath: "fallback",
        queryKey,
      },
    };
  }

  const routeStep = resolveRouteStep(params.source, query, params.ctx, bundleInfo);

  if (routeStep) {
    return {
      recommendation: routeStep,
      trace: {
        bundle: bundleInfo.bundle,
        resolutionPath: "route_step",
        queryKey,
      },
    };
  }

  const navigatorTask = resolveNavigatorTask(
    params.source,
    query,
    params.ctx,
    bundleInfo,
  );

  if (navigatorTask) {
    return {
      recommendation: navigatorTask,
      trace: {
        bundle: bundleInfo.bundle,
        resolutionPath: "navigator_task",
        queryKey,
      },
    };
  }

  const tool = resolveTool(params.source, query, params.ctx, bundleInfo);

  if (tool) {
    return {
      recommendation: tool,
      trace: {
        bundle: bundleInfo.bundle,
        resolutionPath: "tool",
        queryKey,
      },
    };
  }

  return {
    recommendation: null,
    trace: {
      bundle: bundleInfo.bundle,
      resolutionPath: "fallback",
      queryKey,
    },
  };
}
