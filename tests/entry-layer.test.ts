import test from "node:test";
import assert from "node:assert/strict";

import { buildDiagnosisDeepLink } from "@/lib/entry/deeplink";
import { buildEntryOfferSessionState } from "@/lib/entry/offer-session-state";

test("diagnosis deeplink includes telegram metadata", () => {
  const url = buildDiagnosisDeepLink({
    suggestedTool: "role-clarity-checklist",
  });

  assert.match(url, /source=telegram_entry/);
  assert.match(url, /suggested_tool=role-clarity-checklist/);
});

test("diagnosis deeplink keeps intake continuity", () => {
  const url = buildDiagnosisDeepLink({
    intakeGoal: "Подготовить бизнес к продаже без потери стоимости.",
    intakeSymptoms: ["Непрозрачные цифры", "Зависимость от собственника"],
  });

  assert.match(url, /intake_goal=/);
  assert.match(url, /intake_symptoms=/);
});

test("/start resets entry session to a fresh offer state", () => {
  const state = buildEntryOfferSessionState(42, "2026-04-21T06:50:00.000Z");

  assert.equal(state.telegramUserId, 42);
  assert.equal(state.stage, "initial");
  assert.equal(state.initialMessage, "__entry_offer__");
  assert.deepEqual(state.clarifyingAnswers, []);
  assert.equal(state.turnCount, 1);
  assert.equal(state.lastQuestionKey, null);
  assert.equal(state.lastQuestionText, null);
});
