import { z } from "zod";

import { quickScanResultSchema } from "@/lib/quick-scan/schema";

export const causeContourSchema = z.enum([
  "market",
  "strategy",
  "product",
  "commercial",
  "operations",
  "finance",
  "team",
  "management",
  "owner",
  "technology",
  "data",
  "partners_ecosystem",
  "culture_change",
]);

export const diagnosticInputSchema = z.object({
  userMessage: z.string().trim().min(1),
  companyContext: z
    .object({
      companyId: z.string().optional(),
      name: z.string().nullable().optional(),
      industry: z.string().nullable().optional(),
      teamSize: z.string().nullable().optional(),
      revenueRange: z.string().nullable().optional(),
      primaryGoal: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  quickScan: quickScanResultSchema.nullable().optional(),
  clarifyingAnswers: z
    .array(
      z.object({
        question: z.string().trim().min(1),
        answer: z.string().trim().min(1),
      }),
    )
    .optional(),
  knownFacts: z.array(z.string().trim().min(1)).optional(),
});

export const diagnosticStructuredResultSchema = z.object({
  goal: z.object({
    primary: z.string().nullable(),
    hypotheses: z.array(z.string().trim().min(1)).max(3),
    explanation: z.string().trim().min(1),
  }),
  symptoms: z
    .array(
      z.object({
        text: z.string().trim().min(1),
        source: z.literal("client_words"),
      }),
    )
    .min(1)
    .max(7),
  situationHypotheses: z
    .array(
      z.object({
        symptom: z.string().trim().min(1),
        hypothesis: z.string().trim().min(1),
        confidence: z.enum(["working", "weak"]),
        basis: z.string().trim().min(1),
      }),
    )
    .min(1),
  causeContours: z
    .array(
      z.object({
        contour: causeContourSchema,
        hasProblem: z.enum(["yes", "no", "unclear"]),
        criticality: z.enum(["low", "medium", "high"]),
        role: z.enum(["cause", "effect", "unclear"]),
        basis: z.string().trim().min(1),
      }),
    )
    .min(1),
  confidenceMap: z.object({
    facts: z.array(z.string().trim().min(1)),
    interpretations: z.array(z.string().trim().min(1)),
    workingHypotheses: z.array(z.string().trim().min(1)),
    weakHypotheses: z.array(z.string().trim().min(1)),
  }),
  constraints: z.object({
    main: z.string().nullable(),
    secondary: z.string().nullable(),
    tertiary: z.string().nullable(),
    competingVersions: z.array(z.string().trim().min(1)).max(3),
    basis: z.string().trim().min(1),
  }),
  dominantSituations: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        description: z.string().trim().min(1),
        constraintEffect: z.string().trim().min(1),
      }),
    )
    .min(1)
    .max(3),
  hypothesisChecks: z
    .array(
      z.object({
        hypothesis: z.string().trim().min(1),
        confirms: z.array(z.string().trim().min(1)),
        refutes: z.array(z.string().trim().min(1)),
        questions: z.array(z.string().trim().min(1)).min(1).max(3),
      }),
    )
    .min(1),
  firstWave: z.object({
    directions: z.array(z.string().trim().min(1)).min(1).max(2),
    expectedChanges: z.array(z.string().trim().min(1)).min(1).max(4),
    successSignals: z.array(z.string().trim().min(1)).min(1).max(4),
    errorCost: z.string().trim().min(1),
    basis: z.string().trim().min(1),
  }),
  secondWave: z.object({
    transitionSignals: z.array(z.string().trim().min(1)).min(1).max(4),
    whatToConsolidate: z.array(z.string().trim().min(1)).min(1).max(4),
    nextBottleneckToPrevent: z.array(z.string().trim().min(1)).min(1).max(4),
    scalingReadiness: z.enum(["premature", "conditional", "ready"]),
    basis: z.string().trim().min(1),
  }),
  doNotDoNow: z
    .array(
      z.object({
        action: z.string().trim().min(1),
        whyAttractive: z.string().trim().min(1),
        whyNotNow: z.string().trim().min(1),
      }),
    )
    .min(1)
    .max(5),
  toolRecommendations: z
    .array(
      z.object({
        title: z.string().trim().min(1),
        reasonNow: z.string().trim().min(1),
        taskSolved: z.string().trim().min(1),
        whyNotSecondary: z.string().trim().min(1),
      }),
    )
    .min(1)
    .max(4),
  clientSummary: z.string().trim().min(1),
});

