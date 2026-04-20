import test from "node:test";
import assert from "node:assert/strict";

import { buildDiagnosisDeepLink } from "@/lib/entry/deeplink";
import { buildCapabilityReply } from "@/lib/entry/capability-questions";
import { runCoreEntryConsultant } from "@/lib/entry/core-consultant";
import { hasEnoughSignalForTelegramDiagnostic } from "@/lib/entry/diagnostic-threshold";
import { detectEntryIntent, detectEntryMode } from "@/lib/entry/detection";
import { buildEntryHypothesis } from "@/lib/entry/hypothesis";
import {
  shouldRouteWebsiteInputDirectly,
  shouldRouteWebsiteInputToScreening,
} from "@/lib/entry/website-routing";
import { planEntryIntake } from "@/lib/entry/intake-planner";
import { buildConversationFrame } from "@/lib/entry/conversation-frame";
import { isCapabilityQuestion } from "@/lib/entry/capability-questions";

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

test("intake planner uses current conversation frame instead of stale session state", () => {
  const rawText = "хочу продать бизнес";
  const mode = detectEntryMode(rawText);
  const intent = detectEntryIntent(rawText, mode);

  const plan = planEntryIntake({
    mode,
    intent,
    rawText,
    turnCount: 2,
    session: {
      telegramUserId: 1,
      stage: "clarifying",
      entryMode: mode,
      initialMessage: rawText,
      detectedIntent: intent,
      clarifyingAnswers: [],
      turnCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      conversationFrame: {
        goalHypotheses: ["Устаревшая цель"],
        symptomHints: ["Устаревший симптом"],
        currentDiagnosticFocus: "request_clarification",
      },
      activeUnknown: "constraint_probe",
      lastQuestionKey: "request_goal",
      lastQuestionText: "Какого результата вы хотите?",
    } as any,
    conversationFrame: {
      goalHypotheses: ["Подготовить бизнес к продаже без потери стоимости и управляемости."],
      symptomHints: [],
      currentDiagnosticFocus: "goal_to_symptom",
    },
    activeUnknown: "main_symptom",
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

test("intake planner asks a hypothesis-splitting question when focus is still ambiguous", () => {
  const rawText = "хочу продать бизнес, цифры непрозрачные";
  const mode = detectEntryMode(rawText);
  const intent = detectEntryIntent(rawText, mode);

  const plan = planEntryIntake({
    mode,
    intent,
    rawText,
    turnCount: 2,
    session: null,
    conversationFrame: {
      goalHypotheses: ["Подготовить бизнес к продаже без потери стоимости и управляемости."],
      symptomHints: ["Непрозрачные цифры или слабая управленческая прозрачность."],
      currentDiagnosticFocus: "hypothesis_split",
    },
    activeUnknown: "hypothesis_split",
  });

  assert.equal(plan.shouldAskBeforeDiagnosis, true);
  assert.match(plan.nextQuestion?.text ?? "", /стоп-фактор продажи|мешают/i);
});

test("telegram diagnostic threshold stays false for short sale request", () => {
  const rawText = "хочу продать бизнес";
  const mode = detectEntryMode(rawText);
  const intent = detectEntryIntent(rawText, mode);
  const frame = buildConversationFrame({
    mode,
    intent,
    rawText,
    session: null,
  });

  assert.equal(
    hasEnoughSignalForTelegramDiagnostic({
      mode,
      intent,
      rawText,
      turnCount: 1,
      session: null,
      conversationFrame: frame.conversationFrame,
      activeUnknown: frame.activeUnknown,
    }),
    false,
  );
});

test("telegram diagnostic threshold turns true when constraint signal is already strong", () => {
  const rawText =
    "хочу продать бизнес, но цифры непрозрачные, все держится на собственнике и продажи нестабильны";
  const mode = detectEntryMode(rawText);
  const intent = detectEntryIntent(rawText, mode);

  assert.equal(
    hasEnoughSignalForTelegramDiagnostic({
      mode,
      intent,
      rawText,
      turnCount: 2,
      session: {
        telegramUserId: 1,
        stage: "clarifying",
        entryMode: mode,
        initialMessage: "хочу продать бизнес",
        detectedIntent: intent,
        clarifyingAnswers: [
          {
            questionKey: "sell_business_blocker",
            questionText: "Что мешает продаже?",
            answerText: "Цифры непрозрачные и бизнес держится на собственнике.",
          },
        ],
        turnCount: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        conversationFrame: {
          goalHypotheses: ["Подготовить бизнес к продаже без потери стоимости и управляемости."],
          symptomHints: ["Непрозрачные цифры или слабая управленческая прозрачность."],
          currentDiagnosticFocus: "constraint_probe",
        },
        activeUnknown: "constraint_probe",
      } as any,
      conversationFrame: {
        goalHypotheses: ["Подготовить бизнес к продаже без потери стоимости и управляемости."],
        symptomHints: [
          "Непрозрачные цифры или слабая управленческая прозрачность.",
          "Критическая зависимость от собственника.",
          "Есть просадка в одном из ключевых контуров.",
        ],
        currentDiagnosticFocus: "constraint_probe",
      },
      activeUnknown: "constraint_probe",
    }),
    true,
  );
});

test("telegram diagnostic threshold stays false while hypotheses are still not split", () => {
  const rawText = "хочу продать бизнес, цифры непрозрачные и продажи плавают";
  const mode = detectEntryMode(rawText);
  const intent = detectEntryIntent(rawText, mode);

  assert.equal(
    hasEnoughSignalForTelegramDiagnostic({
      mode,
      intent,
      rawText,
      turnCount: 2,
      session: null,
      conversationFrame: {
        goalHypotheses: ["Подготовить бизнес к продаже без потери стоимости и управляемости."],
        symptomHints: [
          "Непрозрачные цифры или слабая управленческая прозрачность.",
          "Есть просадка в одном из ключевых контуров.",
        ],
        currentDiagnosticFocus: "hypothesis_split",
      },
      activeUnknown: "hypothesis_split",
    }),
    false,
  );
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

test("conversation frame escalates from symptom collection to hypothesis split", () => {
  const rawText = "хочу продать бизнес, цифры непрозрачные";
  const mode = detectEntryMode(rawText);
  const intent = detectEntryIntent(rawText, mode);

  const frame = buildConversationFrame({
    mode,
    intent,
    rawText,
    session: {
      telegramUserId: 1,
      stage: "clarifying",
      entryMode: mode,
      initialMessage: "хочу продать бизнес",
      detectedIntent: intent,
      clarifyingAnswers: [],
      turnCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      conversationFrame: {
        goalHypotheses: ["Подготовить бизнес к продаже без потери стоимости и управляемости."],
        symptomHints: [],
        currentDiagnosticFocus: "symptom_collection",
      },
      activeUnknown: "main_symptom",
    },
  });

  assert.equal(frame.conversationFrame.currentDiagnosticFocus, "hypothesis_split");
  assert.equal(frame.activeUnknown, "hypothesis_split");
});

test("capability detector catches voice questions about the bot", () => {
  assert.equal(
    isCapabilityQuestion("Понимаешь голосовые сообщения? Понимаешь их?"),
    true,
  );
});

test("capability reply keeps focus on understanding the request", () => {
  const reply = buildCapabilityReply("Понимаешь голосовые сообщения?");

  assert.match(reply.text, /понимаю голосовые/i);
  assert.match(reply.text, /сначала.*запрос/i);
});

test("core consultant routes voice capability question to capability mode", async () => {
  const result = await runCoreEntryConsultant({
    rawText: "Понимаешь голосовые сообщения? Понимаешь их?",
    session: null,
  });

  assert.equal(result.mode, "capability");
  assert.match(result.understanding, /вопрос о возможностях|возможностях бота/i);
});

test("core consultant routes URL-only input to website screening", async () => {
  const result = await runCoreEntryConsultant({
    rawText: "https://dtlinvest.ru/land/",
    session: null,
  });

  assert.equal(result.mode, "website_screening");
  assert.match(result.understanding, /только ссылк|внешний скрининг/i);
});

test("core consultant asks one question for weak business input", async () => {
  const result = await runCoreEntryConsultant({
    rawText: "хочу продать бизнес",
    session: null,
  });

  assert.equal(result.mode, "ask_question");
  assert.match(result.question ?? "", /мешает продаже|какого результата/i);
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

test("diagnosis deeplink keeps diagnostic intake context for Mini App continuity", () => {
  const url = buildDiagnosisDeepLink({
    entryMode: "problem_first",
    entryIntent: "management_problem",
    intakeGoal: "Подготовить бизнес к продаже без потери стоимости.",
    intakeSymptoms: ["Непрозрачные цифры", "Зависимость от собственника"],
  });

  assert.match(url, /intake_goal=/);
  assert.match(url, /intake_symptoms=/);
  assert.match(url, /%7C|Непрозрачные/);
});
