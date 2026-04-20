import "server-only";

import { buildDiagnosisDeepLink, buildToolDeepLink } from "@/lib/entry/deeplink";
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

  const normalizedDecision = normalizeDecision(decisionResult.decision, {
    mode,
    intent: intent.primaryIntent,
    toolSlug:
      decisionResult.decision.toolSuggestion?.slug ??
      decisionResult.alternativeTool?.slug ??
      decisionResult.matchedTool?.slug ??
      undefined,
  });

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

  const persistedSession = await upsertEntrySession({
    telegramUserId: params.telegramUserId,
    stage:
      normalizedDecision.action === "ask_question" ||
      normalizedDecision.action === "confirm_tool_then_route"
        ? "clarifying"
        : "ready_for_routing",
    entryMode: mode,
    initialMessage: continueSession && existingSession ? existingSession.initialMessage : text,
    detectedIntent: intent,
    toolConfidence: decisionResult.toolConfidence,
    clarifyingAnswers,
    turnCount,
    createdAt: existingSession?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastQuestionKey: normalizedDecision.nextQuestion?.key ?? null,
    lastQuestionText: normalizedDecision.nextQuestion?.text ?? null,
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
    (normalizedDecision.action === "ask_question" ||
      normalizedDecision.action === "confirm_tool_then_route") &&
    normalizedDecision.nextQuestion
  ) {
    await trackEntryQuestionAsked({
      telegramUserId: params.telegramUserId,
      session: persistedSession,
      questionKey: normalizedDecision.nextQuestion.key,
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
