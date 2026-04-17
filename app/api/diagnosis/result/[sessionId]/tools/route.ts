import { NextResponse } from "next/server";

import { resolveActiveCompanyAccess, verifyAccessibleSession } from "@/lib/diagnosis/ai-route-utils";
import { getRecommendedToolsForSession } from "@/lib/tools/get-recommended-tools-for-result";
import type { ResultToolsApiResponse } from "@/types/api";
import { resultRecommendedToolItemSchema } from "@/validators/diagnosis";

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

  const items = await getRecommendedToolsForSession(sessionId);
  const payload: ResultToolsApiResponse = {
    items: items.map((item) => resultRecommendedToolItemSchema.parse(item)),
  };

  return NextResponse.json(payload);
}
