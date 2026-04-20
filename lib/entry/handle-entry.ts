import "server-only";

import { buildToolDeepLink } from "@/lib/entry/deeplink";
import {
  POST_WEBSITE_SCREENING_REQUEST_KEY,
  POST_WEBSITE_SCREENING_REQUEST_TEXT,
} from "@/lib/entry/constants";
import { runCoreEntryConsultant } from "@/lib/entry/core-consultant";
import {
  trackEntryCompleted,
  trackEntryDropped,
  trackEntryQuestionAsked,
  trackEntryRouted,
  trackEntryStarted,
} from "@/lib/analytics/entry-analytics";
import { persistTelegramDiagnosticCase } from "@/lib/telegram/diagnostic-case";
import { persistTelegramWebsiteScreening } from "@/lib/website/website-screening";
import {
  getEntrySessionByTelegramUserId,
  upsertEntrySession,
  type InternalEntrySessionState,
} from "@/lib/entry/session-state";
import type { TelegramEntryResponse } from "@/types/api";
import type {
  EntryMode,
  EntryRoutingDecision,
  TelegramEntryReply,
} from "@/types/domain";

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

function buildSessionMode(
  action: "capability" | "website_screening" | "tool_navigation" | "ask_question" | "diagnostic_result",
): EntryMode {
  if (action === "tool_navigation") {
    return "tool_discovery";
  }

  if (action === "capability") {
    return "unclear";
  }

  return "problem_first";
}

function normalizeDecision(decision: EntryRoutingDecision, params: {
  mode: string;
  intent: string;
  toolSlug?: string | null;
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
  return decision;
}

function mapCoreModeToDecision(params: {
  action: "capability" | "website_screening" | "tool_navigation" | "ask_question" | "diagnostic_result";
  rationale: string;
  question?: string | null;
  toolSlug?: string | null;
  toolTitle?: string | null;
  mode: string;
  intent: string;
}) {
  if (params.action === "website_screening") {
    return normalizeDecision(
      {
        action: "route_to_website_screening",
        reason: params.rationale,
      },
      params,
    );
  }

  if (params.action === "diagnostic_result") {
    return normalizeDecision(
      {
        action: "route_to_diagnosis",
        reason: params.rationale,
      },
      params,
    );
  }

  if (params.action === "tool_navigation" && params.toolSlug && params.toolTitle) {
    return normalizeDecision(
      {
        action: "route_to_tool",
        toolSuggestion: {
          slug: params.toolSlug,
          title: params.toolTitle,
          url: buildToolDeepLink(params.toolSlug),
        },
        reason: params.rationale,
      },
      params,
    );
  }

  return {
    action: "ask_question" as const,
    nextQuestion: params.question
      ? {
          key: "core_consultant_question",
          text: params.question,
        }
      : undefined,
    reason: params.rationale,
  };
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
  const coreDecision = await runCoreEntryConsultant({
    rawText: workingText,
    session: continueSession ? existingSession : null,
  });
  const mode = buildSessionMode(coreDecision.action);
  const turnCount = continueSession && existingSession ? existingSession.turnCount + 1 : 1;

  if (!continueSession) {
    await trackEntryStarted({
      telegramUserId: params.telegramUserId,
      entryMode: mode,
      rawText: text,
    });
  }

  let normalizedDecision: EntryRoutingDecision;

  normalizedDecision = mapCoreModeToDecision({
    action: coreDecision.action,
    rationale: coreDecision.rationale,
    question: coreDecision.question ?? null,
    toolSlug: coreDecision.toolSlug ?? null,
    toolTitle: coreDecision.toolTitle ?? null,
    mode,
    intent: "unclear",
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

  const isWebsiteScreening = normalizedDecision.action === "route_to_website_screening";
  const isCapabilityDecision = coreDecision.action === "capability";

  let persistedSession = await upsertEntrySession({
    telegramUserId: params.telegramUserId,
    stage:
      isCapabilityDecision
        ? "ready_for_routing"
        : isWebsiteScreening ||
            normalizedDecision.action === "ask_question" ||
            normalizedDecision.action === "confirm_tool_then_route"
          ? "clarifying"
          : "ready_for_routing",
    entryMode: mode,
    initialMessage: continueSession && existingSession ? existingSession.initialMessage : text,
    detectedIntent: null,
    toolConfidence: undefined,
    conversationFrame: {
      goalHypotheses: [],
      symptomHints: [],
      currentDiagnosticFocus: null,
    },
    activeUnknown: null,
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
    intent: null,
  });

  let reply: TelegramEntryReply = {
    text: coreDecision.replyText,
    stage:
      normalizedDecision.action === "ask_question" || isWebsiteScreening
        ? "clarifying"
        : "ready_for_routing",
  };

  if (normalizedDecision.action === "route_to_website_screening") {
    if (!coreDecision.websiteScreening) {
      throw new Error("Unified consultant selected website_screening without screening payload.");
    }

    const caseUrl = await persistTelegramWebsiteScreening({
      telegramUserId: params.telegramUserId,
      telegramUsername: params.telegramUsername,
      firstName: params.firstName,
      lastName: params.lastName,
      rawText: workingText,
      result: coreDecision.websiteScreening,
      replyText: coreDecision.replyText,
    });
    reply = {
      text: coreDecision.replyText,
      cta: {
        label: "Открыть сохранённый скрининг",
        url: caseUrl,
      },
      stage: "clarifying",
    };
  } else if (normalizedDecision.action === "route_to_tool" && normalizedDecision.toolSuggestion) {
    reply = {
      text: coreDecision.replyText,
      cta: {
        label: "Открыть инструмент",
        url: normalizedDecision.toolSuggestion.url,
      },
      stage: "ready_for_routing",
    };
  } else if (normalizedDecision.action === "route_to_diagnosis") {
    if (!coreDecision.diagnosticResult) {
      throw new Error("Unified consultant selected diagnostic_result without structured result.");
    }

    reply = await persistTelegramDiagnosticCase({
      telegramUserId: params.telegramUserId,
      telegramUsername: params.telegramUsername,
      firstName: params.firstName,
      lastName: params.lastName,
      workingText,
      session: persistedSession,
      intent: null,
      result: coreDecision.diagnosticResult,
      replyText: coreDecision.replyText,
    });
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
    intent: null,
    hypothesis: null,
    decision: normalizedDecision,
  };
}
