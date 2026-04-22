import test from "node:test";
import assert from "node:assert/strict";

import { POST_WEBSITE_SCREENING_REQUEST_TEXT } from "@/lib/entry/constants";
import { buildDiagnosisDeepLink } from "@/lib/entry/deeplink";
import { buildEntryOfferSessionState } from "@/lib/entry/offer-session-state";
import { buildWorkingText } from "@/lib/entry/working-text";

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

test("/start resets entry session to a fresh offer state", () => {
  const state = buildEntryOfferSessionState(42, "2026-04-21T06:50:00.000Z");

  assert.equal(state.telegramUserId, 42);
  assert.equal(state.stage, "initial");
  assert.equal(state.initialMessage, "__entry_offer__");
  assert.deepEqual(state.clarifyingAnswers, []);
  assert.equal(state.turnCount, 1);
  assert.equal(state.lastQuestionKey, null);
  assert.equal(state.lastQuestionText, null);
});

test("website follow-up context marks link as reference, not ownership proof", () => {
  const workingText = buildWorkingText(
    {
      initialMessage: "https://supabase.com/",
      lastQuestionKey: "core_consultant_question",
      clarifyingAnswers: [
        {
          questionKey: "post_website_screening_request",
          questionText: POST_WEBSITE_SCREENING_REQUEST_TEXT,
          answerText: "Хочу продать бизнес",
        },
      ],
    },
    "Тот на который прислал ссылку",
  );

  assert.match(workingText, /объект внешнего разбора/i);
  assert.match(workingText, /Не считай это подтверждением/i);
  assert.match(workingText, /https:\/\/supabase\.com\//i);
});

test("working text keeps previous question-answer structure", () => {
  const workingText = buildWorkingText(
    {
      initialMessage: "Хочу продать бизнес",
      lastQuestionKey: "core_consultant_question",
      clarifyingAnswers: [
        {
          questionKey: "core_consultant_question",
          questionText: "Что сейчас сильнее всего мешает продаже?",
          answerText: "Данные не выгружены и я пока не понимаю главный барьер.",
        },
      ],
    },
    "Вот в этом и хочу разобраться",
  );

  assert.match(workingText, /Предыдущий вопрос ассистента:/);
  assert.match(workingText, /Ответ пользователя:/);
  assert.match(workingText, /Текущее сообщение пользователя:/);
});
