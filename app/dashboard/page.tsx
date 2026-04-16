import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import type { DashboardResponse } from "@/types/api";

async function loadDashboardData() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  const forwardedProto = requestHeaders.get("x-forwarded-proto");
  const protocol =
    forwardedProto ??
    (host?.includes("localhost") || host?.startsWith("127.0.0.1") ? "http" : "https");

  if (!host) {
    throw new Error("Missing host header.");
  }

  const response = await fetch(`${protocol}://${host}/api/dashboard`, {
    method: "GET",
    cache: "no-store",
  });

  if (response.status === 404) {
    redirect("/onboarding");
  }

  if (!response.ok) {
    throw new Error("Failed to load dashboard.");
  }

  return (await response.json()) as DashboardResponse;
}

function CompanyInfoRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <strong>{label}:</strong> {value || "Не указано"}
    </div>
  );
}

export default async function DashboardPage() {
  const data = await loadDashboardData();

  if (!data.company) {
    redirect("/onboarding");
  }

  return (
    <main className="page-shell">
      <section className="card">
        <span className="eyebrow">MVP v0.1</span>
        <h1>Dashboard</h1>

        <div className="section-stack">
          <section>
            <h2>Ваша компания</h2>
            <div className="info-stack">
              <CompanyInfoRow label="Название" value={data.company.name} />
              <CompanyInfoRow label="Отрасль" value={data.company.industry} />
              <CompanyInfoRow label="Размер команды" value={data.company.teamSize} />
              <CompanyInfoRow label="Выручка" value={data.company.revenueRange} />
              <CompanyInfoRow label="Цель" value={data.company.primaryGoal} />
            </div>
          </section>

          <section>
            <h2>Что делать дальше</h2>
            <div className="action-row">
              <Link href="/diagnosis" className="button-link">
                Пройти диагностику
              </Link>
              <Link href="/tools" className="button-link button-link-secondary">
                Инструменты
              </Link>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
