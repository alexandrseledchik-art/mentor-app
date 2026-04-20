import { hasUrl } from "@/lib/url-utils";
import type { EntryMode } from "@/types/domain";

export function shouldRouteWebsiteInputDirectly(params: {
  mode: EntryMode;
  rawText: string;
}) {
  return params.mode !== "specific_tool_request" && hasUrl(params.rawText);
}
