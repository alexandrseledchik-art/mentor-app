import test from "node:test";
import assert from "node:assert/strict";

import { buildQuickScanFallback } from "@/lib/quick-scan/fallback";
import { quickScanResultSchema } from "@/lib/quick-scan/schema";

test("quick scan fallback validates schema", () => {
  const result = buildQuickScanFallback({
    rawInput: "у нас просели продажи и непонятно что делать первым",
    inputType: "text",
  });

  assert.doesNotThrow(() => quickScanResultSchema.parse(result));
});

test("quick scan result includes cautious disclaimer", () => {
  const result = buildQuickScanFallback({
    rawInput: "хаос",
    inputType: "text",
  });

  assert.match(result.disclaimer, /предварительн|не финальн|не диагноз/i);
});

test("quick scan tool candidates stay compact", () => {
  const result = buildQuickScanFallback({
    rawInput: "команда не понимает роли и ответственность",
    inputType: "text",
  });

  assert.ok(result.toolCandidates.length >= 1);
  assert.ok(result.toolCandidates.length <= 4);
});
