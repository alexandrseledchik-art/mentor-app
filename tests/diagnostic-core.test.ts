import test from "node:test";
import assert from "node:assert/strict";

import { buildDiagnosticFallback } from "@/lib/diagnostic-core/fallback";
import { formatDiagnosticSummary } from "@/lib/diagnostic-core/format-summary";
import { diagnosticStructuredResultSchema } from "@/lib/diagnostic-core/schema";

const sampleInput = {
  userMessage: "У нас просели продажи, команда работает хаотично, и я не понимаю, что делать первым.",
  companyContext: {
    name: "Example",
    industry: "Услуги",
  },
};

test("diagnostic fallback validates schema", () => {
  const result = buildDiagnosticFallback(sampleInput);

  assert.doesNotThrow(() => diagnosticStructuredResultSchema.parse(result));
});

test("diagnostic result separates facts interpretations and hypotheses", () => {
  const result = buildDiagnosticFallback(sampleInput);

  assert.ok(result.confidenceMap.facts.length >= 1);
  assert.ok(result.confidenceMap.interpretations.length >= 1);
  assert.ok(result.confidenceMap.workingHypotheses.length >= 1);
  assert.ok(result.confidenceMap.weakHypotheses.length >= 1);
});

test("diagnostic result has first wave and do-not-do guidance", () => {
  const result = buildDiagnosticFallback(sampleInput);

  assert.ok(result.firstWave.directions.length >= 1);
  assert.ok(result.firstWave.successSignals.length >= 1);
  assert.ok(result.doNotDoNow.length >= 1);
});

test("diagnostic summary includes required sections", () => {
  const result = buildDiagnosticFallback(sampleInput);
  const summary = formatDiagnosticSummary(result);

  assert.match(summary, /Цель и симптомы/);
  assert.match(summary, /Гипотезы ситуаций/);
  assert.match(summary, /Контуры причин/);
  assert.match(summary, /Главное ограничение/);
  assert.match(summary, /Проверка гипотез/);
  assert.match(summary, /Первая волна/);
  assert.match(summary, /Вторая волна/);
  assert.match(summary, /Что не делать сейчас/);
  assert.match(summary, /Короткий вывод для клиента/);
});
