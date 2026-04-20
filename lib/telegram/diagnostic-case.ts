import "server-only";

import { appendCaseMessage } from "@/lib/cases/append-case-message";
import { completeCase } from "@/lib/cases/complete-case";
import { createCase } from "@/lib/cases/create-case";
import { buildCaseDeepLink } from "@/lib/cases/deeplink";
import { getActiveCompanyContextForCase } from "@/lib/cases/get-active-company-context";
import { runDiagnosticCore } from "@/lib/diagnostic-core/run-diagnostic-core";
import type { DiagnosticStructuredResult } from "@/lib/diagnostic-core/schema";
import { runQuickScan } from "@/lib/quick-scan/run-quick-scan";
import { getOrCreateTelegramAppUser } from "@/lib/telegram/app-user";
import {
  extractWebsiteContextFromText,
  formatWebsiteContext,
} from "@/lib/website/extract-website-context";
import { hasUrl } from "@/lib/url-utils";
import type { EntryIntent, EntrySessionState, TelegramEntryReply } from "@/types/domain";

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

export function buildTelegramDiagnosticSummaryReply(params: {
  result: DiagnosticStructuredResult;
  caseUrl: string;
}): TelegramEntryReply {
  const { result, caseUrl } = params;
  const mainConstraint = result.constraints.main ?? "главное ограничение пока требует проверки";
  const tools = result.toolRecommendations
    .slice(0, 3)
    .map((tool) => `- ${tool.title}: ${tool.reasonNow}`)
    .join("\n");

  return {
    text: [
      "Сделал первичный разбор. Это не финальный диагноз, а рабочая управленческая гипотеза по текущему описанию.",
      `Главное ограничение: ${mainConstraint}`,
      `Первая волна:\n${formatList(result.firstWave.directions, 2)}`,
      `Что не делать сейчас:\n${formatList(result.doNotDoNow.map((item) => item.action), 3)}`,
      tools ? `Инструменты под это ограничение:\n${tools}` : null,
      `Короткий вывод: ${result.clientSummary}`,
    ]
      .filter((item): item is string => Boolean(item))
      .join("\n\n"),
    cta: {
      label: "Открыть сохранённый разбор",
      url: caseUrl,
    },
    stage: "ready_for_routing",
  };
}

export async function runTelegramDiagnosticCase(params: {
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
    currentStage: "diagnostic_core",
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
    },
  });

  const companyContext = company
    ? {
        companyId: company.id,
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
        "Контекст сайта, автоматически извлечённый для первичного разбора:",
        websiteContextText,
      ].join("\n\n")
    : params.workingText;

  const quickScan = await runQuickScan({
    rawInput: enrichedInput,
    inputType: detectQuickScanInputType(params.workingText),
    companyContext,
  });
  const diagnosticResult = await runDiagnosticCore({
    userMessage: enrichedInput,
    companyContext,
    quickScan,
    clarifyingAnswers: params.session.clarifyingAnswers.map((answer) => ({
      question: answer.questionText,
      answer: answer.answerText,
    })),
    knownFacts: [
      ...quickScan.likelyLossZones.map((zone) => `${zone.area}: ${zone.whyLikely}`),
      ...(websiteContext?.title ? [`Заголовок сайта: ${websiteContext.title}`] : []),
      ...(websiteContext?.description ? [`Описание сайта: ${websiteContext.description}`] : []),
    ],
  });

  const completion = await completeCase({
    caseId: businessCase.id,
    result: diagnosticResult,
  });
  const caseUrl = buildCaseDeepLink({
    caseId: completion.case.id,
    token: completion.case.publicShareToken,
  });
  const reply = buildTelegramDiagnosticSummaryReply({
    result: diagnosticResult,
    caseUrl,
  });

  await appendCaseMessage({
    caseId: businessCase.id,
    role: "assistant",
    text: reply.text,
    metadata: {
      artifactId: completion.artifactId,
      resultId: completion.resultId,
      snapshotId: completion.snapshotId,
    },
  });

  return reply;
}
