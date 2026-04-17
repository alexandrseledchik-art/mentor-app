"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { companyPayloadSchema } from "@/validators/company";

const teamSizeOptions = [
  "1-5 человек",
  "6-20 человек",
  "21-50 человек",
  "51-100 человек",
  "100+ человек",
];

const revenueOptions = [
  "Пока без выручки",
  "До 300 тыс. ₽",
  "300 тыс. - 1 млн ₽",
  "1-5 млн ₽",
  "5-20 млн ₽",
  "20+ млн ₽",
];

const industryOptions = [
  "IT / SaaS",
  "E-commerce",
  "Услуги",
  "Производство",
  "Образование",
  "Другое",
];

export default function OnboardingPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    industry: "",
    team_size: "",
    monthly_revenue_range: "",
    goal: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = companyPayloadSchema.safeParse(form);

    if (!parsed.success) {
      alert(parsed.error.issues[0]?.message ?? "Проверьте форму.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/company", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(parsed.data),
      });

      const raw = await response.text();
      let data: {
        error?: string;
        company?: { id: string };
      } = {};

      try {
        data = raw ? (JSON.parse(raw) as typeof data) : {};
      } catch {
        data = {};
      }

      if (!response.ok) {
        alert(data.error ?? raw ?? "Не удалось сохранить компанию.");
        return;
      }

      if (data.company?.id) {
        window.localStorage.setItem("mentor_company_id", data.company.id);
      }

      router.push("/dashboard");
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "Не удалось отправить форму. Попробуйте еще раз.";
      alert(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  return (
    <main className="page-shell">
      <section className="card">
        <span className="eyebrow">MVP v0.1</span>
        <h1>Расскажите о компании</h1>
        <p className="muted">
          Заполним базовый профиль, чтобы перейти в dashboard.
        </p>

        <form onSubmit={handleSubmit} className="form-stack">
          <label className="field">
            <span>Название компании</span>
            <input
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
              placeholder="Например, Nova Tech"
            />
          </label>

          <label className="field">
            <span>Сфера бизнеса</span>
            <select
              value={form.industry}
              onChange={(event) => updateField("industry", event.target.value)}
            >
              <option value="">Выберите сферу</option>
              {industryOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Размер команды</span>
            <select
              value={form.team_size}
              onChange={(event) => updateField("team_size", event.target.value)}
            >
              <option value="">Выберите размер команды</option>
              {teamSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Месячная выручка</span>
            <select
              value={form.monthly_revenue_range}
              onChange={(event) =>
                updateField("monthly_revenue_range", event.target.value)
              }
            >
              <option value="">Выберите диапазон</option>
              {revenueOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Главная цель</span>
            <textarea
              value={form.goal}
              onChange={(event) => updateField("goal", event.target.value)}
              placeholder="Например, выстроить стабильные продажи"
              rows={4}
            />
          </label>

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Сохраняем..." : "Продолжить"}
          </button>
        </form>
      </section>
    </main>
  );
}
