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
    goal: {
      primary: "Подготовить бизнес к продаже",
      hypotheses: [],
      explanation: null,
    },
    symptoms: [],
    situationHypotheses: [],
    causeContours: [],
    dominantSituations: [],
    hypothesisChecks: [],
    constraints: {
      main: "Недостаточная прозрачность бизнеса для покупателя",
      secondary: null,
      tertiary: null,
      competingVersions: ["Проблема может быть не в прозрачности, а в сильной зависимости от собственника"],
      basis: null,
    },
    firstWave: {
      directions: ["Собрать базовую картину бизнеса для покупателя"],
      expectedChanges: [],
      successSignals: [],
      errorCost: null,
      basis: null,
    },
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

  assert.doesNotMatch(summary, /Контуры:/);
  assert.doesNotMatch(summary, /Что проверить/);
  assert.doesNotMatch(summary, /После этого/);
  assert.doesNotMatch(summary, /Не делать сейчас/);
});

test("diagnostic summary includes required sections", () => {
  const summary = formatDiagnosticSummary(result);

  assert.match(summary, /## Картина/);
  assert.match(summary, /## Ограничение/);
  assert.match(summary, /## Что проверить/);
  assert.match(summary, /## Первый ход/);
  assert.match(summary, /## Вывод/);
});
