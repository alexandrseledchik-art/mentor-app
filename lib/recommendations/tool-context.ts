import { classifyHeuristicBundle } from "./bundles";

import type {
  RecommendationContext,
  ToolContext,
  ToolContextEnrichmentMeta,
  ToolHandoff,
} from "./types";

const WHY_NOW_TEMPLATES: Record<string, string> = {
  owner_governance:
    "Сейчас этот инструмент уместен, потому что ключевое ограничение сидит в качестве решений и роли собственника.",
  commercial_product:
    "Сейчас этот инструмент уместен, потому что рост упирается в продуктово-коммерческий контур.",
  operations_governance:
    "Сейчас этот инструмент уместен, потому что без управляемого контура исполнения следующий шаг будет хрупким.",
  strategy_market:
    "Сейчас этот инструмент уместен, потому что сначала нужно собрать более ясный вектор и внешний ориентир.",
  mixed:
    "Сейчас этот инструмент уместен, потому что он помогает быстро сузить главный контур проблемы.",
};

const CLARIFIES_TEMPLATES: Record<string, string> = {
  sales: "Он поможет понять, где именно теряется рост в продажах и выручке.",
  product: "Он поможет прояснить, где продукт теряет ценность для клиента.",
  decisions: "Он поможет прояснить, где именно застревают решения и ответственность.",
  growth_slowdown: "Он поможет отделить рыночное ограничение от внутренней проблемы системы.",
  loss_of_control: "Он поможет увидеть, где именно бизнес теряет управляемость.",
  owner_overload: "Он поможет понять, где собственник перегружен и почему это тормозит систему.",
  strategy: "Он поможет прояснить, какой стратегический выбор сейчас действительно главный.",
  cadence: "Он поможет понять, какой управленческий ритм нужно собрать в первую очередь.",
};

function shortText(value: string | null | undefined, limit = 140) {
  const normalized = (value ?? "").replace(/\s+/g, " ").trim();

  if (!normalized) {
    return null;
  }

  const firstSentence = normalized.split(/[.!?]/)[0]?.trim() ?? normalized;

  return firstSentence.length > limit
    ? `${firstSentence.slice(0, limit - 1).trim()}…`
    : firstSentence;
}

function isTooGeneric(value: string | null) {
  if (!value) {
    return true;
  }

  const normalized = value.toLowerCase();
  return (
    normalized.includes("по текущему кейсу") ||
    normalized.includes("понятный следующий шаг") ||
    normalized.length < 18
  );
}

export function buildToolContext(params: {
  ctx: RecommendationContext;
  handoff: ToolHandoff | null;
}): { toolContext: ToolContext | null; meta: ToolContextEnrichmentMeta } {
  if (!params.handoff) {
    return {
      toolContext: null,
      meta: {
        included: false,
        reasonCode: "no_handoff",
        humanReadableReason: "Tool context skipped because tool handoff is missing.",
        usedDescription: false,
        usedWhenToApply: false,
        usedResult: false,
        usedBundleTemplate: false,
      },
    };
  }

  const bundle = classifyHeuristicBundle(params.ctx).bundle;
  const description = shortText(params.handoff.tool.description ?? null);
  const whenToApply = shortText(params.handoff.tool.details?.whenToApply ?? null);
  const result = shortText(params.handoff.tool.details?.result ?? null);
  const bundleWhy = WHY_NOW_TEMPLATES[bundle];
  const selectedPathClarifies = CLARIFIES_TEMPLATES[params.ctx.selectedPath];

  const whyThisToolNow =
    whenToApply && !isTooGeneric(whenToApply) ? whenToApply : bundleWhy;
  const whatItClarifies =
    description && !isTooGeneric(description) ? description : selectedPathClarifies;
  const expectedOutputType = result && !isTooGeneric(result) ? result : null;

  const usedDescription = Boolean(description && !isTooGeneric(description));
  const usedWhenToApply = Boolean(whenToApply && !isTooGeneric(whenToApply));
  const usedResult = Boolean(expectedOutputType);
  const usedBundleTemplate = !usedWhenToApply || !usedDescription;

  if (!expectedOutputType) {
    return {
      toolContext: null,
      meta: {
        included: false,
        reasonCode: "insufficient_metadata",
        humanReadableReason:
          "Tool context skipped because result metadata is too thin for a useful enrichment block.",
        usedDescription,
        usedWhenToApply,
        usedResult: false,
        usedBundleTemplate,
      },
    };
  }

  if (whyThisToolNow === whatItClarifies) {
    return {
      toolContext: null,
      meta: {
        included: false,
        reasonCode: "duplicate_without_value",
        humanReadableReason:
          "Tool context skipped because it repeats the same idea without adding value.",
        usedDescription,
        usedWhenToApply,
        usedResult,
        usedBundleTemplate,
      },
    };
  }

  const toolContext: ToolContext = {
    whyThisToolNow,
    whatItClarifies,
    expectedOutputType,
  };

  return {
    toolContext,
    meta: {
      included: true,
      reasonCode:
        usedResult && (usedDescription || usedWhenToApply) && usedBundleTemplate
          ? "metadata_and_bundle"
          : usedResult && (usedDescription || usedWhenToApply)
            ? "metadata_only"
            : "bundle_template_only",
      humanReadableReason:
        "Tool context added because the tool has enough metadata and a clear contextual link to the current bundle and scenario.",
      usedDescription,
      usedWhenToApply,
      usedResult,
      usedBundleTemplate,
    },
  };
}
