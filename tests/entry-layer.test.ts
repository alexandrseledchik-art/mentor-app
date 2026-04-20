import test from "node:test";
import assert from "node:assert/strict";

import { buildDiagnosisDeepLink } from "@/lib/entry/deeplink";

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
