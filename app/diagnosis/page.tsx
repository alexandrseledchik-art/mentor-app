"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type {
  DashboardResponse,
  DiagnosisStartGetResponse,
  DiagnosisStartResponse,
  DiagnosisSubmitResponse,
} from "@/types/api";
import type { DiagnosisQuestion } from "@/types/domain";

type AnswersState = Record<string, number>;

export default function DiagnosisPage() {
  const router = useRouter();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [questionSetTitle, setQuestionSetTitle] = useState("");
  const [questions, setQuestions] = useState<DiagnosisQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswersState>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [dashboardResponse, startResponse] = await Promise.all([
          fetch("/api/dashboard", { cache: "no-store" }),
          fetch("/api/diagnosis/start", { cache: "no-store" }),
        ]);

        if (dashboardResponse.status === 404) {
          router.replace("/onboarding");
          return;
        }

        if (!dashboardResponse.ok || !startResponse.ok) {
          alert("Не удалось загрузить диагностику.");
          return;
        }

        const dashboardData =
          (await dashboardResponse.json()) as DashboardResponse;
        const startData =
          (await startResponse.json()) as DiagnosisStartGetResponse;

        if (!dashboardData.company) {
          router.replace("/onboarding");
          return;
        }

        setCompanyId(dashboardData.company.id);
        setQuestionSetTitle(startData.questionSet.title);
        setQuestions(startData.questions);
      } catch {
        alert("Не удалось загрузить диагностику.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadData();
  }, [router]);

  const currentQuestion = questions[currentQuestionIndex];
  const currentValue = currentQuestion ? answers[currentQuestion.id] : undefined;
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const progressLabel = useMemo(() => {
    if (questions.length === 0) {
      return "";
    }

    return `${currentQuestionIndex + 1} из ${questions.length}`;
  }, [currentQuestionIndex, questions.length]);

  function handleSelect(questionId: string, value: number) {
    setAnswers((current) => ({
      ...current,
      [questionId]: value,
    }));
  }

  async function handleNext() {
    if (!currentQuestion || !currentValue) {
      alert("Сначала выберите вариант ответа.");
      return;
    }

    if (!isLastQuestion) {
      setCurrentQuestionIndex((index) => index + 1);
      return;
    }

    if (!companyId) {
      alert("Компания не найдена. Вернитесь в онбординг.");
      router.push("/onboarding");
      return;
    }

    setIsSubmitting(true);

    try {
      const sessionResponse = await fetch("/api/diagnosis/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyId,
        }),
      });

      const sessionData =
        (await sessionResponse.json()) as DiagnosisStartResponse | { error?: string };

      if (!sessionResponse.ok || !("session" in sessionData)) {
        alert(
          ("error" in sessionData && sessionData.error) ||
            "Не удалось создать сессию диагностики.",
        );
        return;
      }

      const submitResponse = await fetch("/api/diagnosis/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: sessionData.session.id,
          answers: questions.map((question) => ({
            questionId: question.id,
            value: answers[question.id],
          })),
        }),
      });

      const submitData =
        (await submitResponse.json()) as DiagnosisSubmitResponse | { error?: string };

      if (!submitResponse.ok || !("session" in submitData)) {
        alert(
          ("error" in submitData && submitData.error) ||
            "Не удалось сохранить ответы.",
        );
        return;
      }

      router.push(`/diagnosis/${submitData.session.id}`);
    } catch {
      alert("Не удалось завершить диагностику.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <main className="page-shell">
        <section className="card">
          <h1>Загружаем диагностику...</h1>
        </section>
      </main>
    );
  }

  if (!currentQuestion) {
    return (
      <main className="page-shell">
        <section className="card">
          <h1>Вопросы не найдены</h1>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <section className="card">
        <span className="eyebrow">{questionSetTitle || "Диагностика"}</span>
        <p className="muted">{progressLabel}</p>
        <h1>{currentQuestion.questionText}</h1>

        <div className="option-stack">
          {currentQuestion.options.map((option) => {
            const isSelected = answers[currentQuestion.id] === option.value;

            return (
              <button
                key={option.value}
                type="button"
                className={isSelected ? "option-button option-button-active" : "option-button"}
                onClick={() => handleSelect(currentQuestion.id, option.value)}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="action-row">
          <button type="button" onClick={handleNext} disabled={isSubmitting}>
            {isSubmitting
              ? "Сохраняем..."
              : isLastQuestion
                ? "Завершить"
                : "Далее"}
          </button>
        </div>
      </section>
    </main>
  );
}
