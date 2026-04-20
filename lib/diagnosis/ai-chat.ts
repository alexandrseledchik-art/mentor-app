import "server-only";

import { getOpenAiModel, getOpenAiNumberEnv } from "@/lib/openai/model-config";
import { buildHybridRecommendation } from "@/lib/recommendations/orchestrate";
import { diagnosisChatReplySchema } from "@/validators/diagnosis";

import type {
  DiagnosisChatContext,
  DiagnosisChatMode,
  DiagnosisChatQuickReply,
  DiagnosisChatReply,
} from "@/types/domain";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

const DIAGNOSIS_CHAT_SYSTEM_PROMPT = `Ты — интерпретатор результата диагностики бизнеса.

Ты не общий бизнес-ассистент.
Ты работаешь только с тем результатом диагностики, который тебе передан.

Твоя задача:
* объяснить главный вывод по результату
* помочь выделить приоритет
* перевести выводы в конкретные действия

Правила:
* не придумывай данные
* не уходи в общую теорию
* не консультируй "вообще про бизнес"
* опирайся только на context и question
* если вопрос слишком общий или вне рамки диагностики, мягко верни пользователя к его результату
* пиши коротко, ясно и по делу
* отвечай как для собственника, у которого мало времени

Формат ответа строго JSON:
{
  "reply": "..."
}`;

const SCENARIO_OPTIONS: Record<DiagnosisChatMode, DiagnosisChatQuickReply[]> = {
  growth: [
    { label: "В продажах", selectedPath: "sales" },
    { label: "В продукте", selectedPath: "product" },
    { label: "В решениях", selectedPath: "decisions" },
  ],
  risk: [
    { label: "Замедление роста", selectedPath: "growth_slowdown" },
    { label: "Потеря управляемости", selectedPath: "loss_of_control" },
    { label: "Перегруз собственника", selectedPath: "owner_overload" },
  ],
  start: [
    { label: "Решения", selectedPath: "decisions" },
    { label: "Стратегия", selectedPath: "strategy" },
    { label: "Регулярное управление", selectedPath: "cadence" },
  ],
};

const SCORE_LABELS: Record<string, string> = {
  owner: "роль собственника",
  market: "внешняя среда и рынок",
  strategy: "стратегия и направление",
  product: "продукт",
  sales: "продажи и маркетинг",
  operations: "операции",
  finance: "финансы",
  team: "команда",
  management: "управление и принятие решений",
  tech: "технологии",
  data: "данные и аналитика",
};

type RouteStepBridge = {
  route: string;
  primaryStep: {
    code: string;
    tool: string;
    goal: string;
    result: string;
  };
  nextStep?: {
    code: string;
    tool: string;
    goal: string;
    result: string;
  };
};

const ROUTE_STEP_BRIDGE: Record<
  DiagnosisChatMode,
  Record<string, RouteStepBridge>
