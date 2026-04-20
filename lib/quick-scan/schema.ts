import { z } from "zod";

export const quickScanInputSchema = z.object({
  rawInput: z.string().trim().min(1),
  inputType: z.enum(["website", "text", "mixed"]),
  companyContext: z
    .object({
      name: z.string().nullable().optional(),
      industry: z.string().nullable().optional(),
      teamSize: z.string().nullable().optional(),
      revenueRange: z.string().nullable().optional(),
      primaryGoal: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});

export const quickScanResultSchema = z.object({
  inputType: z.enum(["website", "text", "mixed"]),
  preliminarySummary: z.string().trim().min(1),
  likelyLossZones: z
    .array(
      z.object({
        area: z.string().trim().min(1),
        whyLikely: z.string().trim().min(1),
        confidence: z.enum(["low", "medium", "high"]),
      }),
    )
    .min(1)
    .max(4),
  constraintVersions: z
    .array(
      z.object({
        constraint: z.string().trim().min(1),
        basis: z.string().trim().min(1),
        confidence: z.enum(["low", "medium", "high"]),
      }),
    )
    .min(1)
    .max(3),
  firstWaveCandidate: z.object({
    direction: z.string().trim().min(1),
    whyThisFirst: z.string().trim().min(1),
  }),
  toolCandidates: z
    .array(
      z.object({
        title: z.string().trim().min(1),
        whyRelevantNow: z.string().trim().min(1),
      }),
    )
    .min(1)
    .max(4),
  clarificationQuestion: z
    .object({
      text: z.string().trim().min(1),
      whyItMatters: z.string().trim().min(1),
    })
    .optional(),
  disclaimer: z.string().trim().min(1),
});

export type QuickScanInput = z.infer<typeof quickScanInputSchema>;
export type QuickScanResult = z.infer<typeof quickScanResultSchema>;

export const QUICK_SCAN_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    inputType: { type: "string", enum: ["website", "text", "mixed"] },
    preliminarySummary: { type: "string" },
    likelyLossZones: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          area: { type: "string" },
          whyLikely: { type: "string" },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["area", "whyLikely", "confidence"],
      },
    },
    constraintVersions: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          constraint: { type: "string" },
          basis: { type: "string" },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["constraint", "basis", "confidence"],
      },
    },
    firstWaveCandidate: {
      type: "object",
      additionalProperties: false,
      properties: {
        direction: { type: "string" },
        whyThisFirst: { type: "string" },
      },
      required: ["direction", "whyThisFirst"],
    },
    toolCandidates: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          whyRelevantNow: { type: "string" },
        },
        required: ["title", "whyRelevantNow"],
      },
    },
    clarificationQuestion: {
      type: "object",
      additionalProperties: false,
      properties: {
        text: { type: "string" },
        whyItMatters: { type: "string" },
      },
      required: ["text", "whyItMatters"],
    },
    disclaimer: { type: "string" },
  },
  required: [
    "inputType",
    "preliminarySummary",
    "likelyLossZones",
    "constraintVersions",
    "firstWaveCandidate",
    "toolCandidates",
    "disclaimer",
  ],
} as const;
