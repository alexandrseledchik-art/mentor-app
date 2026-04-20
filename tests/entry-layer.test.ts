import test from "node:test";
import assert from "node:assert/strict";

import { buildDiagnosisDeepLink } from "@/lib/entry/deeplink";
import { detectEntryIntent, detectEntryMode } from "@/lib/entry/detection";
import { buildEntryHypothesis } from "@/lib/entry/hypothesis";
import { shouldRouteWebsiteInputDirectly } from "@/lib/entry/website-routing";

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

test("entry routing: website input routes directly to diagnosis", async () => {
  const rawText = "https://dtlinvest.ru/land/";
  const mode = detectEntryMode(rawText);
  const intent = detectEntryIntent(rawText, mode);

  assert.equal(mode, "problem_first");
  assert.equal(intent.primaryIntent, "operations_problem");
  assert.equal(shouldRouteWebsiteInputDirectly({ mode, rawText }), true);
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
