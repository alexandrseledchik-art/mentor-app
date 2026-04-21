import test from "node:test";
import assert from "node:assert/strict";

import { formatDiagnosticSummary } from "@/lib/diagnostic-core/format-summary";
import { diagnosticStructuredResultSchema } from "@/lib/diagnostic-core/schema";
import { buildDiagnosticResultFixture } from "@/tests/fixtures/diagnostic-result";

const result = buildDiagnosticResultFixture();

test("diagnostic structured result validates schema", () => {
  assert.doesNotThrow(() => diagnosticStructuredResultSchema.parse(result));
});

test("diagnostic schema allows conditional depth", () => {
  const shallowResult = buildDiagnosticResultFixture({
    causeContours: [],
    dominantSituations: [],
    hypothesisChecks: [],
    secondWave: null,
    doNotDoNow: [],
    toolRecommendations: [],
  });

  assert.doesNotThrow(() => diagnosticStructuredResultSchema.parse(shallowResult));
});

test("diagnostic result separates facts interpretations and hypotheses", () => {
  assert.ok(result.confidenceMap.facts.length >= 1);
  assert.ok(result.confidenceMap.interpretations.length >= 1);
  assert.ok(result.confidenceMap.workingHypotheses.length >= 1);
  assert.ok(result.confidenceMap.weakHypotheses.length >= 1);
});

test("diagnostic result has first wave and do-not-do guidance", () => {
  assert.ok(result.firstWave.directions.length >= 1);
  assert.ok(result.firstWave.successSignals.length >= 1);
});

test("diagnostic summary skips absent optional sections", () => {
  const shallowResult = buildDiagnosticResultFixture({
    causeContours: [],
    dominantSituations: [],
    hypothesisChecks: [],
    secondWave: null,
    doNotDoNow: [],
  });
  const summary = formatDiagnosticSummary(shallowResult);

  assert.doesNotMatch(summary, /Контуры причин/);
  assert.doesNotMatch(summary, /Проверка гипотез/);
  assert.doesNotMatch(summary, /Вторая волна/);
  assert.doesNotMatch(summary, /Что не делать сейчас/);
});

test("diagnostic summary includes required sections", () => {
  const summary = formatDiagnosticSummary(result);

  assert.match(summary, /Цель и симптомы/);
  assert.match(summary, /Гипотезы ситуаций/);
  assert.match(summary, /Контуры причин/);
  assert.match(summary, /Главное ограничение/);
  assert.match(summary, /Проверка гипотез/);
  assert.match(summary, /Первая волна/);
  assert.match(summary, /Короткий вывод для клиента/);
});
