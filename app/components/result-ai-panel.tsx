"use client";

import { useState, type FormEvent } from "react";

import type {
  ResultAiChatApiResponse,
  ResultAiSummaryApiResponse,
} from "@/types/api";

type ResultAiPanelProps = {
  summaryUrl: string;
  chatUrl: string;
};

export function ResultAiPanel({ summaryUrl, chatUrl }: ResultAiPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [summary, setSummary] = useState<ResultAiSummaryApiResponse | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [lastSubmittedQuestion, setLastSubmittedQuestion] = useState("");
  const [chatReply, setChatReply] = useState<ResultAiChatApiResponse | null>(null);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  async function loadSummary(forceReload = false) {
    setIsOpen(true);

    if ((summary && !forceReload) || isLoadingSummary) {
      return;
    }

    setIsLoadingSummary(true);
    setSummaryError(null);

    try {
      const response = await fetch(summaryUrl, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        setSummaryError("Не удалось получить AI-разбор результата.");
        return;
      }

      setSummary((await response.json()) as ResultAiSummaryApiResponse);
      setSummaryError(null);
    } catch {
      setSummaryError("Не удалось получить AI-разбор результата.");
    } finally {
      setIsLoadingSummary(false);
    }
  }

  async function sendQuestion(nextQuestion: string) {
    if (!nextQuestion.trim() || isLoadingChat) {
      return;
    }

    setIsLoadingChat(true);
    setChatError(null);
    setLastSubmittedQuestion(nextQuestion.trim());

    try {
      const response = await fetch(chatUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: nextQuestion.trim(),
        }),
      });

      if (!response.ok) {
        setChatError("Не удалось получить ответ AI.");
        return;
      }

      setChatReply((await response.json()) as ResultAiChatApiResponse);
      setQuestion("");
    } catch {
      setChatError("Не удалось получить ответ AI.");
    } finally {
      setIsLoadingChat(false);
    }
  }

  async function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await sendQuestion(question);
  }

  function dedupeFollowups(items: string[] | undefined) {
    return Array.from(new Set(items ?? [])).slice(0, 4);
  }

  return (
    <section>
      <div className="action-row">
        <button type="button" onClick={() => void loadSummary()} disabled={isLoadingSummary}>
          {isLoadingSummary ? "Загружаем AI-разбор..." : "AI-разбор результата"}
        </button>
      </div>

      {isOpen ? (
        <div className="section-stack">
          {!summary && !summaryError && !isLoadingSummary ? (
            <p className="muted">Нажмите кнопку выше, чтобы получить короткий AI-разбор результата и задать уточняющий вопрос.</p>
          ) : null}

          {summaryError ? (
            <div className="section-stack">
              <p className="muted">{summaryError}</p>
              <div className="action-row">
                <button type="button" onClick={() => void loadSummary(true)} disabled={isLoadingSummary}>
                  Повторить
                </button>
              </div>
            </div>
          ) : null}

          {summary ? (
            <>
              <section>
                <h2>AI-интерпретация</h2>
                <p>{summary.narrative}</p>
              </section>

              <section>
                <h3>Приоритеты</h3>
                <ul className="plain-list">
                  {summary.priorities.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>

              <section>
                <h3>Риски</h3>
                <ul className="plain-list">
                  {summary.risks.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>

              <section>
                <h3>Следующие шаги</h3>
                <ul className="plain-list">
                  {summary.nextSteps.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            </>
          ) : null}

          <section>
            <h3>Спросить AI</h3>
            <form className="section-stack" onSubmit={submitQuestion}>
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                rows={3}
                placeholder="Например: в чём главный риск? С чего начать? Что изменилось по сравнению с прошлой диагностикой?"
              />
              <div className="action-row">
                <button type="submit" disabled={isLoadingChat || question.trim().length === 0}>
                  {isLoadingChat ? "Думаем..." : "Спросить"}
                </button>
              </div>
            </form>

            {!chatReply && !chatError ? (
              <p className="muted">Можно спросить про главный риск, точку старта или, если есть история, про динамику между диагностиками.</p>
            ) : null}

            {chatError ? (
              <div className="section-stack">
                <p className="muted">{chatError}</p>
                {lastSubmittedQuestion ? (
                  <div className="action-row">
                    <button
                      type="button"
                      onClick={() => void sendQuestion(lastSubmittedQuestion)}
                      disabled={isLoadingChat}
                    >
                      Повторить вопрос
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {chatReply ? (
              <div className="section-stack">
                <p>{chatReply.reply}</p>
                {dedupeFollowups(chatReply.suggestedFollowups).length ? (
                  <div className="action-row">
                    {dedupeFollowups(chatReply.suggestedFollowups).map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => {
                          setQuestion(item);
                          void sendQuestion(item);
                        }}
                        disabled={isLoadingChat}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </section>
  );
}
