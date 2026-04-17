import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ScoreCard } from "@/app/diagnosis/[sessionId]/score-card";
import type { ResultSnapshotDetailResponse } from "@/types/api";

function formatSnapshotDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

async function loadSnapshot(snapshotId: string) {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  const forwardedProto = requestHeaders.get("x-forwarded-proto");
  const cookie = requestHeaders.get("cookie") ?? "";
  const protocol =
    forwardedProto ??
    (host?.includes("localhost") || host?.startsWith("127.0.0.1") ? "http" : "https");

  if (!host) {
    throw new Error("Missing host header.");
  }

  const response = await fetch(`${protocol}://${host}/api/results/${snapshotId}`, {
    method: "GET",
    cache: "no-store",
    headers: {
      cookie,
    },
  });

  if (response.status === 401 || response.status === 404) {
    redirect("/results");
  }

  if (!response.ok) {
    throw new Error("Failed to load result snapshot.");
  }

  return (await response.json()) as ResultSnapshotDetailResponse;
}

export default async function ResultSnapshotPage({
  params,
}: {
  params: Promise<{ snapshotId: string }>;
}) {
  const { snapshotId } = await params;
  const data = await loadSnapshot(snapshotId);

  return (
    <main className="page-shell">
      <section className="card">
        <span className="eyebrow">Исторический результат</span>
        <h1>{data.snapshot.summary.title}</h1>
        <p className="muted">
          Снимок от {formatSnapshotDate(data.snapshot.createdAt)}
        </p>
        <p>{data.snapshot.summary.description}</p>

        <div className="section-stack">
          <ScoreCard totalScore={data.snapshot.overallScore} summaryKey={data.snapshot.summary.key} />

          <section>
            <h2>Слабые зоны</h2>
            <ul className="plain-list">
              {data.snapshot.weakestZones.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section>
            <h2>Сильные зоны</h2>
            <ul className="plain-list">
              {data.snapshot.strongestZones.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section>
            <h2>Рекомендованные инструменты</h2>
            <ul className="plain-list">
              {data.snapshot.recommendedTools.map((item) => (
                <li key={`${item.title}-${item.whyRecommended}`}>
                  <strong>{item.title}:</strong> {item.whyRecommended}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <div className="action-row">
              <Link href="/results" className="button-link">
                Ко всем результатам
              </Link>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
