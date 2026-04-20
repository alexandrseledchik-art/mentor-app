import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import {
  DEFAULT_OPENAI_MODEL,
  getOpenAiModel,
  getOpenAiNumberEnv,
} from "@/lib/openai/model-config";

const originalOpenAiModel = process.env.OPENAI_MODEL;
const originalOpenAiTemperature = process.env.OPENAI_TEMPERATURE;

afterEach(() => {
  process.env.OPENAI_MODEL = originalOpenAiModel;
  process.env.OPENAI_TEMPERATURE = originalOpenAiTemperature;
});

test("uses gpt-5.4-mini as the default OpenAI model", () => {
  delete process.env.OPENAI_MODEL;

  assert.equal(DEFAULT_OPENAI_MODEL, "gpt-5.4-mini");
  assert.equal(getOpenAiModel(), "gpt-5.4-mini");
});

test("uses configured OpenAI model when provided", () => {
  process.env.OPENAI_MODEL = " gpt-5.4 ";

  assert.equal(getOpenAiModel(), "gpt-5.4");
});

test("falls back to numeric defaults for invalid number env values", () => {
  process.env.OPENAI_TEMPERATURE = "not-a-number";

  assert.equal(getOpenAiNumberEnv("OPENAI_TEMPERATURE", 0.2), 0.2);
});
