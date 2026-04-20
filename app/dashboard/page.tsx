import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import type { DashboardResponse } from "@/types/api";

function formatSnapshotDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

async function loadDashboardData() {
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

  const response = await fetch(`${protocol}://${host}/api/dashboard`, {
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

  const primaryDiagnosisCta = data.activeDiagnosis
    ? {
        href: "/diagnosis",
        label: "Продолжить диагностику",
        helper: "У вас есть незавершённая диагностика.",
      }
    : {
        href: "/diagnosis",
        label: "Пройти диагностику",
        helper: null,
      };

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
            {primaryDiagnosisCta.helper ? (
              <p className="muted">{primaryDiagnosisCta.helper}</p>
            ) : null}
            {data.lastCompletedDiagnosis ? (
              <p className="muted">Последняя диагностика доступна для просмотра.</p>
            ) : null}
            <div className="action-row">
              <Link href={primaryDiagnosisCta.href} className="button-link">
                {primaryDiagnosisCta.label}
              </Link>
              {data.lastCompletedDiagnosis ? (
                <Link
                  href={`/diagnosis/${data.lastCompletedDiagnosis.id}`}
                  className="button-link button-link-secondary"
                >
                  Открыть последний результат
                </Link>
              ) : null}
              <Link href="/tools" className="button-link button-link-secondary">
                Инструменты
              </Link>
              <Link href="/cases" className="button-link button-link-secondary">
                Разборы
              </Link>
            </div>
          </section>

          {data.companySnapshot ? (
            <section>
              <h2>Текущее состояние компании</h2>
              <div className="result-card">
                {data.companySnapshot.currentGoal ? (
                  <p><strong>Цель:</strong> {data.companySnapshot.currentGoal}</p>
                ) : null}
                {data.companySnapshot.mainConstraint ? (
                  <p><strong>Главное ограничение:</strong> {data.companySnapshot.mainConstraint}</p>
                ) : null}
                {data.companySnapshot.dominantSituation ? (
                  <p><strong>Ситуация:</strong> {data.companySnapshot.dominantSituation}</p>
                ) : null}
                {data.companySnapshot.firstWaveSummary ? (
                  <p><strong>Первая волна:</strong> {data.companySnapshot.firstWaveSummary}</p>
                ) : null}
                <p className="muted">{data.companySnapshot.summary}</p>
              </div>
            </section>
          ) : null}

          {data.latestCase ? (
            <section>
              <h2>Последний разбор</h2>
              <div className="result-card">
                <h3>{data.latestCase.title}</h3>
                <p>{data.latestCase.summary}</p>
                {data.caseHistoryCount > 1 ? (
                  <p className="muted">Всего сохранённых разборов: {data.caseHistoryCount}</p>
                ) : null}
                <div className="action-row">
                  <Link href={data.latestCase.url} className="button-link">
                    Открыть последний разбор
                  </Link>
                  <Link href="/cases" className="button-link button-link-secondary">
                    История разборов
                  </Link>
                </div>
              </div>
            </section>
          ) : null}

          {data.latestResultSnapshot ? (
            <section>
              <h2>Результаты диагностики</h2>
              <p className="muted">
                Предыдущие результаты доступны в кабинете.
                {" "}
                Последний снимок: {formatSnapshotDate(data.latestResultSnapshot.createdAt)}
                {typeof data.latestResultSnapshot.overallScore === "number"
                  ? ` · Балл: ${data.latestResultSnapshot.overallScore}`
                  : ""}
              </p>
              {data.resultHistoryCount > 1 ? (
                <p className="muted">Доступно результатов: {data.resultHistoryCount}</p>
              ) : null}
              <div className="action-row">
                <Link href="/results" className="button-link button-link-secondary">
                  Смотреть все результаты
                </Link>
              </div>
            </section>
          ) : null}
        </div>
      </section>
    </main>
  );
}
