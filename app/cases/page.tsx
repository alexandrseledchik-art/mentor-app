import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import type { CasesHistoryResponse } from "@/types/api";

function formatCaseDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

async function loadCasesHistory() {
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

  const response = await fetch(`${protocol}://${host}/api/cases`, {
    method: "GET",
    cache: "no-store",
    headers: {
      cookie,
    },
  });

  if (response.status === 401) {
    redirect("/onboarding");
  }

  if (!response.ok) {
    throw new Error("Failed to load case history.");
  }

  return (await response.json()) as CasesHistoryResponse;
}

export default async function CasesPage() {
  const data = await loadCasesHistory();

  return (
    <main className="page-shell">
      <section className="card">
        <span className="eyebrow">Память системы</span>
        <h1>Разборы и артефакты</h1>

        {data.items.length === 0 ? (
          <p className="muted">
            Пока сохранённых разборов нет. Напишите ситуацию в Telegram — после первого разбора он появится здесь.
          </p>
        ) : (
          <div className="section-stack">
            {data.items.map((item) => (
              <section key={item.caseId} className="result-card">
                <span className="eyebrow">{item.source === "telegram" ? "Telegram" : item.source}</span>
                <h2>{item.title}</h2>
                <p className="muted">
                  {formatCaseDate(item.updatedAt)}
                  {item.status === "completed" ? " · завершён" : ` · ${item.status}`}
                </p>
                <p>{item.summary}</p>
                <div className="action-row">
                  <Link href={item.url} className="button-link">
                    Открыть разбор
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
