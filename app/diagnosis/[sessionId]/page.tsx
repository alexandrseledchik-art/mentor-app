import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ResultAiPanel } from "@/app/components/result-ai-panel";
import {
  getFallbackMainSummary,
  getFallbackWhyNow,
  getDomainExplanation,
  getDomainStrengthText,
  getPrimaryFocus,
  getStartSteps,
  getStrongDomains,
  getWeakDimensions,
} from "./result-copy";
import { ResultTools } from "./result-tools";
import { ScoreCard } from "./score-card";

import type { DiagnosisResultResponse } from "@/types/api";

async function loadResult(sessionId: string) {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  const forwardedProto = requestHeaders.get("x-forwarded-proto");
  const protocol =
    forwardedProto ??
    (host?.includes("localhost") || host?.startsWith("127.0.0.1") ? "http" : "https");

  if (!host) {
    throw new Error("Missing host header.");
  }

  const response = await fetch(
    `${protocol}://${host}/api/diagnosis/result/${sessionId}`,
    {
      cache: "no-store",
    },
  );

  if (response.status === 404) {
    redirect("/diagnosis");
  }

  if (!response.ok) {
    throw new Error("Failed to load diagnosis result.");
  }

  return (await response.json()) as DiagnosisResultResponse;
}

export default async function DiagnosisResultPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const data = await loadResult(sessionId);
  const weakDimensions = getWeakDimensions(data.dimensionScores);
  const startSteps = getStartSteps(data.dimensionScores);
  const strongDomains = getStrongDomains(data.dimensionScores);
  const hasAiSummary = data.aiSummary !== null;
  const mainSummary = data.aiSummary?.mainSummary ?? getFallbackMainSummary(data.dimensionScores);
  const mainFocus = data.aiSummary?.mainFocus ?? getPrimaryFocus(data.dimensionScores);
  const whyNowItems = data.aiSummary?.whyNow ?? [getFallbackWhyNow(data.dimensionScores)];
  const strengthItems =
    data.aiSummary?.strengths ??
    (strongDomains.length > 0
      ? strongDomains.map((item) => getDomainStrengthText(item.dimension))
      : [
          "Пока явных опорных зон немного, поэтому лучше идти от самого слабого контура и быстро собирать там первую рабочую систему.",
        ]);
  const firstStepItems =
    data.aiSummary?.firstSteps ??
    startSteps.map((item) => `${item.title}: ${item.text}`);

  return (
    <main className="page-shell">
      <section className="card">
        <span className="eyebrow">Результат диагностики</span>
        <h1>{data.summary.title}</h1>
        <p className="muted">{data.summary.description}</p>

        <div className="section-stack">
          <ScoreCard
            totalScore={data.session.totalScore}
            summaryKey={
              data.session.summaryKey === "low" ||
              data.session.summaryKey === "medium" ||
              data.session.summaryKey === "high"
                ? data.session.summaryKey
                : null
            }
          />

          <div className="action-row">
            <Link className="button-link" href={`/diagnosis/${sessionId}/chat`}>
              Разобрать результат
            </Link>
          </div>

          <section>
            <h2>Главный вывод</h2>
            <p>{mainSummary}</p>
          </section>

          <section>
            <h2>Главный фокус</h2>
            <p>{mainFocus}</p>
          </section>

          <section>
            <h2>Почему именно сейчас</h2>
            <ul className="plain-list">
              {whyNowItems.map((item, index) => (
                <li key={`why-now-${index}`}>{item}</li>
              ))}
            </ul>
            {!hasAiSummary ? (
              <ul className="plain-list">
                {weakDimensions.length > 0 ? weakDimensions.map((item) => (
                  <li key={item.dimension}>
                    {getDomainExplanation(item.dimension)}
                  </li>
                )) : (
                  <li>Сейчас критических провалов не видно, поэтому важнее удержать управляемость и не вернуть ключевые контуры в ручной режим.</li>
                )}
              </ul>
            ) : null}
          </section>

          <section>
            <h2>На что уже можно опереться</h2>
            <ul className="plain-list">
              {strengthItems.map((item, index) => (
                <li key={`strength-${index}`}>{item}</li>
              ))}
            </ul>
          </section>

          <section>
            <h2>С чего начать</h2>
            <ul className="plain-list">
              {firstStepItems.map((item, index) => (
                <li key={`first-step-${index}`}>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <ResultTools tools={data.resultRecommendedTools} />

          <ResultAiPanel
            summaryUrl={`/api/diagnosis/result/${sessionId}/ai-summary`}
            chatUrl={`/api/diagnosis/result/${sessionId}/ai-chat`}
          />

          <section>
            <div className="action-row">
              <Link className="button-link" href={`/diagnosis/${sessionId}/chat`}>
                Разобрать результат
              </Link>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