> = {
  growth: {
    sales: {
      route: "МАРШРУТ Г",
      primaryStep: {
        code: "2.0",
        tool: "Аудит системы продаж",
        goal: "Диагностировать текущую систему",
        result: "Карта проблем в продажах",
      },
      nextStep: {
        code: "3.0",
        tool: "Воронка продаж + конверсии",
        goal: "Найти где теряются клиенты",
        result: "Конверсии на каждом этапе",
      },
    },
    product: {
      route: "МАРШРУТ Г",
      primaryStep: {
        code: "6.0",
        tool: "CJM + NPS",
        goal: "Понять путь и лояльность клиента",
        result: "Точки потери и болей клиента",
      },
      nextStep: {
        code: "4.0",
        tool: "STP + Tier-сегментация клиентов",
        goal: "Пересмотреть целевые сегменты",
        result: "Приоритетные сегменты и клиенты",
      },
    },
    decisions: {
      route: "МАРШРУТ Д",
      primaryStep: {
        code: "5.0",
        tool: "Матрица полномочий",
        goal: "Поэтапно передать решения",
        result: "План делегирования по уровням",
      },
      nextStep: {
        code: "6.0",
        tool: "RACI",
        goal: "Формализовать ответственность",
        result: "Матрица ответственности",
      },
    },
  },
  risk: {
    growth_slowdown: {
      route: "МАРШРУТ Г",
      primaryStep: {
        code: "1.0",
        tool: "PESTEL + Анализ конкурентов",
        goal: "Проверить внешние факторы",
        result: "Понять есть ли рыночные ограничения",
      },
      nextStep: {
        code: "2.0",
        tool: "Аудит системы продаж",
        goal: "Диагностировать текущую систему",
        result: "Карта проблем в продажах",
      },
    },
    loss_of_control: {
      route: "МАРШРУТ В",
      primaryStep: {
        code: "4.0",
        tool: "Диагностика оргструктуры + RACI",
        goal: "Увидеть структуру и ответственность as-is",
        result: "Органиграмма с зонами хаоса",
      },
      nextStep: {
        code: "8.0",
        tool: "OKR / KPI",
        goal: "Выстроить систему целей",
        result: "KPI у каждого руководителя",
      },
    },
    owner_overload: {
      route: "МАРШРУТ Д",
      primaryStep: {
        code: "1.0",
        tool: "Аудит роли собственника",
        goal: "Понять текущую ситуацию",
        result: "Карта где сейчас тратится время",
      },
      nextStep: {
        code: "5.0",
        tool: "Матрица полномочий",
        goal: "Поэтапно передать решения",
        result: "План делегирования по уровням",
      },
    },
  },
  start: {
    decisions: {
      route: "МАРШРУТ Д",
      primaryStep: {
        code: "5.0",
        tool: "Матрица полномочий",
        goal: "Поэтапно передать решения",
        result: "План делегирования по уровням",
      },
      nextStep: {
        code: "6.0",
        tool: "RACI",
        goal: "Формализовать ответственность",
        result: "Матрица ответственности",
      },
    },
    strategy: {
      route: "МАРШРУТ Б",
      primaryStep: {
        code: "6.0",
        tool: "Ansoff / Blue Ocean",
        goal: "Выбрать вектор роста",
        result: "Обоснованный приоритет роста",
      },
      nextStep: {
        code: "8.0",
        tool: "Стратегическая сессия",
        goal: "Согласовать стратегию с командой",
        result: "Зафиксированная и разделяемая стратегия",
      },
    },
    cadence: {
      route: "МАРШРУТ В",
      primaryStep: {
        code: "8.0",
        tool: "OKR / KPI",
        goal: "Выстроить систему целей",
        result: "KPI у каждого руководителя",
      },
      nextStep: {
        code: "7.0",
        tool: "Матрица полномочий",
        goal: "Делегировать решения",
        result: "Кто какие решения принимает",
      },
    },
  },
};

function getSortedScores(context: DiagnosisChatContext) {
  return Object.entries(context.scores)
    .filter((entry): entry is [string, number] => typeof entry[1] === "number")
    .sort((a, b) => a[1] - b[1]);
}

function getTopWeakLabels(context: DiagnosisChatContext) {
  return getSortedScores(context)
    .slice(0, 2)
    .map(([key]) => SCORE_LABELS[key] ?? key);
}

function getStrongestLabel(context: DiagnosisChatContext) {
  const sorted = getSortedScores(context).sort((a, b) => b[1] - a[1]);
  const top = sorted[0]?.[0];

  return top ? SCORE_LABELS[top] ?? top : null;
}

function buildFallbackDiagnosisChatReply(params: {
  context: DiagnosisChatContext;
  question: string;
}): DiagnosisChatReply {
  const question = params.question.trim().toLowerCase();
  const summary = params.context.summary;
  const firstStep = summary.first_steps[0] ?? "Зафиксируйте одно главное ограничение и назначьте владельца.";
  const strongest = summary.strengths[0] ?? "У бизнеса уже есть база, на которую можно опереться.";
  const risk = summary.why_now[0] ?? "Ключевое ограничение уже влияет на скорость решений и рост.";

  if (question.includes("главн") && question.includes("вывод")) {
    return {
      reply: summary.main_summary,
    };
  }

  if (question.includes("с чего начать") || question.includes("начать")) {
    return {
      reply: `Начните с этого: ${firstStep}`,
    };
  }

  if (question.includes("важнее") || question.includes("фокус")) {
    return {
      reply: `Сейчас важнее всего ${summary.main_focus.charAt(0).toLowerCase()}${summary.main_focus.slice(1)}`,
    };
  }

  if (question.includes("риск")) {
    return {
      reply: `Главный риск сейчас такой: ${risk}`,
    };
  }

  if (question.includes("рост")) {
    return {
      reply: `Рост сейчас ограничивает вот что: ${summary.why_now[0] ?? summary.main_focus}`,
    };
  }

  return {
    reply: `${summary.main_summary} ${strongest} ${firstStep}`,
  };
}

