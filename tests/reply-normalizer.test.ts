import test from "node:test";
import assert from "node:assert/strict";

import {
  buildGreetingOnlyReply,
  hasFormalAssistantPhrasing,
  normalizeReplyText,
} from "@/lib/entry/reply-normalizer";

test("normalizeReplyText trims greeting and filler from working reply", () => {
  const normalized = normalizeReplyText({
    action: "ask_question",
    text: "Привет! Понял. Значит задача сейчас в подготовке бизнеса к продаже. Что у тебя сейчас непрозрачнее всего для покупателя?",
  });

  assert.equal(
    normalized,
    "Значит задача сейчас в подготовке бизнеса к продаже. Что у тебя сейчас непрозрачнее всего для покупателя?",
  );
});

test("normalizeReplyText removes website CTA tail outside website screening", () => {
  const normalized = normalizeReplyText({
    action: "ask_question",
    text: "Похоже, упирается в непрозрачные цифры.\n\nЧто дальше:\nЧто будем разбирать дальше: сам сайт и воронку или бизнес, который за ним стоит?\nНапишите запрос в 1–2 фразах.",
  });

  assert.equal(normalized, "Похоже, упирается в непрозрачные цифры.");
});

test("hasFormalAssistantPhrasing catches assistant-style reply", () => {
  assert.equal(
    hasFormalAssistantPhrasing({
      action: "ask_question",
      text: "Вы хотите продать бизнес. Чтобы помочь точнее, уточните, что сейчас мешает продаже?",
    }),
    true,
  );
});

test("hasFormalAssistantPhrasing catches aggressive gatekeeping reply", () => {
  assert.equal(
    hasFormalAssistantPhrasing({
      action: "ask_question",
      text: "Без цели разговор — болтовня. Чётко: какую проблему надо решить?",
    }),
    true,
  );
});

test("hasFormalAssistantPhrasing allows sharp reply", () => {
  assert.equal(
    hasFormalAssistantPhrasing({
      action: "ask_question",
      text: "Значит задача сейчас не в продаже как таковой, а в подготовке. Что у тебя сейчас отпугнёт покупателя быстрее всего?",
    }),
    false,
  );
});

test("buildGreetingOnlyReply returns direct opening question for greeting-only input", () => {
  const result = buildGreetingOnlyReply("привет");

  assert.equal(
    result,
    "Давай быстро поймём, что сейчас важнее всего: продажи, прибыль, порядок в управлении или подготовка к продаже?",
  );
});
