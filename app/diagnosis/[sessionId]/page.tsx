import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  getDomainExplanation,
  getDomainLabel,
  getDomainStrengthText,
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

          <section>
            <h2>Основные зоны внимания</h2>
            <p className="muted">Вот где сейчас больше всего теряется управляемость и рост:</p>
            <ul className="plain-list">
              {weakDimensions.length > 0 ? weakDimensions.map((item) => (
                <li key={item.dimension}>
                  {getDomainLabel(item.dimension)}
                </li>
              )) : (
                <li>Явно слабых зон не видно по этой диагностике.</li>
              )}
            </ul>
          </section>

          <section>
            <h2>Что это значит</h2>
            <ul className="plain-list">
              {weakDimensions.length > 0 ? weakDimensions.map((item) => (
                <li key={item.dimension}>
                  <strong>{getDomainLabel(item.dimension)}:</strong>{" "}
                  {getDomainExplanation(item.dimension)}
                </li>
              )) : (
                <li>Базовые управленческие контуры выглядят достаточно устойчиво.</li>
              )}
            </ul>
          </section>

          <section>
            <h2>С чего начать</h2>
            <ul className="plain-list">
              {startSteps.map((item) => (
                <li key={item.title}>
                  <strong>{item.title}:</strong> {item.text}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2>Дополнительный сигнал</h2>
            <p>
              Рост может замедляться именно в тех местах, где процессы ещё не стали
              системой и зависят от ручного управления.
            </p>
          </section>

          <section>
            <h2>Что уже начинает работать как система</h2>
            <ul className="plain-list">
              {strongDomains.map((item) => (
                <li key={item.dimension}>
                  {getDomainStrengthText(item.dimension)}
                </li>
              ))}
              {strongDomains.length === 0 ? (
                <li>
                  Пока рано говорить о явно сильных контурах, но база для роста уже может
                  быть собрана на следующем шаге.
                </li>
              ) : null}
            </ul>
          </section>

          <ResultTools tools={data.tools} />
        </div>
      </section>
    </main>
  );
}
