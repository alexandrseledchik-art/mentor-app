import type { Json } from "@/types/db";

export type AnalyticsEvent =
  | "entry_started"
  | "entry_mode_detected"
  | "entry_question_asked"
  | "entry_routed_to_website_screening"
  | "entry_routed_to_diagnosis"
  | "entry_routed_to_tool"
  | "entry_tool_not_found"
  | "entry_completed"
  | "entry_dropped"
  | "diagnosis_started"
  | "diagnosis_completed";

export type AnalyticsPayloadMap = {
  entry_started: {
    entryMode: string;
    rawTextLength: number;
  };
  entry_mode_detected: {
    entryMode: string;
    primaryIntent: string;
    confidence: string;
    possibleDomains: string[];
    turnCount: number;
  };
  entry_question_asked: {
    entryMode: string;
    questionKey: string;
    turnCount: number;
  };
  entry_routed_to_website_screening: {
    entryMode: string;
    primaryIntent: string;
    confidence: string;
    turnCount: number;
    reason: string;
  };
  entry_routed_to_diagnosis: {
    entryMode: string;
    primaryIntent: string;
    confidence: string;
    turnCount: number;
    reason: string;
    suggestedTool?: string;
  };
  entry_routed_to_tool: {
    entryMode: string;
    primaryIntent: string;
    confidence: string;
    toolSlug: string;
    turnCount: number;
    reason: string;
  };
  entry_tool_not_found: {
    entryMode: string;
    primaryIntent?: string;
    confidence: string;
    toolQuery: string;
    normalizedTool?: string;
    alternativeToolSlug?: string;
  };
  entry_completed: {
    action: string;
    stage: string;
    turnCount: number;
  };
  entry_dropped: {
    previousStage: string;
    previousEntryMode: string;
    previousTurnCount: number;
    resumedAfterHours: number;
  };
  diagnosis_started: {
    companyId: string;
    questionSetId: string;
    resumed: boolean;
    source?: string;
    entryMode?: string;
    entryIntent?: string;
  };
  diagnosis_completed: {
    companyId: string;
    summaryKey: string;
    totalScore: number;
    answeredCount: number;
  };
};

export type AnalyticsPayload<TEvent extends AnalyticsEvent> = AnalyticsPayloadMap[TEvent] & Json;
