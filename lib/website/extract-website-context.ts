import "server-only";

import { extractUrls } from "@/lib/url-utils";

export interface WebsiteContext {
  url: string;
  title: string | null;
  description: string | null;
  headings: string[];
  textSample: string;
}

function stripHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&laquo;/gi, "«")
    .replace(/&raquo;/gi, "»")
    .replace(/&mdash;/gi, "—")
    .replace(/&ndash;/gi, "–");
}

function compactText(value: string) {
  return decodeHtmlEntities(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstMatch(html: string, pattern: RegExp) {
  return compactText(pattern.exec(html)?.[1] ?? "") || null;
}

function extractHeadings(html: string) {
  return Array.from(html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi))
    .map((match) => compactText(match[1] ?? ""))
    .filter(Boolean)
    .slice(0, 12);
}

export async function extractWebsiteContextFromText(text: string): Promise<WebsiteContext | null> {
  const [url] = extractUrls(text);

  if (!url) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MBA-DiagnosticBot/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) {
      console.error("WEBSITE_CONTEXT_FETCH_FAILED", {
        status: response.status,
        url,
      });
      return { url, title: null, description: null, headings: [], textSample: "" };
    }

    const html = await response.text();
    const cleaned = stripHtml(html);
    const title = firstMatch(cleaned, /<title[^>]*>([\s\S]*?)<\/title>/i);
    const description =
      firstMatch(cleaned, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i) ??
      firstMatch(cleaned, /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i) ??
      firstMatch(cleaned, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["'][^>]*>/i);
    const headings = extractHeadings(cleaned);
    const textSample = compactText(cleaned).slice(0, 5000);

    return {
      url,
      title,
      description,
      headings,
      textSample,
    };
  } catch (error) {
    console.error("WEBSITE_CONTEXT_FETCH_ERROR", {
      url,
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return { url, title: null, description: null, headings: [], textSample: "" };
  } finally {
    clearTimeout(timeout);
  }
}

export function formatWebsiteContext(context: WebsiteContext | null) {
  if (!context) {
    return null;
  }

  return [
    `URL: ${context.url}`,
    context.title ? `Title: ${context.title}` : null,
    context.description ? `Description: ${context.description}` : null,
    context.headings.length > 0 ? `Headings:\n${context.headings.map((item) => `- ${item}`).join("\n")}` : null,
    context.textSample ? `Visible text sample:\n${context.textSample}` : null,
  ]
    .filter((item): item is string => Boolean(item))
    .join("\n\n");
}
