export const DEFAULT_OPENAI_MODEL = "gpt-5.4-mini";

export function getOpenAiModel() {
  const configuredModel = process.env.OPENAI_MODEL?.trim();

  return configuredModel && configuredModel.length > 0
    ? configuredModel
    : DEFAULT_OPENAI_MODEL;
}

export function getOpenAiNumberEnv(name: string, fallback: number) {
  const value = Number(process.env[name] ?? String(fallback));

  return Number.isFinite(value) ? value : fallback;
}
