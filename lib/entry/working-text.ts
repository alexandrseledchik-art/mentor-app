import { POST_WEBSITE_SCREENING_REQUEST_KEY } from "@/lib/entry/constants";

type ClarifyingAnswer = {
  questionKey: string;
  questionText?: string;
  answerText: string;
};

type WorkingTextSession = {
  initialMessage: string;
  lastQuestionKey: string | null;
  clarifyingAnswers: ClarifyingAnswer[];
};

function looksLikeWebsiteReference(text: string) {
  return /https?:\/\/\S+/i.test(text);
}

function hasWebsiteScreeningHistory(session: WorkingTextSession) {
  return session.clarifyingAnswers.some(
    (item) => item.questionKey === POST_WEBSITE_SCREENING_REQUEST_KEY,
  );
}

export function buildWorkingText(
  session: WorkingTextSession | null,
  currentMessage: string,
) {
  if (!session) {
    return currentMessage;
  }

  if (session.lastQuestionKey === POST_WEBSITE_SCREENING_REQUEST_KEY) {
    return currentMessage;
  }

  const referenceContext =
    looksLikeWebsiteReference(session.initialMessage) && hasWebsiteScreeningHistory(session)
      ? "Контекст: ранее пользователь прислал ссылку как объект внешнего разбора. Не считай это подтверждением, что бизнес по ссылке принадлежит пользователю или находится под его управлением."
      : null;

  const latestTurn = session.clarifyingAnswers.at(-1) ?? null;
  const antiRepeatContext =
    latestTurn && latestTurn.questionText
      ? "Важно: если текущее сообщение уже отвечает на предыдущий вопрос ассистента, следующий шаг должен продвинуть разбор дальше, а не повторять тот же вопрос другими словами."
      : null;

  return [
    referenceContext,
    antiRepeatContext,
    `Первичное сообщение пользователя: ${session.initialMessage}`,
    latestTurn?.questionText ? `Последний вопрос ассистента: ${latestTurn.questionText}` : null,
    latestTurn ? `Последний ответ пользователя: ${latestTurn.answerText}` : null,
    ...session.clarifyingAnswers.flatMap((item) => [
      item.questionText ? `Предыдущий вопрос ассистента: ${item.questionText}` : null,
      `Ответ пользователя: ${item.answerText}`,
    ]),
    `Текущее сообщение пользователя: ${currentMessage}`,
  ]
    .filter(Boolean)
    .join("\n");
}
