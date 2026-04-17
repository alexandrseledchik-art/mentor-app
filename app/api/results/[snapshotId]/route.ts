import { NextResponse } from "next/server";

import { getResultSnapshotById } from "@/lib/diagnosis/get-latest-result-snapshot";
import { getCurrentAppUser } from "@/lib/workspace/get-current-app-user";
import { getOrCreateWorkspace } from "@/lib/workspace/get-or-create-workspace";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { ResultSnapshotDetailResponse } from "@/types/api";

export async function GET(
  _request: Request,
  context: { params: Promise<{ snapshotId: string }> },
) {
  const user = await getCurrentAppUser();

  if (!user) {
    return NextResponse.json({ error: "Пользователь не найден." }, { status: 401 });
  }

  const workspace = await getOrCreateWorkspace(user.id);

  if (!workspace.activeCompanyId) {
    return NextResponse.json({ error: "Компания не найдена." }, { status: 404 });
  }

  const { snapshotId } = await context.params;
  const supabase = getSupabaseAdminClient();
  const { data: snapshotRow, error } = await supabase
    .from("result_snapshots")
    .select("id")
    .eq("id", snapshotId)
    .eq("company_id", workspace.activeCompanyId)
    .maybeSingle();

  if (error || !snapshotRow) {
    return NextResponse.json({ error: "Результат не найден." }, { status: 404 });
  }

  const snapshot = await getResultSnapshotById(snapshotId);

  if (!snapshot) {
    return NextResponse.json({ error: "Результат не найден." }, { status: 404 });
  }

  const payload: ResultSnapshotDetailResponse = {
    snapshot,
  };

  return NextResponse.json(payload);
}
