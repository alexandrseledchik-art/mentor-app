import { NextResponse } from "next/server";

import { getResultHistoryByCompanyId } from "@/lib/diagnosis/get-result-history";
import { getCurrentAppUser } from "@/lib/workspace/get-current-app-user";
import { getOrCreateWorkspace } from "@/lib/workspace/get-or-create-workspace";
import type { ResultsHistoryResponse } from "@/types/api";

export async function GET() {
  const user = await getCurrentAppUser();

  if (!user) {
    return NextResponse.json({ error: "Пользователь не найден." }, { status: 401 });
  }

  const workspace = await getOrCreateWorkspace(user.id);

  if (!workspace.activeCompanyId) {
    return NextResponse.json({ error: "Компания не найдена." }, { status: 404 });
  }

  const payload: ResultsHistoryResponse = {
    items: await getResultHistoryByCompanyId(workspace.activeCompanyId),
  };

  return NextResponse.json(payload);
}
