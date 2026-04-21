import type { InternalEntrySessionState } from "@/lib/entry/session-state";

export function buildEntryOfferSessionState(
  telegramUserId: number,
  now = new Date().toISOString(),
): InternalEntrySessionState {
  return {
    telegramUserId,
    stage: "initial",
    initialMessage: "__entry_offer__",
    clarifyingAnswers: [],
    turnCount: 1,
    createdAt: now,
    updatedAt: now,
    lastQuestionKey: null,
    lastQuestionText: null,
  };
}
