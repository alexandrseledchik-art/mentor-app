import { NextResponse } from "next/server";

import { logAiRouteEvent, resolveActiveCompanyAccess, verifyAccessibleSession } from "@/lib/diagnosis/ai-route-utils";
import { buildAiResultContextFromSession } from "@/lib/diagnosis/ai-result-context";
import { generateAiResultSummary } from "@/lib/diagnosis/ai-result-summary";
import type { ResultAiSummaryApiResponse } from "@/types/api";
import { aiResultSummaryResponseSchema } from "@/validators/diagnosis";

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const access = await resolveActiveCompanyAccess();

  if (access.status === "unauthorized") {
    return NextResponse.json({ error: "Пользователь не найден." }, { status: 401 });
  }

  if (access.status === "no_company") {
    return NextResponse.json({ error: "Компания не найдена." }, { status: 404 });
  }

  const { sessionId } = await context.params;
  const session = await verifyAccessibleSession(sessionId, access.activeCompanyId);

  if (!session) {
    return NextResponse.json({ error: "Результат диагностики не найден." }, { status: 404 });
  }

  const resultContext = await buildAiResultContextFromSession(sessionId);

  if (!resultContext) {
    logAiRouteEvent("live_result_summary_context_missing", {});
    return NextResponse.json({ error: "Не удалось собрать контекст результата." }, { status: 500 });
  }

  const payload: ResultAiSummaryApiResponse = aiResultSummaryResponseSchema.parse(
    await generateAiResultSummary(resultContext),
  );

  return NextResponse.json(payload);
}
