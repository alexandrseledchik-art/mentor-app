import test from "node:test";
import assert from "node:assert/strict";

import { buildCapabilityReply, isCapabilityQuestion } from "@/lib/entry/capability-questions";
import { buildDiagnosisDeepLink } from "@/lib/entry/deeplink";

test("capability detector catches voice-related questions", () => {
  assert.equal(isCapabilityQuestion("Понимаешь голосовые сообщения?"), true);
  assert.equal(isCapabilityQuestion("Ты голосовые принимаешь"), true);
  assert.equal(isCapabilityQuestion("Сейчас голосовыми у тебя"), true);
  assert.equal(isCapabilityQuestion("Ты мне на мой вопрос ответишь?"), false);
});

test("capability reply stays on bot capabilities and request flow", () => {
  const reply = buildCapabilityReply("Ты голосовые принимаешь?");

  assert.match(reply.text, /принимаю.*голосовые|понимаю.*голосовые/i);
  assert.match(reply.text, /опишите.*ситуацию|сначала.*запрос/i);
});

test("diagnosis deeplink includes telegram metadata", () => {
  const url = buildDiagnosisDeepLink({
    entryMode: "problem_first",
    entryIntent: "management_problem",
    suggestedTool: "role-clarity-checklist",
  });

  assert.match(url, /source=telegram_entry/);
  assert.match(url, /entry_mode=problem_first/);
  assert.match(url, /entry_intent=management_problem/);
  assert.match(url, /suggested_tool=role-clarity-checklist/);
});

test("diagnosis deeplink keeps intake continuity", () => {
  const url = buildDiagnosisDeepLink({
    entryMode: "problem_first",
    entryIntent: "management_problem",
    intakeGoal: "Подготовить бизнес к продаже без потери стоимости.",
    intakeSymptoms: ["Непрозрачные цифры", "Зависимость от собственника"],
  });

  assert.match(url, /intake_goal=/);
  assert.match(url, /intake_symptoms=/);
});
