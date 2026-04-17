import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import type { ResultsHistoryResponse } from "@/types/api";

function formatSnapshotDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

async function loadResultsHistory() {
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

  const response = await fetch(`${protocol}://${host}/api/results`, {
    method: "GET",
    cache: "no-store",
    headers: {
      cookie,
    },
  });

  if (response.status === 401 || response.status === 404) {
    redirect("/onboarding");
  }

  if (!response.ok) {
    throw new Error("Failed to load result history.");
  }

  return (await response.json()) as ResultsHistoryResponse;
}

export default async function ResultsPage() {
  const data = await loadResultsHistory();

  return (
    <main className="page-shell">
      <section className="card">
        <span className="eyebrow">Кабинет</span>
        <h1>Результаты диагностики</h1>

        {data.items.length === 0 ? (
          <p className="muted">Пока завершённых результатов нет. После первой завершённой диагностики они появятся здесь.</p>
        ) : (
          <div className="section-stack">
            {data.items.map((item) => (
              <section key={item.snapshotId}>
                <h2>{formatSnapshotDate(item.createdAt)}</h2>
                <p className="muted">
                  {item.summaryKey ? `Статус: ${item.summaryKey}` : "Результат сохранён"}
                  {typeof item.overallScore === "number" ? ` · Балл: ${item.overallScore}` : ""}
                </p>
                {item.weakestZones.length > 0 ? (
                  <p>Слабые зоны: {item.weakestZones.join(", ")}</p>
                ) : null}
                {item.strongestZones.length > 0 ? (
                  <p>Сильные зоны: {item.strongestZones.join(", ")}</p>
                ) : null}
                <div className="action-row">
                  <Link href={`/results/${item.snapshotId}`} className="button-link">
                    Открыть результат
                  </Link>
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
