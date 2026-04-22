const LEADING_FILLER_PATTERNS = [
  /^(?:привет|здравствуйте|добрый день)[!.,:\s-]*/i,
  /^(?:понял|понимаю|вижу|ясно|хорошо|окей|ок)[!.,:\s-]*/i,
];

const GLOBAL_FORMAL_PATTERNS = [
  /\bэто важный шаг\b[!.,:\s-]*/gi,
  /\bчтобы помочь(?:\s+\S+){0,4}\s*,?\s*/gi,
  /\bчтобы продолжить,\s*уточните:\s*/gi,
];

export function buildGreetingOnlyReply(text: string) {
  const normalized = text.trim().toLowerCase();

  if (
    /^(привет|здравствуйте|здрасьте|добрый день|добрый вечер|салют|хай|hello|hi)[!.?]*$/.test(
      normalized,
    )
  ) {
    return "Давай сразу к делу: что у тебя сейчас буксует сильнее всего — продажи, прибыль, управляемость или подготовка к продаже?";
  }

  return null;
}

function trimLeadingFillers(text: string) {
  let normalized = text.trim();

  for (const pattern of LEADING_FILLER_PATTERNS) {
    normalized = normalized.replace(pattern, "").trimStart();
  }

  return normalized;
}

export function normalizeReplyText(params: {
  action: "capability" | "website_screening" | "tool_navigation" | "ask_question" | "diagnostic_result";
  text: string;
}) {
  let normalized = trimLeadingFillers(params.text);

  for (const pattern of GLOBAL_FORMAL_PATTERNS) {
    normalized = normalized.replace(pattern, "");
  }

  if (params.action !== "website_screening") {
    normalized = normalized.replace(
      /\n{2,}Что дальше:\s*[\s\S]*$/i,
      "",
    );
    normalized = normalized.replace(
      /(?:^|\n)\s*Что будем разбирать дальше: сам сайт и воронку или бизнес, который за ним стоит\?\s*$/i,
      "",
    );
    normalized = normalized.replace(
      /(?:^|\n)\s*Напишите запрос в 1[–-]2 фразах\.?\s*$/i,
      "",
    );
  }

  normalized = normalized
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return normalized || params.text.trim();
}

export function hasFormalAssistantPhrasing(params: {
  action: "capability" | "website_screening" | "tool_navigation" | "ask_question" | "diagnostic_result";
  text: string;
}) {
  const text = params.text;

  if (/Вы хотите/i.test(text)) {
    return true;
  }

  if (/Чтобы помочь/i.test(text)) {
    return true;
  }

  if (/Чтобы продолжить, уточните/i.test(text)) {
    return true;
  }

  if (/какой запрос хотите разобрать дальше/i.test(text)) {
    return true;
  }

  if (/это важный шаг/i.test(text)) {
    return true;
  }

  if (params.action === "capability" && /\?\s*$/.test(text.trim())) {
    return true;
  }

  return false;
}
