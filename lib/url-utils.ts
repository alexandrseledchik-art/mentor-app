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
