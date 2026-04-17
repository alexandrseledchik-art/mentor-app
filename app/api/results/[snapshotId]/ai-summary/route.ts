import { NextResponse } from "next/server";

import { logAiRouteEvent, resolveActiveCompanyAccess, verifyAccessibleSnapshot } from "@/lib/diagnosis/ai-route-utils";
import { buildAiResultContextFromSnapshot } from "@/lib/diagnosis/ai-result-context";
import { generateAiResultSummary } from "@/lib/diagnosis/ai-result-summary";
import type { ResultAiSummaryApiResponse } from "@/types/api";
import { aiResultSummaryResponseSchema } from "@/validators/diagnosis";

export async function GET(
  _request: Request,
  context: { params: Promise<{ snapshotId: string }> },
) {
  const access = await resolveActiveCompanyAccess();

  if (access.status === "unauthorized") {
    return NextResponse.json({ error: "Пользователь не найден." }, { status: 401 });
  }

  if (access.status === "no_company") {
    return NextResponse.json({ error: "Компания не найдена." }, { status: 404 });
  }

  const { snapshotId } = await context.params;
  const snapshot = await verifyAccessibleSnapshot(snapshotId, access.activeCompanyId);

  if (!snapshot) {
    return NextResponse.json({ error: "Результат не найден." }, { status: 404 });
  }

  const resultContext = await buildAiResultContextFromSnapshot(snapshotId);

  if (!resultContext) {
    logAiRouteEvent("snapshot_summary_context_missing", {});
    return NextResponse.json({ error: "Не удалось собрать контекст результата." }, { status: 500 });
  }

  const payload: ResultAiSummaryApiResponse = aiResultSummaryResponseSchema.parse(
    await generateAiResultSummary(resultContext),
  );

  return NextResponse.json(payload);
}
