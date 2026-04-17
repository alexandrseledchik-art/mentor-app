import { NextResponse } from "next/server";

import {
  logAiRouteEvent,
  resolveActiveCompanyAccess,
  verifyAccessibleSnapshot,
} from "@/lib/diagnosis/ai-route-utils";
import { buildAiHistoryContextByCompanyId } from "@/lib/diagnosis/ai-history-context";
import { answerAiResultQuestion } from "@/lib/diagnosis/ai-result-chat";
import { buildAiResultContextFromSnapshot } from "@/lib/diagnosis/ai-result-context";
import type { ResultAiChatApiRequest, ResultAiChatApiResponse } from "@/types/api";
import { aiResultChatRequestSchema, aiResultChatResponseSchema } from "@/validators/diagnosis";

export async function POST(
  request: Request,
  context: { params: Promise<{ snapshotId: string }> },
) {
  const access = await resolveActiveCompanyAccess();

  if (access.status === "unauthorized") {
    return NextResponse.json({ error: "Пользователь не найден." }, { status: 401 });
  }

  if (access.status === "no_company") {
    return NextResponse.json({ error: "Компания не найдена." }, { status: 404 });
  }

  const body = (await request.json()) as ResultAiChatApiRequest;
  const parsed = aiResultChatRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Некорректный вопрос.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { snapshotId } = await context.params;
  const snapshot = await verifyAccessibleSnapshot(snapshotId, access.activeCompanyId);

  if (!snapshot) {
    return NextResponse.json({ error: "Результат не найден." }, { status: 404 });
  }

  const [resultContext, historyContext] = await Promise.all([
    buildAiResultContextFromSnapshot(snapshotId),
    buildAiHistoryContextByCompanyId(snapshot.company_id),
  ]);

  if (!resultContext) {
    logAiRouteEvent("snapshot_chat_context_missing", {});
    return NextResponse.json({ error: "Не удалось собрать контекст результата." }, { status: 500 });
  }

  const payload: ResultAiChatApiResponse = aiResultChatResponseSchema.parse(await answerAiResultQuestion({
    question: parsed.data.question,
    resultContext,
    historyContext,
  }));

  return NextResponse.json(payload);
}
