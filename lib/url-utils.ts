export function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s]+|(?:^|\s)([\w-]+\.[a-z]{2,}[^\s]*)/gi) ?? [];

  return matches
    .map((match) => match.trim())
    .map((match) => (match.startsWith("http") ? match : `https://${match}`))
    .map((match) => match.replace(/[),.;!?]+$/g, ""))
    .filter((match, index, array) => array.indexOf(match) === index);
}

export function hasUrl(text: string) {
  return extractUrls(text).length > 0;
}

export function stripUrls(text: string) {
  return extractUrls(text).reduce(
    (result, url) => result.replace(url, "").replace(url.replace(/^https?:\/\//, ""), ""),
    text,
  );
}

export function hasNonUrlText(text: string) {
  return stripUrls(text)
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim().length > 0;
}
