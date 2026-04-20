import "server-only";

import { appendCaseMessage } from "@/lib/cases/append-case-message";
import { completeDiagnosticIntake } from "@/lib/cases/complete-diagnostic-intake";
import { createCase } from "@/lib/cases/create-case";
import { buildCaseDeepLink } from "@/lib/cases/deeplink";
import { getActiveCompanyContextForCase } from "@/lib/cases/get-active-company-context";
import { buildDiagnosisDeepLink } from "@/lib/entry/deeplink";
import { runQuickScan } from "@/lib/quick-scan/run-quick-scan";
import type { QuickScanResult } from "@/lib/quick-scan/schema";
import { getOrCreateTelegramAppUser } from "@/lib/telegram/app-user";
import {
  extractWebsiteContextFromText,
  formatWebsiteContext,
} from "@/lib/website/extract-website-context";
import { hasUrl } from "@/lib/url-utils";
import type {
  EntryConversationFrame,
  EntryIntent,
  EntrySessionState,
  TelegramEntryReply,
} from "@/types/domain";

function detectQuickScanInputType(text: string): "website" | "text" | "mixed" {
  const textHasUrl = hasUrl(text);
  const hasWords = text.replace(/https?:\/\/\S+|[\w-]+\.[a-z]{2,}\S*/gi, "").trim().length > 0;

  if (textHasUrl && hasWords) {
    return "mixed";
  }

  return textHasUrl ? "website" : "text";
}

function formatList(items: string[], limit: number) {
  return items
    .slice(0, limit)
    .map((item) => `- ${item}`)
    .join("\n");
}

function inferPrimaryGoal(frame: EntryConversationFrame, quickScan: QuickScanResult, rawText: string) {
  return (
    frame.goalHypotheses[0] ??
    (rawText.trim().length > 0 ? rawText.trim() : null) ??
    quickScan.firstWaveCandidate.direction
  );
}

function buildSymptomList(frame: EntryConversationFrame, quickScan: QuickScanResult) {
  const frameSymptoms = frame.symptomHints.slice(0, 3);

  if (frameSymptoms.length > 0) {
    return frameSymptoms;
  }

  return quickScan.likelyLossZones.slice(0, 3).map((zone) => `${zone.area}: ${zone.whyLikely}`);
}

function buildHypothesisList(quickScan: QuickScanResult) {
  return quickScan.constraintVersions
    .slice(0, 3)
    .map((item) => `${item.constraint} (${item.confidence}) — ${item.basis}`);
}

function inferConfidenceLabel(quickScan: QuickScanResult) {
  const highCount = quickScan.constraintVersions.filter((item) => item.confidence === "high").length;
  const mediumCount = quickScan.constraintVersions.filter((item) => item.confidence === "medium").length;

  if (highCount >= 1) {
    return "средняя";
  }

  if (mediumCount >= 1) {
    return "предварительная";
  }

  return "низкая";
}

function buildDiagnosticIntakeMarkdown(params: {
  goal: string;
  symptoms: string[];
  hypotheses: string[];
  quickScan: QuickScanResult;
}) {
  return [
    "## Цель",
    params.goal,
    "## Что уже видно по симптомам",
    formatList(params.symptoms, 4),
    "## Рабочие гипотезы",
    formatList(params.hypotheses, 3),
    "## Что важно проверить дальше",
    params.quickScan.clarificationQuestion
      ? [
          params.quickScan.clarificationQuestion.text,
          params.quickScan.clarificationQuestion.whyItMatters,
        ].join("\n\n")
      : "Нужно подтвердить, какое из возможных ограничений действительно сдерживает результат и какую первую волну действий система выдержит.",
    "## Следующий шаг",
    "Пройти короткую диагностику в Mini App, чтобы отделить симптомы от главного ограничения и собрать первую волну действий уже на проверяемых основаниях.",
  ].join("\n\n");
}

