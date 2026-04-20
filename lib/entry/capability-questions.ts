import type { TelegramEntryReply } from "@/types/domain";

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s?]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(text: string, items: string[]) {
  return items.some((item) => text.includes(item));
}

export function isCapabilityQuestion(text: string) {
  const normalized = normalize(text);

  const asksAboutBotAbility =
    includesAny(normalized, [
      "ты понимаешь",
      "понимаешь ли",
      "умеешь ли",
      "ты умеешь",
      "можешь ли",
      "ты можешь",
      "ты принимаешь",
      "принимаешь голосовые",
      "голосовые принимаешь",
      "ты обрабатываешь",
      "обрабатываешь голосовые",
      "голосовые обрабатываешь",
      "поддерживаешь голосовые",
      "работают ли",
      "работает ли",
      "принимаешь ли",
      "обрабатываешь ли",
      "понимает ли бот",
      "умеет ли бот",
    ]) || normalized.endsWith("?");

  const asksAboutVoice =
    includesAny(normalized, [
      "голосов",
      "голосовые",
      "аудио",
      "voice",
      "audio",
      "речь",
      "надиктов",
    ]);

  return asksAboutBotAbility && asksAboutVoice;
}

export function buildCapabilityReply(text: string): TelegramEntryReply {
  const normalized = normalize(text);
  const isVoiceQuestion = includesAny(normalized, ["голосов", "голосовые", "аудио", "voice", "audio", "речь"]);

  if (isVoiceQuestion) {
    return {
      text: [
        "Да, я понимаю голосовые сообщения.",
        "Вы можете отправить голосовое, а я распознаю его и отвечу уже по смыслу вашего запроса.",
        "Сначала я пойму сам запрос, а уже потом поведу вас в скрининг, диагностику или к нужному следующему шагу.",
        "Если хотите, просто следующим сообщением опишите голосом ситуацию в бизнесе: что происходит, что не работает и какой результат вам нужен.",
      ].join("\n\n"),
      stage: "ready_for_routing",
    };
  }

  return {
    text: [
      "Да, я могу помочь с этим.",
      "Опишите, пожалуйста, сам запрос в 1–3 фразах, и я продолжу разбор по существу.",
    ].join("\n\n"),
    stage: "ready_for_routing",
  };
}
