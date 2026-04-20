import "server-only";

import { trackEvent } from "@/lib/analytics/track-event";
import type { EntryRoutingDecision, EntrySessionState } from "@/types/domain";

export async function trackEntryStarted(params: {
  telegramUserId: number;
  rawText: string;
}) {
  await trackEvent({
    event: "entry_started",
    telegramUserId: params.telegramUserId,
    entrySessionTelegramUserId: params.telegramUserId,
    payload: {
      rawTextLength: params.rawText.trim().length,
    },
  });
}

export async function trackEntryQuestionAsked(params: {
  telegramUserId: number;
  session: EntrySessionState;
  questionKey: string;
}) {
  await trackEvent({
    event: "entry_question_asked",
    telegramUserId: params.telegramUserId,
    entrySessionTelegramUserId: params.telegramUserId,
    payload: {
      questionKey: params.questionKey,
      turnCount: params.session.turnCount,
    },
  });
}

export async function trackEntryRouted(params: {
  telegramUserId: number;
  session: EntrySessionState;
  decision: EntryRoutingDecision;
}) {
  if (params.decision.action === "route_to_website_screening") {
    await trackEvent({
      event: "entry_routed_to_website_screening",
      telegramUserId: params.telegramUserId,
      entrySessionTelegramUserId: params.telegramUserId,
      payload: {
        turnCount: params.session.turnCount,
        reason: params.decision.reason,
      },
    });
    return;
  }

  if (params.decision.action === "route_to_tool" && params.decision.toolSuggestion) {
    await trackEvent({
      event: "entry_routed_to_tool",
      telegramUserId: params.telegramUserId,
      entrySessionTelegramUserId: params.telegramUserId,
      payload: {
        toolSlug: params.decision.toolSuggestion.slug,
        turnCount: params.session.turnCount,
        reason: params.decision.reason,
      },
    });
    return;
  }

  if (params.decision.action === "route_to_diagnosis") {
    await trackEvent({
      event: "entry_routed_to_diagnosis",
      telegramUserId: params.telegramUserId,
      entrySessionTelegramUserId: params.telegramUserId,
      payload: {
        turnCount: params.session.turnCount,
        reason: params.decision.reason,
        suggestedTool: params.decision.toolSuggestion?.slug,
      },
    });
  }
}

export async function trackEntryToolNotFound(params: {
  telegramUserId: number;
  session: EntrySessionState;
  toolQuery: string;
  normalizedTool?: string;
  confidence: string;
  alternativeToolSlug?: string;
}) {
  await trackEvent({
    event: "entry_tool_not_found",
    telegramUserId: params.telegramUserId,
    entrySessionTelegramUserId: params.telegramUserId,
    payload: {
      confidence: params.confidence,
      toolQuery: params.toolQuery,
      normalizedTool: params.normalizedTool,
      alternativeToolSlug: params.alternativeToolSlug,
    },
  });
}

export async function trackEntryCompleted(params: {
  telegramUserId: number;
  session: EntrySessionState;
  decision: EntryRoutingDecision;
}) {
  await trackEvent({
    event: "entry_completed",
    telegramUserId: params.telegramUserId,
    entrySessionTelegramUserId: params.telegramUserId,
    payload: {
      action: params.decision.action,
      stage: params.session.stage,
      turnCount: params.session.turnCount,
    },
  });
}

export async function trackEntryDropped(params: {
  telegramUserId: number;
  previousSession: EntrySessionState;
  resumedAfterHours: number;
}) {
  await trackEvent({
    event: "entry_dropped",
    telegramUserId: params.telegramUserId,
    entrySessionTelegramUserId: params.telegramUserId,
    payload: {
      previousStage: params.previousSession.stage,
      previousTurnCount: params.previousSession.turnCount,
      resumedAfterHours: params.resumedAfterHours,
    },
  });
}
