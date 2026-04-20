import "server-only";

import { buildDiagnosisDeepLink, buildToolDeepLink } from "@/lib/entry/deeplink";
import {
  POST_WEBSITE_SCREENING_REQUEST_KEY,
  POST_WEBSITE_SCREENING_REQUEST_TEXT,
} from "@/lib/entry/constants";
import { buildConversationFrame } from "@/lib/entry/conversation-frame";
import {
  trackEntryCompleted,
  trackEntryDropped,
  trackEntryModeDetected,
  trackEntryQuestionAsked,
  trackEntryRouted,
  trackEntryStarted,
  trackEntryToolNotFound,
} from "@/lib/analytics/entry-analytics";
import { detectEntryIntent, detectEntryMode, normalizeEntryText } from "@/lib/entry/detection";
import { buildEntryHypothesis } from "@/lib/entry/hypothesis";
import { planEntryIntake } from "@/lib/entry/intake-planner";
import { buildTelegramEntryReply } from "@/lib/entry/reply";
import { decideEntryRouting } from "@/lib/entry/routing";
import { runTelegramDiagnosticCase } from "@/lib/telegram/diagnostic-case";
import { runTelegramWebsiteScreening } from "@/lib/website/website-screening";
import {
  getEntrySessionByTelegramUserId,
  upsertEntrySession,
  type InternalEntrySessionState,
} from "@/lib/entry/session-state";
import {
  captureToolDemandSignal,
  notifyAdminAboutToolDemand,
} from "@/lib/entry/tool-demand-signal";
import type { TelegramEntryResponse } from "@/types/api";
import type { EntryRoutingDecision } from "@/types/domain";

function shouldContinueSession(session: InternalEntrySessionState | null) {
  if (!session || session.stage !== "clarifying") {
    return false;
  }

  const ageMs = Date.now() - new Date(session.updatedAt).getTime();
  return ageMs <= 1000 * 60 * 60 * 24;
}

function getSessionAgeHours(session: InternalEntrySessionState) {
  return Math.max(1, Math.round((Date.now() - new Date(session.updatedAt).getTime()) / (1000 * 60 * 60)));
}

function buildWorkingText(
  session: InternalEntrySessionState | null,
  currentMessage: string,
) {
  if (!session) {
    return currentMessage;
  }

  if (session.lastQuestionKey === POST_WEBSITE_SCREENING_REQUEST_KEY) {
    return currentMessage;
  }

  return [
    session.initialMessage,
    ...session.clarifyingAnswers.map((item) => item.answerText),
    currentMessage,
  ]
    .filter(Boolean)
    .join("\n");
}

function normalizeDecision(decision: EntryRoutingDecision, params: {
  mode: string;
  intent: string;
  toolSlug?: string;
}): EntryRoutingDecision {
  if (decision.action === "route_to_tool" && decision.toolSuggestion) {
    return {
      ...decision,
      toolSuggestion: {
        ...decision.toolSuggestion,
        url: buildToolDeepLink(decision.toolSuggestion.slug),
      },
    };
  }

  if (decision.action === "route_to_diagnosis") {
    return {
      ...decision,
      toolSuggestion: {
        slug: "diagnosis",
        title: "Диагностика",
        url: buildDiagnosisDeepLink({
          entryMode: params.mode,
          entryIntent: params.intent,
          suggestedTool: params.toolSlug,
        }),
      },
    };
  }

  return decision;
}

