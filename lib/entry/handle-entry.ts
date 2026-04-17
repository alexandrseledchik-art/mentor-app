import "server-only";

import { buildDiagnosisDeepLink, buildToolDeepLink } from "@/lib/entry/deeplink";
import { detectEntryIntent, detectEntryMode, normalizeEntryText } from "@/lib/entry/detection";
import { buildEntryHypothesis } from "@/lib/entry/hypothesis";
import { buildTelegramEntryReply } from "@/lib/entry/reply";
import { decideEntryRouting } from "@/lib/entry/routing";
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
  text: string;
}): Promise<TelegramEntryResponse> {
  const text = params.text.trim();
  const existingSession = await getEntrySessionByTelegramUserId(params.telegramUserId);
  const continueSession = shouldContinueSession(existingSession);
  const workingText = buildWorkingText(continueSession ? existingSession : null, text);
  const mode = detectEntryMode(workingText);
  const intent = detectEntryIntent(workingText, mode);
  const hypothesis = mode === "problem_first" ? buildEntryHypothesis(intent) : null;
  const turnCount = continueSession && existingSession ? existingSession.turnCount + 1 : 1;

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
  }

  const reply = buildTelegramEntryReply({
    session: persistedSession,
    decision: normalizedDecision,
    hypothesis,
  });

  return {
    reply,
    session: persistedSession,
    intent,
    hypothesis,
    decision: normalizedDecision,
  };
}
