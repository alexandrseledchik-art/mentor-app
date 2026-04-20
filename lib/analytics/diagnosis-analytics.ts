import "server-only";

import { trackEvent } from "@/lib/analytics/track-event";

export async function trackDiagnosisStarted(params: {
  userId?: string | null;
  companyId: string;
  diagnosisSessionId: string;
  questionSetId: string;
  resumed: boolean;
  source?: string | null;
}) {
  await trackEvent({
    event: "diagnosis_started",
    userId: params.userId ?? null,
    companyId: params.companyId,
    diagnosisSessionId: params.diagnosisSessionId,
    payload: {
      companyId: params.companyId,
      questionSetId: params.questionSetId,
      resumed: params.resumed,
      source: params.source ?? undefined,
    },
  });
}

export async function trackDiagnosisCompleted(params: {
  userId?: string | null;
  companyId: string;
  diagnosisSessionId: string;
  summaryKey: string;
  totalScore: number;
  answeredCount: number;
}) {
  await trackEvent({
    event: "diagnosis_completed",
    userId: params.userId ?? null,
    companyId: params.companyId,
    diagnosisSessionId: params.diagnosisSessionId,
    payload: {
      companyId: params.companyId,
      summaryKey: params.summaryKey,
      totalScore: params.totalScore,
      answeredCount: params.answeredCount,
    },
  });
}
