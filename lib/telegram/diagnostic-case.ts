import "server-only";

import { appendCaseMessage } from "@/lib/cases/append-case-message";
import { completeCase } from "@/lib/cases/complete-case";
import { createCase } from "@/lib/cases/create-case";
import { buildCaseDeepLink } from "@/lib/cases/deeplink";
import { getActiveCompanyContextForCase } from "@/lib/cases/get-active-company-context";
import { runDiagnosticCore } from "@/lib/diagnostic-core/run-diagnostic-core";
import type { DiagnosticStructuredResult } from "@/lib/diagnostic-core/schema";
import { getOrCreateTelegramAppUser } from "@/lib/telegram/app-user";
import {
  extractWebsiteContextFromText,
} from "@/lib/website/extract-website-context";
import type { EntrySessionState, TelegramEntryReply } from "@/types/domain";

function formatList(items: string[], limit: number) {
  return items
    .slice(0, limit)
    .map((item) => `- ${item}`)
    .join("\n");
}

export function buildTelegramDiagnosticSummaryReply(params: {
  result: DiagnosticStructuredResult;
  caseUrl: string;
  replyText?: string | null;
}): TelegramEntryReply {
  const { result, caseUrl } = params;

  if (params.replyText?.trim()) {
    return {
      text: params.replyText.trim(),
      cta: {
        label: "Открыть сохранённый разбор",
        url: caseUrl,
      },
      stage: "ready_for_routing",
    };
  }

  const mainConstraint = result.constraints.main ?? "главное ограничение пока требует проверки";
  const tools = (result.toolRecommendations ?? [])
    .slice(0, 3)
    .map((tool) => `- ${tool.title}: ${tool.reasonNow}`)
    .join("\n");
  const doNotDoNow = (result.doNotDoNow ?? []).map((item) => item.action);

  return {
    text: [
      "Сделал первичный разбор. Это не финальный диагноз, а рабочая управленческая гипотеза по текущему описанию.",
      `Главное ограничение: ${mainConstraint}`,
      `Первая волна:\n${formatList(result.firstWave.directions, 2)}`,
      doNotDoNow.length > 0 ? `Что не делать сейчас:\n${formatList(doNotDoNow, 3)}` : null,
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

export async function persistTelegramDiagnosticCase(params: {
  telegramUserId: number;
  telegramUsername?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  workingText: string;
  session: EntrySessionState;
  result: DiagnosticStructuredResult;
  replyText?: string | null;
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
      turnCount: params.session.turnCount,
    },
  });

  const completion = await completeCase({
    caseId: businessCase.id,
    result: params.result,
  });
  const caseUrl = buildCaseDeepLink({
    caseId: completion.case.id,
    token: completion.case.publicShareToken,
  });
  const reply = buildTelegramDiagnosticSummaryReply({
    result: params.result,
    caseUrl,
    replyText: params.replyText ?? null,
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

export async function runTelegramDiagnosticCase(params: {
  telegramUserId: number;
  telegramUsername?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  workingText: string;
  session: EntrySessionState;
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
  const diagnosticResult = await runDiagnosticCore({
    userMessage: params.workingText,
    companyContext,
    clarifyingAnswers: params.session.clarifyingAnswers.map((answer) => ({
      question: answer.questionText,
      answer: answer.answerText,
    })),
    knownFacts: [
      ...(websiteContext?.title ? [`Заголовок сайта: ${websiteContext.title}`] : []),
      ...(websiteContext?.description ? [`Описание сайта: ${websiteContext.description}`] : []),
      ...((websiteContext?.headings ?? []).slice(0, 3).map((heading) => `Заголовок раздела сайта: ${heading}`)),
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
