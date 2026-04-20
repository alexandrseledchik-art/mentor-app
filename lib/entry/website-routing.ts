import { hasNonUrlText, hasUrl } from "@/lib/url-utils";
import type { EntryMode } from "@/types/domain";

export function shouldRouteWebsiteInputToScreening(params: {
  rawText: string;
}) {
  return hasUrl(params.rawText) && !hasNonUrlText(params.rawText);
}

export function shouldRouteWebsiteInputDirectly(params: {
  mode: EntryMode;
  rawText: string;
}) {
  return (
    params.mode !== "specific_tool_request" &&
    hasUrl(params.rawText) &&
    hasNonUrlText(params.rawText)
  );
}