function buildScenarioIntro(params: {
  mode: DiagnosisChatMode;
  context: DiagnosisChatContext;
}): DiagnosisChatReply {
  const summary = params.context.summary;
  const firstWhy = summary.why_now[0] ?? summary.main_focus;
  const weakLabels = getTopWeakLabels(params.context);
  const strongestLabel = getStrongestLabel(params.context);
  const weakLead = weakLabels.length > 0 ? weakLabels.join(" и ") : "ключевом управленческом контуре";

  if (params.mode === "growth") {
    return {
      reply: `Главный тормоз роста сейчас в ${weakLead}. ${firstWhy.charAt(0).toLowerCase()}${firstWhy.slice(1)}${
        strongestLabel ? ` При этом на ${strongestLabel} уже можно опереться.` : ""
      } Выберите, где хотите уточнить это ограничение.`,
      mode: "growth",
      step: 1,
      quickReplies: SCENARIO_OPTIONS.growth,
    };
  }

  if (params.mode === "risk") {
    return {
      reply: `Главный риск сейчас идёт из ${weakLead}. ${firstWhy.charAt(0).toLowerCase()}${firstWhy.slice(1)} Давайте уточним, какой риск для вас важнее.`,
      mode: "risk",
      step: 1,
      quickReplies: SCENARIO_OPTIONS.risk,
    };
  }

  return {
    reply: `Начинать лучше с самого узкого места: ${weakLead}. ${summary.main_focus.charAt(0).toLowerCase()}${summary.main_focus.slice(1)} Выберите, через какой контур разбирать первый шаг.`,
    mode: "start",
    step: 1,
    quickReplies: SCENARIO_OPTIONS.start,
  };
}