export async function handleTelegramEntry(params: {
  telegramUserId: number;
  telegramUsername?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  text: string;
}): Promise<TelegramEntryResponse> {
  const text = params.text.trim();
  const existingSession = await getEntrySessionByTelegramUserId(params.telegramUserId);
  const continueSession = shouldContinueSession(existingSession);

  if (existingSession && !continueSession && existingSession.stage === "clarifying") {
    await trackEntryDropped({
      telegramUserId: params.telegramUserId,
      previousSession: existingSession,
      resumedAfterHours: getSessionAgeHours(existingSession),
    });
  }

  const workingText = buildWorkingText(continueSession ? existingSession : null, text);
  const mode = detectEntryMode(workingText);
  const intent = detectEntryIntent(workingText, mode);
  const hypothesis = mode === "problem_first" ? buildEntryHypothesis(intent) : null;
  const turnCount = continueSession && existingSession ? existingSession.turnCount + 1 : 1;
  const frameState = buildConversationFrame({
    mode,
    intent,
    rawText: workingText,
    session: continueSession ? existingSession : null,
  });

  if (!continueSession) {
    await trackEntryStarted({
      telegramUserId: params.telegramUserId,
      entryMode: mode,
      rawText: text,
    });
  }

  const decisionResult = await decideEntryRouting({
    mode,
    intent,
    hypothesis,
    rawText: workingText,
    turnCount,
    session: continueSession ? existingSession : null,
  });

  const intakePlan = planEntryIntake({
    mode,
    intent,
    rawText: workingText,
    turnCount,
    session: continueSession ? existingSession : null,
  });

  const normalizedDecision = normalizeDecision(decisionResult.decision, {
    mode,
    intent: intent.primaryIntent,
    toolSlug:
      decisionResult.decision.toolSuggestion?.slug ??
      decisionResult.alternativeTool?.slug ??
      decisionResult.matchedTool?.slug ??
      undefined,
  });

  if (normalizedDecision.action === "ask_question" && !normalizedDecision.nextQuestion) {
    normalizedDecision.nextQuestion = intakePlan.nextQuestion;
  }

  if (
    normalizedDecision.action === "route_to_diagnosis" &&
    intakePlan.shouldAskBeforeDiagnosis &&
    intakePlan.nextQuestion
  ) {
    normalizedDecision.action = "ask_question";
    normalizedDecision.nextQuestion = intakePlan.nextQuestion;
    normalizedDecision.toolSuggestion = undefined;
    normalizedDecision.reason =
      "Сигнала уже достаточно для движения вперёд, но один уточняющий вопрос поможет не перепутать цель клиента и корневой симптом.";
  }

  const clarifyingAnswers =
    continueSession && existingSession && existingSession.lastQuestionKey && existingSession.lastQuestionText
      ? [
          ...existingSession.clarifyingAnswers,
          {
            questionKey: existingSession.lastQuestionKey,
            questionText: existingSession.lastQuestionText,
            answerText: text,
          },
        ]
      : [];

  const isWebsiteScreening = normalizedDecision.action === "route_to_website_screening";

  let persistedSession = await upsertEntrySession({
    telegramUserId: params.telegramUserId,
    stage:
      isWebsiteScreening ||
      normalizedDecision.action === "ask_question" ||
      normalizedDecision.action === "confirm_tool_then_route"
        ? "clarifying"
        : "ready_for_routing",
    entryMode: mode,
    initialMessage: continueSession && existingSession ? existingSession.initialMessage : text,
    detectedIntent: intent,
    toolConfidence: decisionResult.toolConfidence,
    conversationFrame: frameState.conversationFrame,
    activeUnknown: frameState.activeUnknown,
    clarifyingAnswers,
    turnCount,
    createdAt: existingSession?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastQuestionKey:
      isWebsiteScreening
        ? POST_WEBSITE_SCREENING_REQUEST_KEY
        : normalizedDecision.nextQuestion?.key ?? null,
    lastQuestionText:
      isWebsiteScreening
        ? POST_WEBSITE_SCREENING_REQUEST_TEXT
        : normalizedDecision.nextQuestion?.text ?? null,
  } as InternalEntrySessionState);

  await trackEntryModeDetected({
    telegramUserId: params.telegramUserId,
    session: persistedSession,
    intent,
  });

  if (decisionResult.unsupportedToolRequested) {
    const signal = {
      toolQuery: text,
      normalizedTool: normalizeEntryText(text) || undefined,
      entryMode: mode,
      detectedIntent: intent.primaryIntent,
      confidence: decisionResult.toolConfidence ?? "low",
      telegramUserId: params.telegramUserId,
      createdAt: new Date().toISOString(),
    } as const;

    await captureToolDemandSignal(signal);
    void notifyAdminAboutToolDemand(signal);
    await trackEntryToolNotFound({
      telegramUserId: params.telegramUserId,
      session: persistedSession,
      toolQuery: text,
      normalizedTool: normalizeEntryText(text) || undefined,
      detectedIntent: intent.primaryIntent,
      confidence: decisionResult.toolConfidence ?? "low",
      alternativeToolSlug: decisionResult.alternativeTool?.slug,
    });
  }

  if (
    ((normalizedDecision.action === "ask_question" ||
      normalizedDecision.action === "confirm_tool_then_route") &&
      normalizedDecision.nextQuestion) ||
    isWebsiteScreening
  ) {
    await trackEntryQuestionAsked({
      telegramUserId: params.telegramUserId,
      session: persistedSession,
      questionKey:
        isWebsiteScreening
          ? POST_WEBSITE_SCREENING_REQUEST_KEY
          : (normalizedDecision.nextQuestion?.key ?? POST_WEBSITE_SCREENING_REQUEST_KEY),
    });
  }

  await trackEntryRouted({
    telegramUserId: params.telegramUserId,
    session: persistedSession,
    decision: normalizedDecision,
    intent,
  });

  let reply = buildTelegramEntryReply({
    session: persistedSession,
    decision: normalizedDecision,
    hypothesis,
  });

  if (normalizedDecision.action === "route_to_website_screening") {
    reply = await runTelegramWebsiteScreening({
      telegramUserId: params.telegramUserId,
      telegramUsername: params.telegramUsername,
      firstName: params.firstName,
      lastName: params.lastName,
      rawText: workingText,
      entryMode: mode,
      entryIntent: intent.primaryIntent,
    });
  } else if (normalizedDecision.action === "route_to_diagnosis") {
    try {
      reply = await runTelegramDiagnosticCase({
        telegramUserId: params.telegramUserId,
        telegramUsername: params.telegramUsername,
        firstName: params.firstName,
        lastName: params.lastName,
        workingText,
        session: persistedSession,
        intent,
      });
    } catch (error) {
      console.error("TELEGRAM_DIAGNOSTIC_CASE_FAILED", {
        telegramUserId: params.telegramUserId,
        message: error instanceof Error ? error.message : "unknown_error",
      });
    }
  }

  if (reply.stage === "ready_for_routing") {
    await trackEntryCompleted({
      telegramUserId: params.telegramUserId,
      session: persistedSession,
      decision: normalizedDecision,
    });
  }

  return {
    reply,
    session: persistedSession,
    intent,
    hypothesis,
    decision: normalizedDecision,
  };
}
