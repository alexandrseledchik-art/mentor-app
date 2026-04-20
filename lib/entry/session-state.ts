import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/db";
import type {
  EntryConversationFrame,
  EntryIntent,
  EntryMode,
  EntrySessionState,
  ToolConfidence,
} from "@/types/domain";

type EntrySessionRow = Database["public"]["Tables"]["entry_sessions"]["Row"];

type ClarifyingAnswer = EntrySessionState["clarifyingAnswers"][number];

export type InternalEntrySessionState = EntrySessionState & {
  lastQuestionKey: string | null;
  lastQuestionText: string | null;
};

const EMPTY_CONVERSATION_FRAME: EntryConversationFrame = {
  goalHypotheses: [],
  symptomHints: [],
  currentDiagnosticFocus: null,
};

function isLegacyEntrySessionSchemaError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const message = "message" in error ? String(error.message ?? "") : "";

  return (
    message.includes("conversation_frame") ||
    message.includes("active_unknown")
  );
}

function mapEntrySession(row: EntrySessionRow): InternalEntrySessionState {
  const clarifyingAnswers = Array.isArray(row.clarifying_answers)
    ? row.clarifying_answers
        .filter((item): item is ClarifyingAnswer => Boolean(item) && typeof item === "object")
        .map((item) => ({
          questionKey: String((item as { questionKey?: unknown }).questionKey ?? ""),
          questionText: String((item as { questionText?: unknown }).questionText ?? ""),
          answerText: String((item as { answerText?: unknown }).answerText ?? ""),
        }))
        .filter((item) => item.questionKey && item.questionText && item.answerText)
    : [];

  const conversationFrame =
    row.conversation_frame && typeof row.conversation_frame === "object"
      ? {
          goalHypotheses: Array.isArray((row.conversation_frame as { goalHypotheses?: unknown }).goalHypotheses)
            ? ((row.conversation_frame as { goalHypotheses?: unknown[] }).goalHypotheses ?? [])
                .map((item) => String(item ?? "").trim())
                .filter(Boolean)
                .slice(0, 4)
            : [],
          symptomHints: Array.isArray((row.conversation_frame as { symptomHints?: unknown }).symptomHints)
            ? ((row.conversation_frame as { symptomHints?: unknown[] }).symptomHints ?? [])
                .map((item) => String(item ?? "").trim())
                .filter(Boolean)
                .slice(0, 6)
            : [],
          currentDiagnosticFocus:
            typeof (row.conversation_frame as { currentDiagnosticFocus?: unknown }).currentDiagnosticFocus === "string"
              ? String((row.conversation_frame as { currentDiagnosticFocus?: unknown }).currentDiagnosticFocus)
              : null,
        }
      : EMPTY_CONVERSATION_FRAME;

  return {
    telegramUserId: row.telegram_user_id,
    stage: row.stage as EntrySessionState["stage"],
    entryMode: row.entry_mode as EntryMode,
    initialMessage: row.initial_message,
    detectedIntent:
      row.detected_intent && typeof row.detected_intent === "object"
        ? (row.detected_intent as unknown as EntryIntent)
        : null,
    toolConfidence: (row.tool_confidence as ToolConfidence | null) ?? undefined,
    conversationFrame,
    activeUnknown: row.active_unknown,
    clarifyingAnswers,
    turnCount: row.turn_count,
    lastQuestionKey: row.last_question_key,
    lastQuestionText: row.last_question_text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getEntrySessionByTelegramUserId(telegramUserId: number) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("entry_sessions")
    .select("*")
    .eq("telegram_user_id", telegramUserId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapEntrySession(data);
}

export async function upsertEntrySession(state: EntrySessionState) {
  const supabase = getSupabaseAdminClient();
  const internalState = state as InternalEntrySessionState;
  const basePayload = {
    telegram_user_id: state.telegramUserId,
    stage: state.stage,
    entry_mode: state.entryMode,
    initial_message: state.initialMessage,
    last_question_key: internalState.lastQuestionKey ?? null,
    last_question_text: internalState.lastQuestionText ?? null,
    detected_intent: (state.detectedIntent ?? null) as Json,
    tool_confidence: state.toolConfidence ?? null,
    clarifying_answers: state.clarifyingAnswers as unknown as Json,
    turn_count: state.turnCount,
    updated_at: new Date().toISOString(),
  };

  const nextSchemaPayload = {
    ...basePayload,
    conversation_frame: state.conversationFrame as unknown as Json,
    active_unknown: state.activeUnknown ?? null,
  };

  let { data, error } = await supabase
    .from("entry_sessions")
    .upsert([nextSchemaPayload], { onConflict: "telegram_user_id" })
    .select("*")
    .single();

  if (error && isLegacyEntrySessionSchemaError(error)) {
    console.warn("ENTRY_SESSION_LEGACY_SCHEMA_FALLBACK");

    const legacyResult = await supabase
      .from("entry_sessions")
      .upsert([basePayload], { onConflict: "telegram_user_id" })
      .select("*")
      .single();

    data = legacyResult.data;
    error = legacyResult.error;
  }

  if (error || !data) {
    throw error ?? new Error("Failed to upsert entry session.");
  }

  return mapEntrySession(data);
}