function buildScenarioFollowUp(params: {
  mode: DiagnosisChatMode;
  selectedPath: string;
  context: DiagnosisChatContext;
}): DiagnosisChatReply {
  const summary = params.context.summary;
  const firstStep = summary.first_steps[0] ?? "Сегодня зафиксируйте одно главное ограничение.";
  const secondStep = summary.first_steps[1] ?? "Назначьте владельца и срок первого результата.";
  const weakLabels = getTopWeakLabels(params.context);
  const weakLead = weakLabels.length > 0 ? weakLabels.join(" и ") : "текущем ограничении";
  const routeBridge = ROUTE_STEP_BRIDGE[params.mode][params.selectedPath];

  const byMode: Record<DiagnosisChatMode, Record<string, string>> = {
    growth: {
      sales: `Рост сейчас упирается в ${weakLead}. Идите через ${routeBridge?.primaryStep.tool ?? "аудит системы продаж"}: цель — ${routeBridge?.primaryStep.goal ?? "разобрать текущее ограничение"}, на выходе — ${routeBridge?.primaryStep.result ?? "понятная карта проблемы"}. Следующий шаг: ${routeBridge?.nextStep?.goal ?? secondStep}`,
      product: `Рост сейчас упирается в ${weakLead}. Идите через ${routeBridge?.primaryStep.tool ?? "разбор продукта"}: цель — ${routeBridge?.primaryStep.goal ?? "понять, где теряется ценность"}, на выходе — ${routeBridge?.primaryStep.result ?? "понятная карта клиентских потерь"}. Следующий шаг: ${routeBridge?.nextStep?.goal ?? secondStep}`,
      decisions: `Рост сейчас упирается в ${weakLead}. Идите через ${routeBridge?.primaryStep.tool ?? "матрицу полномочий"}: цель — ${routeBridge?.primaryStep.goal ?? "разгрузить контур решений"}, на выходе — ${routeBridge?.primaryStep.result ?? "план передачи решений"}. Следующий шаг: ${routeBridge?.nextStep?.goal ?? secondStep}`,
    },
    risk: {
      growth_slowdown: `Главный риск здесь — замедление роста из-за ${weakLead}. Начните с шага ${routeBridge?.primaryStep.code ?? "1.0"} по маршруту ${routeBridge?.route ?? "рост"}: ${routeBridge?.primaryStep.goal ?? "проверить источник ограничения"}. На выходе нужен результат: ${routeBridge?.primaryStep.result ?? "ясная карта риска"}. Следующий шаг: ${routeBridge?.nextStep?.goal ?? firstStep}`,
      loss_of_control: `Главный риск здесь — потеря управляемости из-за ${weakLead}. Идите через ${routeBridge?.primaryStep.tool ?? "разбор структуры и ответственности"}: цель — ${routeBridge?.primaryStep.goal ?? "увидеть зоны хаоса"}, результат — ${routeBridge?.primaryStep.result ?? "понятная карта провалов управления"}. Следующий шаг: ${routeBridge?.nextStep?.goal ?? firstStep}`,
      owner_overload: `Главный риск здесь — перегруз собственника. Идите через ${routeBridge?.primaryStep.tool ?? "аудит роли собственника"}: цель — ${routeBridge?.primaryStep.goal ?? "понять, где собственник застрял в операционке"}, результат — ${routeBridge?.primaryStep.result ?? "карта точек перегруза"}. Следующий шаг: ${routeBridge?.nextStep?.goal ?? firstStep}`,
    },
    start: {
      decisions: `Начните с решений. Первый рабочий шаг — ${routeBridge?.primaryStep.tool ?? "матрица полномочий"}: ${routeBridge?.primaryStep.goal ?? "поэтапно передать решения"}. На выходе нужен ${routeBridge?.primaryStep.result ?? "план делегирования"}. Следующий шаг: ${routeBridge?.nextStep?.goal ?? secondStep}`,
      strategy: `Начните со стратегии. Первый рабочий шаг — ${routeBridge?.primaryStep.tool ?? "выбор вектора роста"}: ${routeBridge?.primaryStep.goal ?? "собрать один приоритет роста"}. На выходе нужен ${routeBridge?.primaryStep.result ?? "обоснованный приоритет"}. Следующий шаг: ${routeBridge?.nextStep?.goal ?? secondStep}`,
      cadence: `Начните с регулярного управления. Первый рабочий шаг — ${routeBridge?.primaryStep.tool ?? "ритм управления"}: ${routeBridge?.primaryStep.goal ?? "собрать систему целей и ритм контроля"}. На выходе нужен ${routeBridge?.primaryStep.result ?? "рабочий ритм управления"}. Следующий шаг: ${routeBridge?.nextStep?.goal ?? secondStep}`,
    },
  };

  return {
    reply:
      byMode[params.mode][params.selectedPath] ??
      `${summary.main_summary} Начните с этого: ${firstStep}`,
    mode: params.mode,
    step: 2,
    quickReplies: [],
  };
}

async function buildScenarioFollowUpFromCanonical(params: {
  mode: DiagnosisChatMode;
  selectedPath: string;
  context: DiagnosisChatContext;
}) {
  const result = await buildHybridRecommendation({
    mode: params.mode,
    selectedPath: params.selectedPath,
    company: params.context.company,
    scores: params.context.scores,
    summary: params.context.summary,
  });

  if (!result.hybridRecommendation) {
    return null;
  }

  const primary = result.hybridRecommendation.primaryRecommendation;
  const expansion = result.hybridRecommendation.optionalExpansions[0] ?? null;
  const toolHandoff = result.hybridRecommendation.toolHandoff ?? null;
  const details = primary.details ?? {};
  const goal = details.goal ?? "разобрать ключевое ограничение";
  const outcome = details.result ?? "понятный следующий шаг";
  const nextStep = details.nextStepGoal ?? params.context.summary.first_steps[1] ?? "закрепить следующий шаг";
  const bridgeGoal = expansion?.details?.goal ?? null;
  const bridgeOutcome = expansion?.details?.result ?? null;
  const bridgeText = expansion
    ? ` Перед этим сделайте ${expansion.title}${
        bridgeGoal ? `: ${bridgeGoal}` : ""
      }${bridgeOutcome ? `. На выходе — ${bridgeOutcome}` : ""}.`
    : "";
  const handoffText = toolHandoff
    ? ` Если нужен один конкретный инструмент, возьмите ${toolHandoff.tool.title}${
        toolHandoff.tool.details?.result ? ` — на выходе получите ${toolHandoff.tool.details.result}` : ""
      }.`
    : "";
  const toolContext = toolHandoff?.toolContext ?? null;
  const toolContextText = toolContext
    ? ` Почему сейчас: ${toolContext.whyThisToolNow} Что он прояснит: ${toolContext.whatItClarifies} Какой результат даст: ${toolContext.expectedOutputType}.`
    : "";

  return {
    reply: `${result.hybridRecommendation.reasoning.canonicalReason} Основной шаг — ${primary.title}: цель — ${goal}, на выходе — ${outcome}.${bridgeText}${handoffText}${toolContextText} Следующий шаг: ${nextStep}.`,
    mode: params.mode,
    step: 2,
    quickReplies: [],
  };
}

