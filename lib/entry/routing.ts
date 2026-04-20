import "server-only";

import { buildDiagnosisDeepLink, buildToolDeepLink } from "@/lib/entry/deeplink";
import {
  shouldRouteWebsiteInputDirectly,
  shouldRouteWebsiteInputToScreening,
} from "@/lib/entry/website-routing";
import {
  isAffirmativeAnswer,
  isNegativeAnswer,
  matchToolFromText,
  suggestClosestAlternativeTool,
} from "@/lib/entry/tool-matching";
import type {
  EntryHypothesis,
  EntryIntent,
  EntryMode,
  EntryRoutingDecision,
  EntrySessionState,
  Tool,
  ToolConfidence,
} from "@/types/domain";

type RoutingParams = {
  mode: EntryMode;
  intent: EntryIntent | null;
  hypothesis: EntryHypothesis | null;
  rawText: string;
  turnCount: number;
  session: EntrySessionState | null;
};

function getDiagnosisDecision(mode: EntryMode, intent: EntryIntent | null, tool?: Tool | null): EntryRoutingDecision {
  return {
    action: "route_to_diagnosis",
    reason: "Недостаточно сигнала для безопасного выбора одного инструмента, поэтому лучший следующий шаг — структурная диагностика.",
    toolSuggestion: tool
      ? {
          slug: tool.slug,
          title: tool.title,
          url: buildDiagnosisDeepLink({
            entryMode: mode,
            entryIntent: intent?.primaryIntent ?? "unclear",
            suggestedTool: tool.slug,
          }),
        }
      : undefined,
  };
}

