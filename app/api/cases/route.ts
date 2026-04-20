import { NextResponse } from "next/server";

import { getCaseHistoryByUserId } from "@/lib/cases/get-case-history";
import { getCurrentAppUser } from "@/lib/workspace/get-current-app-user";
import { getOrCreateWorkspace } from "@/lib/workspace/get-or-create-workspace";
import type { CasesHistoryResponse } from "@/types/api";

export async function GET() {
  const user = await getCurrentAppUser();

  if (!user) {
    return NextResponse.json({ error: "Пользователь не найден." }, { status: 401 });
  }

  const workspace = await getOrCreateWorkspace(user.id);
  const payload: CasesHistoryResponse = {
    items: await getCaseHistoryByUserId(user.id, {
      companyId: workspace.activeCompanyId,
    }),
  };

  return NextResponse.json(payload);
}
