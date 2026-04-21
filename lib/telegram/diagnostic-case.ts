import "server-only";

import { appendCaseMessage } from "@/lib/cases/append-case-message";
import { completeCase } from "@/lib/cases/complete-case";
import { createCase } from "@/lib/cases/create-case";
import { buildCaseDeepLink } from "@/lib/cases/deeplink";
import { getActiveCompanyContextForCase } from "@/lib/cases/get-active-company-context";
import type { DiagnosticStructuredResult } from "@/lib/diagnostic-core/schema";
import { getOrCreateTelegramAppUser } from "@/lib/telegram/app-user";
import type { EntrySessionState, TelegramEntryReply } from "@/types/domain";

export function buildTelegramDiagnosticSummaryReply(params: {
  caseUrl: string;
  replyText: string;
}): TelegramEntryReply {
  return {
    text: params.replyText.trim(),
    cta: {
      label: "Открыть сохранённый разбор",
      url: params.caseUrl,
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
  replyText: string;
}): Promise<TelegramEntryReply> {
  if (!params.replyText.trim()) {
    throw new Error("Telegram diagnostic reply text is required.");
  }
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
    caseUrl,
    replyText: params.replyText,
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