function buildDiagnosticIntakeReply(params: {
  goal: string;
  symptoms: string[];
  hypotheses: string[];
  confidenceLabel: string;
  caseUrl: string;
  diagnosisUrl: string;
  quickScan: QuickScanResult;
}): TelegramEntryReply {
  return {
    text: [
      "Сделал короткий diagnostic intake. Это не финальный диагноз, а предварительная рамка перед полноценным разбором.",
      `Что считаю целью:\n- ${params.goal}`,
      `Какие сигналы уже есть в запросе:\n${formatList(params.symptoms, 3)}`,
      `Какие рабочие гипотезы сейчас выглядят основными:\n${formatList(params.hypotheses, 3)}`,
      `Уровень уверенности: ${params.confidenceLabel}. ${params.quickScan.disclaimer}`,
      "Почему это важно: такая рамка помогает не перепутать симптом с ограничением и не пойти в случайные действия.",
      "Следующий шаг: пройдите короткую диагностику в Mini App. Она поможет подтвердить главное ограничение, развести конкурирующие версии и собрать первую волну действий уже на проверяемых основаниях.",
      `Сохранённый intake: ${params.caseUrl}`,
    ].join("\n\n"),
    cta: {
      label: "Пройти диагностику",
      url: params.diagnosisUrl,
    },
    stage: "ready_for_routing",
  };
}

export async function runTelegramDiagnosticIntake(params: {
  telegramUserId: number;
  telegramUsername?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  workingText: string;
  session: EntrySessionState;
  intent: EntryIntent | null;
}): Promise<TelegramEntryReply> {
  const user = await getOrCreateTelegramAppUser({
    telegramUserId: params.telegramUserId,
    telegramUsername: params.telegramUsername,
    firstName: params.firstName,
    lastName: params.lastName,
  });
  const { company, workspace } = await getActiveCompanyContextForCase(user.id);

  const businessCase = await createCase({
    userId: user.id,
    companyId: company?.id ?? null,
    workspaceId: workspace.id,
    source: "telegram",
    initialMessage: params.session.initialMessage,
    currentStage: "diagnostic_intake",
  });

  await appendCaseMessage({
    caseId: businessCase.id,
    role: "user",
    text: params.workingText,
    metadata: {
      telegramUserId: params.telegramUserId,
      entryMode: params.session.entryMode,
      entryIntent: params.intent?.primaryIntent ?? null,
      turnCount: params.session.turnCount,
      artifactType: "diagnostic_intake",
    },
  });

  const companyContext = company
    ? {
        name: company.name,
        industry: company.industry,
        teamSize: company.teamSize,
        revenueRange: company.revenueRange,
        primaryGoal: company.primaryGoal,
      }
    : null;
  const websiteContext = await extractWebsiteContextFromText(params.workingText);
  const websiteContextText = formatWebsiteContext(websiteContext);
  const enrichedInput = websiteContextText
    ? [
        params.workingText,
        "Контекст сайта, автоматически извлечённый для предварительного intake-разбора:",
        websiteContextText,
      ].join("\n\n")
    : params.workingText;

  const quickScan = await runQuickScan({
    rawInput: enrichedInput,
    inputType: detectQuickScanInputType(params.workingText),
    companyContext,
  });

  const goal = inferPrimaryGoal(
    params.session.conversationFrame,
    quickScan,
    params.session.initialMessage,
  );
  const symptoms = buildSymptomList(params.session.conversationFrame, quickScan);
  const hypotheses = buildHypothesisList(quickScan);
  const confidenceLabel = inferConfidenceLabel(quickScan);
  const contentMarkdown = buildDiagnosticIntakeMarkdown({
    goal,
    symptoms,
    hypotheses,
    quickScan,
  });

  const completion = await completeDiagnosticIntake({
    caseId: businessCase.id,
    title: `Mini-intake: ${goal}`,
    summary: quickScan.preliminarySummary,
    contentMarkdown,
  });

  const caseUrl = buildCaseDeepLink({
    caseId: completion.case.id,
    token: completion.case.publicShareToken,
  });
  const diagnosisUrl = buildDiagnosisDeepLink({
    entryMode: params.session.entryMode,
    entryIntent: params.intent?.primaryIntent ?? "unclear",
    intakeGoal: goal,
    intakeSymptoms: symptoms,
  });

  const reply = buildDiagnosticIntakeReply({
    goal,
    symptoms,
    hypotheses,
    confidenceLabel,
    caseUrl,
    diagnosisUrl,
    quickScan,
  });

  await appendCaseMessage({
    caseId: businessCase.id,
    role: "assistant",
    text: reply.text,
    metadata: {
      artifactType: "diagnostic_intake",
      artifactUrl: caseUrl,
      diagnosisUrl,
    },
  });

  return reply;
}
