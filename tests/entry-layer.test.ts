import test from "node:test";
import assert from "node:assert/strict";

import { buildDiagnosisDeepLink } from "@/lib/entry/deeplink";
import { detectEntryIntent, detectEntryMode } from "@/lib/entry/detection";
import { buildEntryHypothesis } from "@/lib/entry/hypothesis";
import {
  shouldRouteWebsiteInputDirectly,
  shouldRouteWebsiteInputToScreening,
} from "@/lib/entry/website-routing";
import { planEntryIntake } from "@/lib/entry/intake-planner";
import { buildConversationFrame } from "@/lib/entry/conversation-frame";

test("entry mode: vague chaos -> problem_first", () => {
  assert.equal(detectEntryMode("у нас хаос"), "problem_first");
});

test("entry mode: generic tool need -> tool_discovery", () => {
  assert.equal(detectEntryMode("мне нужен инструмент для ролей"), "tool_discovery");
});

test("entry mode: specific tool request -> specific_tool_request", () => {
  assert.equal(detectEntryMode("мне нужен RACI"), "specific_tool_request");
});

test("entry intent: sales stagnation maps to sales/growth", () => {
  const intent = detectEntryIntent("продажи стоят и конверсия просела", "problem_first");

  assert.equal(intent.primaryIntent, "sales_problem");
  assert.ok(intent.possibleDomains.includes("sales"));
});

test("entry routing: URL-only input routes to website screening, not diagnosis", async () => {
  const rawText = "https://dtlinvest.ru/land/";
  const mode = detectEntryMode(rawText);
  const intent = detectEntryIntent(rawText, mode);

  assert.equal(mode, "problem_first");
  assert.equal(intent.primaryIntent, "unclear");
  assert.equal(shouldRouteWebsiteInputToScreening({ rawText }), true);
  assert.equal(shouldRouteWebsiteInputDirectly({ mode, rawText }), false);
});

test("entry routing: URL with business pain can route to diagnosis", () => {
  const rawText = "https://example.com продажи просели и лиды стали хуже";
  const mode = detectEntryMode(rawText);
  const intent = detectEntryIntent(rawText, mode);

  assert.equal(mode, "problem_first");
  assert.equal(intent.primaryIntent, "sales_problem");
  assert.equal(shouldRouteWebsiteInputToScreening({ rawText }), false);
  assert.equal(shouldRouteWebsiteInputDirectly({ mode, rawText }), true);
});

test("entry mode: sale request maps to problem_first", () => {
  const mode = detectEntryMode("хочу продать бизнес");
  const intent = detectEntryIntent("хочу продать бизнес", mode);

  assert.equal(mode, "problem_first");
  assert.notEqual(intent.primaryIntent, "unclear");
});

test("entry mode: URL plus specific tool keeps tool intent", () => {
  const rawText = "https://example.com мне нужен RACI";
  const mode = detectEntryMode(rawText);
  const intent = detectEntryIntent(rawText, mode);

  assert.equal(mode, "specific_tool_request");
  assert.equal(intent.primaryIntent, "tool_request");
});

test("intake planner asks a sale-specific question before diagnosis", () => {
  const rawText = "хочу продать бизнес";
  const mode = detectEntryMode(rawText);
  const intent = detectEntryIntent(rawText, mode);

  const plan = planEntryIntake({
    mode,
    intent,
    rawText,
    turnCount: 1,
    session: null,
  });

  assert.equal(plan.shouldAskBeforeDiagnosis, true);
  assert.match(plan.nextQuestion?.text ?? "", /мешает продаже|стоп-фактор/i);
});

test("intake planner does not force extra question when symptom is already present", () => {
  const rawText = "хочу продать бизнес, но у нас непрозрачные цифры и все завязано на собственнике";
  const mode = detectEntryMode(rawText);
  const intent = detectEntryIntent(rawText, mode);

  const plan = planEntryIntake({
    mode,
    intent,
    rawText,
    turnCount: 1,
    session: null,
  });

  assert.equal(plan.shouldAskBeforeDiagnosis, false);
});

test("conversation frame keeps goal and symptom focus for sale request", () => {
  const rawText = "хочу продать бизнес, но цифры непрозрачные и все держится на собственнике";
  const mode = detectEntryMode(rawText);
  const intent = detectEntryIntent(rawText, mode);

  const frame = buildConversationFrame({
    mode,
    intent,
    rawText,
    session: null,
  });

  assert.ok(frame.conversationFrame.goalHypotheses.length >= 1);
  assert.ok(frame.conversationFrame.symptomHints.length >= 1);
  assert.equal(frame.activeUnknown, "constraint_probe");
});

test("entry hypothesis stays cautious", () => {
  const hypothesis = buildEntryHypothesis(
    detectEntryIntent("у нас хаос и все решения идут через собственника", "problem_first"),
  );

  assert.match(hypothesis.summary, /Похоже|Пока/);
  assert.ok(hypothesis.likelyAreas.length >= 1);
  assert.match(hypothesis.uncertaintyNote, /не диагноз|предварительн/i);
});

test("diagnosis deeplink includes telegram entry metadata", () => {
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
