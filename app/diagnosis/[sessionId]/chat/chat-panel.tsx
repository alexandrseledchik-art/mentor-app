"use client";

import { useState, type FormEvent } from "react";

import type { DiagnosisChatResponse } from "@/types/api";
import type { DiagnosisChatMode, DiagnosisChatQuickReply } from "@/types/domain";

const STARTER_QUESTIONS = [
  "Поясни главный вывод",
  "С чего начать",
  "Что сейчас важнее всего",
  "Что мешает росту",
  "Где главный риск",
];

const STARTER_MODES: Partial<Record<string, DiagnosisChatMode>> = {
  "Что мешает росту": "growth",
  "Где главный риск": "risk",
  "С чего начать": "start",
};

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

export function DiagnosisChatPanel({ sessionId }: { sessionId: string }) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeMode, setActiveMode] = useState<DiagnosisChatMode | null>(null);
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [quickReplies, setQuickReplies] = useState<DiagnosisChatQuickReply[]>([]);

  async function sendMessage(
    nextMessage: string,
    options?: {
      mode?: DiagnosisChatMode | null;
      step?: number | null;
      selectedPath?: string;
    },
  ) {
    const trimmed = nextMessage.trim();

    if (!trimmed) {
      return;
    }

    setError(null);
    setIsLoading(true);
    setMessages((current) => [...current, { role: "user", text: trimmed }]);
    setMessage("");

    try {
      const response = await fetch("/api/diagnosis/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          message: trimmed,
          mode: options?.mode ?? undefined,
          step: options?.step ?? undefined,
          selectedPath: options?.selectedPath,
        }),
      });

      const data = (await response.json()) as DiagnosisChatResponse | { error?: string };

      if (!response.ok || !("reply" in data)) {
        throw new Error(
          "error" in data && typeof data.error === "string"
            ? data.error
            : "Не удалось загрузить разбор результата. Попробуйте ещё раз.",
        );
      }

      setMessages((current) => [...current, { role: "assistant", text: data.reply }]);
      setActiveMode(data.mode ?? null);
      setActiveStep(data.step ?? null);
      setQuickReplies(data.quickReplies ?? []);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Не удалось загрузить разбор результата. Попробуйте ещё раз.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendMessage(message);
  }

  return (
    <div className="section-stack">
      <section>
        <h2>Разбор вашего бизнеса</h2>
        <p className="muted">
          Этот чат помогает разобрать результат диагностики и перевести его в конкретные действия.
        </p>
      </section>

      <section>
        <div className="action-row">
          {STARTER_QUESTIONS.map((item) => (
            <button
              key={item}
              type="button"
              className="starter-button"
              disabled={isLoading}
              onClick={() =>
                void sendMessage(item, {
                  mode: STARTER_MODES[item] ?? null,
                  step: STARTER_MODES[item] ? 1 : null,
                })
              }
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      <section className="chat-log">
        {messages.length > 0 ? messages.map((item, index) => (
          <div
            key={`${item.role}-${index}`}
            className={`chat-message ${
              item.role === "user" ? "chat-message-user" : "chat-message-assistant"
            }`}
          >
            <strong>{item.role === "user" ? "Вы" : "Разбор"}</strong>
            <p>{item.text}</p>
          </div>
        )) : (
          <p className="muted">
            Задайте вопрос по вашему результату. Здесь можно быстро понять, что делать дальше и на чём сфокусироваться в первую очередь.
          </p>
        )}
      </section>

      {quickReplies.length > 0 ? (
        <section>
          <div className="action-row">
            {quickReplies.map((item) => (
              <button
                key={`${activeMode ?? "mode"}-${item.selectedPath}`}
                type="button"
                className="starter-button"
                disabled={isLoading}
                onClick={() =>
                  void sendMessage(item.label, {
                    mode: activeMode,
                    step: (activeStep ?? 1) + 1,
                    selectedPath: item.selectedPath,
                  })
                }
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <form className="form-stack" onSubmit={handleSubmit}>
        <label className="field">
          <span>Ваш вопрос</span>
          <textarea
            rows={4}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Например: что сейчас ограничивает рост сильнее всего?"
            disabled={isLoading}
          />
        </label>

        <button type="submit" disabled={isLoading || message.trim().length === 0}>
          {isLoading ? "Идёт разбор..." : "Продолжить разбор"}
        </button>

        {error ? <p className="muted">{error}</p> : null}
      </form>
    </div>
  );
}
