import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCaseArtifactPayload,
  buildCaseToolRecommendationPayloads,
  buildCompanySnapshotPayload,
  inferCaseConfidenceLevel,
} from "@/lib/cases/case-result-payloads";
import { buildDiagnosticResultFixture } from "@/tests/fixtures/diagnostic-result";

const result = buildDiagnosticResultFixture();

test("case artifact payload keeps human-readable diagnostic result", () => {
  const artifact = buildCaseArtifactPayload(result);

  assert.match(artifact.title, /Диагностический разбор/);
  assert.equal(artifact.summary, result.clientSummary);
  assert.match(artifact.contentMarkdown, /Главное ограничение/);
});

test("company snapshot payload extracts current company state", () => {
  const snapshot = buildCompanySnapshotPayload(result);

  assert.equal(snapshot.currentGoal, result.goal.primary ?? result.goal.hypotheses[0]);
  assert.equal(snapshot.mainConstraint, result.constraints.main);
  assert.equal(snapshot.dominantSituation, result.dominantSituations[0]?.name);
  assert.ok(snapshot.firstWaveSummary);
  assert.equal(snapshot.summary, result.clientSummary);
});

test("case tool recommendations are bounded and normalized", () => {
  const tools = buildCaseToolRecommendationPayloads(
    buildDiagnosticResultFixture({
      toolRecommendations: [
        {
          title: "RACI",
          reasonNow: "Помогает снять путаницу в ролях",
          taskSolved: "Фиксирует зоны ответственности",
          whyNotSecondary: "Сейчас это бьёт прямо в ограничение",
        },
      ],
    }),
  );

  assert.ok(tools.length >= 1);
  assert.ok(tools.length <= 4);
  assert.ok(tools.every((tool) => tool.toolTitle && tool.reasonNow && tool.taskSolved));
});

test("case payloads stay stable without optional diagnostic extras", () => {
  const shallowResult = buildDiagnosticResultFixture({
    dominantSituations: [],
    toolRecommendations: [],
    doNotDoNow: [],
    secondWave: null,
  });

  const snapshot = buildCompanySnapshotPayload(shallowResult);
  const tools = buildCaseToolRecommendationPayloads(shallowResult);

  assert.equal(snapshot.dominantSituation, null);
  assert.deepEqual(snapshot.toolRecommendations, []);
  assert.deepEqual(tools, []);
});

test("case confidence is explicit and conservative", () => {
  assert.match(inferCaseConfidenceLevel(result), /^(low|medium|preliminary)$/);
});
