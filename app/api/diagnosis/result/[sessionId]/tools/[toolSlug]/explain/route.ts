import { NextResponse } from "next/server";

import { resolveActiveCompanyAccess, verifyAccessibleSession } from "@/lib/diagnosis/ai-route-utils";
import { generateAiToolExplanation } from "@/lib/tools/ai-tool-explainer";
import { buildToolNavigationContextFromSession } from "@/lib/tools/tool-navigation-context";
import type { ResultToolExplainApiResponse } from "@/types/api";
import { aiToolExplanationResponseSchema } from "@/validators/diagnosis";

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string; toolSlug: string }> },
) {
  const access = await resolveActiveCompanyAccess();

  if (access.status === "unauthorized") {
    return NextResponse.json({ error: "Пользователь не найден." }, { status: 401 });
  }

  if (access.status === "no_company") {
    return NextResponse.json({ error: "Компания не найдена." }, { status: 404 });
  }

  const { sessionId, toolSlug } = await context.params;
  const session = await verifyAccessibleSession(sessionId, access.activeCompanyId);

  if (!session) {
    return NextResponse.json({ error: "Результат диагностики не найден." }, { status: 404 });
  }

  const toolContext = await buildToolNavigationContextFromSession({
    sessionId,
    toolSlug,
  });

  if (!toolContext) {
    return NextResponse.json({ error: "Инструмент не найден для этого результата." }, { status: 404 });
  }

  const payload: ResultToolExplainApiResponse = aiToolExplanationResponseSchema.parse(
    await generateAiToolExplanation(toolContext),
  );

  return NextResponse.json(payload);
}