export async function decideEntryRouting({
  mode,
  intent,
  hypothesis,
  rawText,
  turnCount,
  session,
}: RoutingParams): Promise<{
  decision: EntryRoutingDecision;
  toolConfidence?: ToolConfidence;
  matchedTool?: Tool | null;
  unsupportedToolRequested?: boolean;
  alternativeTool?: Tool | null;
}> {
  const toolMatch = await matchToolFromText(rawText, mode, intent);
  const lastQuestionKey =
    session && "lastQuestionKey" in session ? session.lastQuestionKey : null;
  const answerLooksLikeEscalation =
    rawText.toLowerCase().includes("без вопросов") ||
    rawText.toLowerCase().includes("просто скажи") ||
    rawText.toLowerCase().includes("не хочу отвечать");

  if (shouldRouteWebsiteInputToScreening({ rawText })) {
    return {
      decision: {
        action: "route_to_website_screening",
        reason:
          "Пользователь дал только сайт. Этого достаточно для внешнего скрининга, но недостаточно для честного диагноза бизнеса.",
      },
      toolConfidence: toolMatch.confidence,
      matchedTool: toolMatch.tool,
    };
  }

  if (shouldRouteWebsiteInputDirectly({ mode, rawText })) {
    return {
      decision: {
        ...getDiagnosisDecision(mode, intent, toolMatch.tool),
        reason: "Пользователь дал сайт, этого достаточно для первичного zero-friction разбора без уточняющих вопросов.",
      },
      toolConfidence: toolMatch.confidence,
      matchedTool: toolMatch.tool,
    };
  }

  if (mode === "specific_tool_request") {
    if (toolMatch.tool && toolMatch.confidence === "high") {
      return {
        decision: {
          action: "route_to_tool",
          toolSuggestion: {
            slug: toolMatch.tool.slug,
            title: toolMatch.tool.title,
            url: buildToolDeepLink(toolMatch.tool.slug),
          },
          reason: `Есть сильное совпадение по инструменту «${toolMatch.tool.title}».`,
        },
        toolConfidence: toolMatch.confidence,
        matchedTool: toolMatch.tool,
      };
    }

    if (toolMatch.tool && toolMatch.confidence === "medium") {
      if (lastQuestionKey === "confirm_tool" && isAffirmativeAnswer(rawText)) {
        return {
          decision: {
            action: "route_to_tool",
            toolSuggestion: {
              slug: toolMatch.tool.slug,
              title: toolMatch.tool.title,
              url: buildToolDeepLink(toolMatch.tool.slug),
            },
            reason: `Пользователь подтвердил переход к инструменту «${toolMatch.tool.title}».`,
          },
          toolConfidence: "medium",
          matchedTool: toolMatch.tool,
        };
      }

      if (lastQuestionKey === "confirm_tool" && isNegativeAnswer(rawText)) {
        return {
          decision: getDiagnosisDecision(mode, intent),
          toolConfidence: "low",
        };
      }

      return {
        decision: {
          action: "confirm_tool_then_route",
          nextQuestion: {
            key: "confirm_tool",
            text: `Правильно понимаю, что вам нужен инструмент «${toolMatch.tool.title}»?`,
          },
          toolSuggestion: {
            slug: toolMatch.tool.slug,
            title: toolMatch.tool.title,
            url: buildToolDeepLink(toolMatch.tool.slug),
          },
          reason: "Есть вероятное совпадение, но лучше один раз подтвердить инструмент.",
        },
        toolConfidence: "medium",
        matchedTool: toolMatch.tool,
      };
    }

    const alternativeTool = await suggestClosestAlternativeTool(rawText, intent);

    if (lastQuestionKey === "confirm_tool" && isAffirmativeAnswer(rawText) && alternativeTool) {
      return {
        decision: {
          action: "route_to_tool",
          toolSuggestion: {
            slug: alternativeTool.slug,
            title: alternativeTool.title,
            url: buildToolDeepLink(alternativeTool.slug),
          },
          reason: `Точного совпадения нет, но подтверждён ближайший доступный инструмент «${alternativeTool.title}».`,
        },
        toolConfidence: "medium",
        alternativeTool,
        unsupportedToolRequested: true,
      };
    }

    if (lastQuestionKey === "confirm_tool" && isNegativeAnswer(rawText)) {
      return {
        decision: getDiagnosisDecision(mode, intent),
        toolConfidence: "low",
        unsupportedToolRequested: true,
      };
    }

    if (alternativeTool) {
      return {
        decision: {
          action: "confirm_tool_then_route",
          nextQuestion: {
            key: "confirm_tool",
            text: `Точного инструмента у нас сейчас нет. Ближайший вариант — «${alternativeTool.title}». Показать его?`,
          },
          toolSuggestion: {
            slug: alternativeTool.slug,
            title: alternativeTool.title,
            url: buildToolDeepLink(alternativeTool.slug),
          },
          reason: "Запрошенный инструмент не найден, но есть близкая доступная альтернатива.",
        },
        toolConfidence: "low",
        unsupportedToolRequested: true,
        alternativeTool,
      };
    }

    return {
      decision:
        turnCount >= 1 || answerLooksLikeEscalation
          ? getDiagnosisDecision(mode, intent)
          : {
              action: "ask_question",
              reason: "Нужна одна короткая развилка, чтобы не увести вас в случайный инструмент.",
            },
      toolConfidence: "low",
      unsupportedToolRequested: true,
    };
  }

  if (mode === "tool_discovery") {
    if (toolMatch.tool && toolMatch.confidence === "high") {
      return {
        decision: {
          action: "route_to_tool",
          toolSuggestion: {
            slug: toolMatch.tool.slug,
            title: toolMatch.tool.title,
            url: buildToolDeepLink(toolMatch.tool.slug),
          },
          reason: `Инструмент «${toolMatch.tool.title}» уже выглядит самым уместным следующим шагом.`,
        },
        toolConfidence: "high",
        matchedTool: toolMatch.tool,
      };
    }

    if (toolMatch.tool && toolMatch.confidence === "medium") {
      if (lastQuestionKey === "confirm_tool" && isAffirmativeAnswer(rawText)) {
        return {
          decision: {
            action: "route_to_tool",
            toolSuggestion: {
              slug: toolMatch.tool.slug,
              title: toolMatch.tool.title,
              url: buildToolDeepLink(toolMatch.tool.slug),
            },
            reason: `Инструмент «${toolMatch.tool.title}» подтверждён и подходит как следующий шаг.`,
          },
          toolConfidence: "medium",
          matchedTool: toolMatch.tool,
        };
      }

      if (lastQuestionKey === "confirm_tool" && isNegativeAnswer(rawText)) {
        return {
          decision: getDiagnosisDecision(mode, intent),
          toolConfidence: "low",
        };
      }

      if (turnCount >= 2 || answerLooksLikeEscalation) {
        return {
          decision: {
            action: "route_to_tool",
            toolSuggestion: {
              slug: toolMatch.tool.slug,
              title: toolMatch.tool.title,
              url: buildToolDeepLink(toolMatch.tool.slug),
            },
            reason: `После короткого уточнения инструмент «${toolMatch.tool.title}» выглядит лучшим доступным вариантом.`,
          },
          toolConfidence: "medium",
          matchedTool: toolMatch.tool,
        };
      }

      return {
        decision: {
          action: "confirm_tool_then_route",
          nextQuestion: {
            key: "confirm_tool",
            text: `Похоже, вам ближе всего инструмент «${toolMatch.tool.title}». Подтвердить и открыть его?`,
          },
          toolSuggestion: {
            slug: toolMatch.tool.slug,
            title: toolMatch.tool.title,
            url: buildToolDeepLink(toolMatch.tool.slug),
          },
          reason: "Есть вероятный инструмент, но один быстрый confirm безопаснее, чем сразу вести дальше.",
        },
        toolConfidence: "medium",
        matchedTool: toolMatch.tool,
      };
    }

    if (turnCount >= 2 || answerLooksLikeEscalation) {
      return {
        decision: getDiagnosisDecision(mode, intent),
        toolConfidence: "low",
      };
    }

    return {
      decision: {
        action: "ask_question",
        reason: "Нужен один вопрос, чтобы понять, какой контур вы хотите закрыть инструментом.",
      },
      toolConfidence: "low",
    };
  }

  if (mode === "problem_first") {
    if (answerLooksLikeEscalation) {
      return {
        decision: getDiagnosisDecision(mode, intent),
        toolConfidence: toolMatch.confidence,
        matchedTool: toolMatch.tool,
      };
    }

    if (intent?.confidence === "high" && turnCount <= 2) {
      return {
        decision: getDiagnosisDecision(mode, intent, toolMatch.tool),
        toolConfidence: toolMatch.confidence,
        matchedTool: toolMatch.tool,
      };
    }

    if (turnCount >= 3) {
      return {
        decision: getDiagnosisDecision(mode, intent, toolMatch.tool),
        toolConfidence: toolMatch.confidence,
        matchedTool: toolMatch.tool,
      };
    }

    return {
      decision: {
        action: "ask_question",
        reason:
          hypothesis?.uncertaintyNote ??
          "Нужен один короткий вопрос, чтобы не перепутать симптом и корневой контур.",
      },
      toolConfidence: toolMatch.confidence,
      matchedTool: toolMatch.tool,
    };
  }

  if (turnCount >= 2) {
    return {
      decision: getDiagnosisDecision(mode, intent),
      toolConfidence: toolMatch.confidence,
      matchedTool: toolMatch.tool,
    };
  }

  return {
    decision: {
      action: "ask_question",
      reason: "Входной запрос пока слишком широкий для безопасного маршрута.",
    },
    toolConfidence: toolMatch.confidence,
    matchedTool: toolMatch.tool,
  };
}
