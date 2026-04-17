import { NextResponse } from "next/server";

import { resolveActiveCompanyAccess, verifyAccessibleSnapshot } from "@/lib/diagnosis/ai-route-utils";
import { generateAiToolExplanation } from "@/lib/tools/ai-tool-explainer";
import { buildToolNavigationContextFromSnapshot } from "@/lib/tools/tool-navigation-context";
import type { ResultToolExplainApiResponse } from "@/types/api";
import { aiToolExplanationResponseSchema } from "@/validators/diagnosis";

export async function GET(
  _request: Request,
  context: { params: Promise<{ snapshotId: string; toolSlug: string }> },
) {
  const access = await resolveActiveCompanyAccess();

  if (access.status === "unauthorized") {
    return NextResponse.json({ error: "Пользователь не найден." }, { status: 401 });
  }

  if (access.status === "no_company") {
    return NextResponse.json({ error: "Компания не найдена." }, { status: 404 });
  }

  const { snapshotId, toolSlug } = await context.params;
  const snapshot = await verifyAccessibleSnapshot(snapshotId, access.activeCompanyId);

  if (!snapshot) {
    return NextResponse.json({ error: "Результат не найден." }, { status: 404 });
  }

  const toolContext = await buildToolNavigationContextFromSnapshot({
    snapshotId,
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
