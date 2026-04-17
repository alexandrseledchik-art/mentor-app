import { NextResponse } from "next/server";

import { resolveActiveCompanyAccess, verifyAccessibleSnapshot } from "@/lib/diagnosis/ai-route-utils";
import { getRecommendedToolsForSnapshot } from "@/lib/tools/get-recommended-tools-for-result";
import type { ResultToolsApiResponse } from "@/types/api";
import { resultRecommendedToolItemSchema } from "@/validators/diagnosis";

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

  const items = await getRecommendedToolsForSnapshot(snapshotId);
  const payload: ResultToolsApiResponse = {
    items: items.map((item) => resultRecommendedToolItemSchema.parse(item)),
  };

  return NextResponse.json(payload);
}