function getStructuredOutput(response: Record<string, unknown>) {
  const outputText = response.output_text;

  if (typeof outputText === "string" && outputText.trim().length > 0) {
    return outputText;
  }

  const output = response.output;

  if (!Array.isArray(output)) {
    return null;
  }

  for (const item of output) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const content = (item as { content?: unknown }).content;

    if (!Array.isArray(content)) {
      continue;
    }

    for (const part of content) {
      if (!part || typeof part !== "object") {
        continue;
      }

      const text = (part as { text?: unknown }).text;

      if (typeof text === "string" && text.trim().length > 0) {
        return text;
      }
    }
  }

  return null;
}

export async function generateDiagnosisChatReply(params: {
  context: DiagnosisChatContext;
  question: string;
  mode?: DiagnosisChatMode;
  step?: number;
  selectedPath?: string;
}): Promise<DiagnosisChatReply | null> {
  if (params.mode && (params.step ?? 1) === 1 && !params.selectedPath) {
    return buildScenarioIntro({
      mode: params.mode,
      context: params.context,
    });
  }

  if (params.mode && (params.step ?? 1) >= 2 && params.selectedPath) {
    return (
      (await buildScenarioFollowUpFromCanonical({
        mode: params.mode,
        selectedPath: params.selectedPath,
        context: params.context,
      })) ??
      buildScenarioFollowUp({
        mode: params.mode,
        selectedPath: params.selectedPath,
        context: params.context,
      })
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const model = getOpenAiModel();
  const temperature = getOpenAiNumberEnv("OPENAI_TEMPERATURE", 0.3);
  const maxOutputTokens = getOpenAiNumberEnv("OPENAI_MAX_TOKENS", 800);
  const promptVersion = process.env.OPENAI_SYSTEM_PROMPT_VERSION ?? "v1";

  if (!apiKey) {
    return buildFallbackDiagnosisChatReply(params);
  }

  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature,
        max_output_tokens: maxOutputTokens,
        input: [
          {
            role: "system",
            content: DIAGNOSIS_CHAT_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: JSON.stringify(
              {
                context: params.context,
                question: params.question,
                mode: params.mode ?? null,
                step: params.step ?? null,
                selected_path: params.selectedPath ?? null,
              },
              null,
              2,
            ),
          },
        ],
        metadata: {
          prompt_version: promptVersion,
          feature: "diagnosis_ai_chat",
        },
        text: {
          format: {
            type: "json_schema",
            name: "diagnosis_ai_chat",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                reply: {
                  type: "string",
                },
              },
              required: ["reply"],
            },
          },
        },
      }),
    });

    if (!response.ok) {
      console.error("DIAGNOSIS CHAT ERROR:", await response.text());
      return buildFallbackDiagnosisChatReply(params);
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const text = getStructuredOutput(payload);

    if (!text) {
      return buildFallbackDiagnosisChatReply(params);
    }

    const json = JSON.parse(text) as { answer?: unknown; reply?: unknown };
    const parsed = diagnosisChatReplySchema.safeParse({
      reply:
        typeof json.reply === "string"
          ? json.reply
          : typeof json.answer === "string"
            ? json.answer
            : "",
    });

    if (!parsed.success) {
      console.error("DIAGNOSIS CHAT PARSE ERROR:", parsed.error.flatten());
      return buildFallbackDiagnosisChatReply(params);
    }

    return parsed.data;
  } catch (error) {
    console.error("DIAGNOSIS CHAT ERROR:", error);
    return buildFallbackDiagnosisChatReply(params);
  }
}
