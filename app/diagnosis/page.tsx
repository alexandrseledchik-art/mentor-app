"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type {
  DashboardResponse,
  DiagnosisStartResponse,
  DiagnosisSubmitResponse,
} from "@/types/api";
import type { DiagnosisAnswerInput, DiagnosisQuestion } from "@/types/domain";

type AnswersState = Record<string, number>;
const COMPANY_STORAGE_KEY = "mentor_company_id";

export default function DiagnosisPage() {
  const router = useRouter();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questionSetTitle, setQuestionSetTitle] = useState("");
  const [questions, setQuestions] = useState<DiagnosisQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswersState>({});
  const [intakeContext, setIntakeContext] = useState<DiagnosisStartResponse["intakeContext"]>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function readApiError(response: Response, fallbackMessage: string) {
    try {
      const data = (await response.json()) as { error?: string };
      return data.error || fallbackMessage;
    } catch {
      return fallbackMessage;
    }
  }

  function readStoredCompanyId() {
    if (typeof window === "undefined") {
      return null;
    }

    return window.localStorage.getItem(COMPANY_STORAGE_KEY);
  }

  function buildSubmitAnswers(questionList: DiagnosisQuestion[], values: AnswersState) {
    return questionList
      .filter((question) => typeof values[question.code] === "number")
      .map((question) => ({
        questionId: question.id,
        value: values[question.code],
      }));
  }

  function readIntakeContextFromQuery() {
    if (typeof window === "undefined") {
      return undefined;
    }

    const params = new URLSearchParams(window.location.search);
    const goal = params.get("intake_goal");
    const symptoms = (params.get("intake_symptoms") ?? "")
      .split("|")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 4);

    if (!goal && symptoms.length === 0) {
      return undefined;
    }

    return {
      source: "telegram_diagnostic_intake" as const,
      goal: goal?.trim() || null,
      symptoms,
    };
  }

  function restoreAnswersFromSnapshot(
    questionList: DiagnosisQuestion[],
    snapshot: DiagnosisAnswerInput[] | null | undefined,
  ) {
    if (!snapshot?.length) {
      return {};
    }

    const questionCodeById = new Map(questionList.map((question) => [question.id, question.code]));

    return snapshot.reduce<AnswersState>((accumulator, item) => {
      const questionCode = questionCodeById.get(item.questionId);

      if (questionCode) {
        accumulator[questionCode] = item.answerValue;
      }

      return accumulator;
    }, {});
  }

  function resolveInitialQuestionIndex(params: {
    questionCount: number;
    currentStep: number | null | undefined;
    restoredAnswersCount: number;
  }) {
    if (params.questionCount === 0) {
      return 0;
    }

    if (typeof params.currentStep === "number" && params.currentStep >= 1) {
      return Math.min(params.currentStep - 1, params.questionCount - 1);
    }

    return Math.min(params.restoredAnswersCount, params.questionCount - 1);
  }

  useEffect(() => {
    async function loadData() {
      try {
        const storedCompanyId = readStoredCompanyId();

        if (storedCompanyId) {
          setCompanyId(storedCompanyId);
        }

        const startResponse = await fetch("/api/diagnosis/start", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          cache: "no-store",
          body: JSON.stringify(
            storedCompanyId
              ? {
                  companyId: storedCompanyId,
                  intakeContext: readIntakeContextFromQuery(),
                }
              : {
                  intakeContext: readIntakeContextFromQuery(),
                },
          ),
        });

        if (!startResponse.ok) {
          alert(
            await readApiError(
              startResponse,
              "Не удалось загрузить диагностику.",
            ),
          );
          return;
        }

        const startData =
          (await startResponse.json()) as DiagnosisStartResponse;
        const restoredAnswers = restoreAnswersFromSnapshot(
          startData.questions,
          startData.session.answersSnapshot,
        );

        setSessionId(startData.session.id);
        setQuestionSetTitle(startData.questionSet.title);
        setQuestions(startData.questions);
        setAnswers(restoredAnswers);
        setIntakeContext(startData.intakeContext ?? null);
        setCurrentQuestionIndex(
          resolveInitialQuestionIndex({
            questionCount: startData.questions.length,
            currentStep: startData.session.currentStep,
            restoredAnswersCount: Object.keys(restoredAnswers).length,
          }),
        );
        setCompanyId(startData.session.companyId);
        window.localStorage.setItem(COMPANY_STORAGE_KEY, startData.session.companyId);
      } catch {
        alert("Не удалось загрузить диагностику.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadData();
  }, [router]);

  const currentQuestion = questions[currentQuestionIndex];
  const currentValue = currentQuestion ? answers[currentQuestion.code] : undefined;
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const progressLabel = useMemo(() => {
    if (questions.length === 0) {
      return "";
    }

    return `${currentQuestionIndex + 1} из ${questions.length}`;
  }, [currentQuestionIndex, questions.length]);

  function handleSelect(questionCode: string, value: number) {
    setAnswers((current) => ({
      ...current,
      [questionCode]: value,
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

    setIsSubmitting(true);

    try {
      let resolvedSessionId = sessionId;
      let resolvedCompanyId = companyId ?? readStoredCompanyId();

      if (resolvedCompanyId && resolvedCompanyId !== companyId) {
        setCompanyId(resolvedCompanyId);
      }

      if (!resolvedCompanyId) {
        const dashboardResponse = await fetch("/api/dashboard", {
          cache: "no-store",
        });

        if (dashboardResponse.status === 404) {
          router.push("/onboarding");
          return;
        }

        if (!dashboardResponse.ok) {
          alert(
            await readApiError(
              dashboardResponse,
              "Не удалось загрузить данные компании.",
            ),
          );
          return;
        }

        const dashboardData =
          (await dashboardResponse.json()) as DashboardResponse;

        if (!dashboardData.company) {
          alert("Компания не найдена. Вернитесь в онбординг.");
          router.push("/onboarding");
          return;
        }

        resolvedCompanyId = dashboardData.company.id;
        setCompanyId(dashboardData.company.id);
        window.localStorage.setItem(COMPANY_STORAGE_KEY, dashboardData.company.id);
      }

      if (!resolvedSessionId) {
        const sessionResponse = await fetch("/api/diagnosis/start", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            resolvedCompanyId
              ? {
                  companyId: resolvedCompanyId,
                  intakeContext: readIntakeContextFromQuery(),
                }
              : {
                  intakeContext: readIntakeContextFromQuery(),
                },
          ),
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

        resolvedSessionId = sessionData.session.id;
        setSessionId(sessionData.session.id);
        setIntakeContext(
          "intakeContext" in sessionData ? sessionData.intakeContext ?? null : null,
        );
      }

      if (!resolvedCompanyId) {
        alert("Компания не найдена. Вернитесь в онбординг.");
        router.push("/onboarding");
        return;
      }

      const submitResponse = await fetch("/api/diagnosis/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: resolvedSessionId,
          answers: buildSubmitAnswers(questions, answers),
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

      setSessionId(submitData.session.id);

      if (!isLastQuestion) {
        setCurrentQuestionIndex((index) => index + 1);
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
        {intakeContext && (intakeContext.goal || intakeContext.symptoms.length > 0) ? (
          <section className="result-card">
            <h2>Что уже зафиксировано</h2>
            {intakeContext.goal ? <p><strong>Цель:</strong> {intakeContext.goal}</p> : null}
            {intakeContext.symptoms.length > 0 ? (
              <div>
                <p><strong>Что уже видно по симптомам:</strong></p>
                <ul className="plain-list">
                  {intakeContext.symptoms.map((symptom) => (
                    <li key={symptom}>{symptom}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="muted">
              Диагностика продолжит этот контекст, а не начнётся с пустого листа.
            </p>
          </section>
        ) : null}
        <h1>{currentQuestion.questionText}</h1>

        <div className="option-stack">
          {currentQuestion.options.map((option) => {
            const isSelected = answers[currentQuestion.code] === option.value;

            return (
              <button
                key={option.value}
                type="button"
                className={isSelected ? "option-button option-button-active" : "option-button"}
                onClick={() => handleSelect(currentQuestion.code, option.value)}
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