export type DiagnosticInput = z.infer<typeof diagnosticInputSchema>;
export type DiagnosticStructuredResult = z.infer<typeof diagnosticStructuredResultSchema>;

export const DIAGNOSTIC_CORE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    goal: {
      type: "object",
      additionalProperties: false,
      properties: {
        primary: { type: ["string", "null"] },
        hypotheses: { type: "array", items: { type: "string" }, maxItems: 3 },
        explanation: { type: "string" },
      },
      required: ["primary", "hypotheses", "explanation"],
    },
    symptoms: {
      type: "array",
      minItems: 1,
      maxItems: 7,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          text: { type: "string" },
          source: { type: "string", enum: ["client_words"] },
        },
        required: ["text", "source"],
      },
    },
    situationHypotheses: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          symptom: { type: "string" },
          hypothesis: { type: "string" },
          confidence: { type: "string", enum: ["working", "weak"] },
          basis: { type: "string" },
        },
        required: ["symptom", "hypothesis", "confidence", "basis"],
      },
    },
    causeContours: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          contour: {
            type: "string",
            enum: [
              "market",
              "strategy",
              "product",
              "commercial",
              "operations",
              "finance",
              "team",
              "management",
              "owner",
              "technology",
              "data",
              "partners_ecosystem",
              "culture_change",
            ],
          },
          hasProblem: { type: "string", enum: ["yes", "no", "unclear"] },
          criticality: { type: "string", enum: ["low", "medium", "high"] },
          role: { type: "string", enum: ["cause", "effect", "unclear"] },
          basis: { type: "string" },
        },
        required: ["contour", "hasProblem", "criticality", "role", "basis"],
      },
    },
    confidenceMap: {
      type: "object",
      additionalProperties: false,
      properties: {
        facts: { type: "array", items: { type: "string" } },
        interpretations: { type: "array", items: { type: "string" } },
        workingHypotheses: { type: "array", items: { type: "string" } },
        weakHypotheses: { type: "array", items: { type: "string" } },
      },
      required: ["facts", "interpretations", "workingHypotheses", "weakHypotheses"],
    },
    constraints: {
      type: "object",
      additionalProperties: false,
      properties: {
        main: { type: ["string", "null"] },
        secondary: { type: ["string", "null"] },
        tertiary: { type: ["string", "null"] },
        competingVersions: { type: "array", items: { type: "string" }, maxItems: 3 },
        basis: { type: "string" },
      },
      required: ["main", "secondary", "tertiary", "competingVersions", "basis"],
    },
    dominantSituations: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          constraintEffect: { type: "string" },
        },
        required: ["name", "description", "constraintEffect"],
      },
    },
    hypothesisChecks: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          hypothesis: { type: "string" },
          confirms: { type: "array", items: { type: "string" } },
          refutes: { type: "array", items: { type: "string" } },
          questions: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 },
        },
        required: ["hypothesis", "confirms", "refutes", "questions"],
      },
    },
    firstWave: {
      type: "object",
      additionalProperties: false,
      properties: {
        directions: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 2 },
        expectedChanges: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 4 },
        successSignals: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 4 },
        errorCost: { type: "string" },
        basis: { type: "string" },
      },
      required: ["directions", "expectedChanges", "successSignals", "errorCost", "basis"],
    },
    secondWave: {
      type: "object",
      additionalProperties: false,
      properties: {
        transitionSignals: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 4 },
        whatToConsolidate: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 4 },
        nextBottleneckToPrevent: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 4 },
        scalingReadiness: { type: "string", enum: ["premature", "conditional", "ready"] },
        basis: { type: "string" },
      },
      required: ["transitionSignals", "whatToConsolidate", "nextBottleneckToPrevent", "scalingReadiness", "basis"],
    },
    doNotDoNow: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          action: { type: "string" },
          whyAttractive: { type: "string" },
          whyNotNow: { type: "string" },
        },
        required: ["action", "whyAttractive", "whyNotNow"],
      },
    },
    toolRecommendations: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          reasonNow: { type: "string" },
          taskSolved: { type: "string" },
          whyNotSecondary: { type: "string" },
        },
        required: ["title", "reasonNow", "taskSolved", "whyNotSecondary"],
      },
    },
    clientSummary: { type: "string" },
  },
  required: [
    "goal",
    "symptoms",
    "situationHypotheses",
    "causeContours",
    "confidenceMap",
    "constraints",
    "dominantSituations",
    "hypothesisChecks",
    "firstWave",
    "secondWave",
    "doNotDoNow",
    "toolRecommendations",
    "clientSummary",
  ],
} as const;
