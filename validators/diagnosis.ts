import { z } from "zod";

export const diagnosisQuestionOptionSchema = z.object({
  value: z.number().int().min(1).max(5),
  label: z.string().min(1),
});

export const diagnosisQuestionSetSchema = z.object({
  id: z.string().uuid(),
  code: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullable(),
  version: z.number().int().min(1),
  isActive: z.boolean(),
  createdAt: z.string().min(1),
});

export const diagnosisQuestionSchema = z.object({
  id: z.string().min(1),
  questionSetId: z.string().min(1),
  code: z.string().min(1),
  title: z.string().nullable(),
  questionText: z.string().min(1),
  dimension: z.string().min(1),
  position: z.number().int().nullable(),
  orderIndex: z.number().int().min(1),
  inputType: z.enum(["scale", "single_select"]),
  isRequired: z.boolean(),
  options: z.array(diagnosisQuestionOptionSchema).min(1).max(5),
  weight: z.number().int().positive(),
  meta: z.record(z.string(), z.unknown()),
  createdAt: z.string().min(1),
});

export const diagnosisAnswerInputSchema = z.object({
  questionId: z.string().uuid(),
  answerValue: z.number().int().min(1).max(5),
  answerLabel: z.string().min(1).nullable().optional(),
});

export const diagnosisSessionSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  questionSetId: z.string().uuid(),
  status: z.enum(["in_progress", "completed"]),
  totalScore: z.number().int().nullable(),
  summaryKey: z.enum(["low", "medium", "high"]).nullable(),
  currentStep: z.number().int().min(1).nullable().optional(),
  answersSnapshot: z.array(diagnosisAnswerInputSchema).nullable().optional(),
  createdAt: z.string().min(1),
  completedAt: z.string().nullable(),
});

export const diagnosisSubmitAnswerSchema = z.object({
  questionId: z.string().uuid(),
  value: z.number().int().min(1).max(5),
});

export const diagnosisStartRequestSchema = z.object({
  companyId: z.string().uuid().optional(),
  questionSetCode: z.string().min(1).default("express_v1").optional(),
});

export const diagnosisStartGetResponseSchema = z.object({
  questionSet: diagnosisQuestionSetSchema,
  questions: z.array(diagnosisQuestionSchema),
});

export const diagnosisStartResponseSchema = z.object({
  session: diagnosisSessionSchema,
  questionSet: diagnosisQuestionSetSchema,
  questions: z.array(diagnosisQuestionSchema),
});

export const diagnosisSubmitRequestSchema = z.object({
  sessionId: z.string().uuid(),
  answers: z.array(diagnosisSubmitAnswerSchema).min(1),
});

export const diagnosisSubmitResponseSchema = z.object({
  session: diagnosisSessionSchema,
  totalScore: z.number().int().min(0),
  answeredCount: z.number().int().min(0),
  summaryKey: z.enum(["low", "medium", "high"]),
});

export const diagnosisDimensionScoreSchema = z.object({
  dimension: z.string().min(1),
  averageScore: z.number().min(1).max(5),
});

export const diagnosisResultSummarySchema = z.object({
  key: z.enum(["low", "medium", "high"]),
  title: z.string().min(1),
  description: z.string().min(1),
  strengths: z.array(z.string().min(1)),
  risks: z.array(z.string().min(1)),
});

export const diagnosisRecommendedToolSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  whyRecommended: z.string().min(1),
  externalUrl: z.string().min(1),
});

export const diagnosisResultRecommendedToolSchema = z.object({
  title: z.string().min(1),
  whyNow: z.string().min(1),
  whatItClarifies: z.string().min(1),
  source: z.enum(["hybrid", "deterministic"]),
});

export const aiResultSummaryResponseSchema = z.object({
  narrative: z.string().min(1),
  priorities: z.array(z.string().min(1)).min(2).max(4),
  risks: z.array(z.string().min(1)).min(2).max(4),
  strengths: z.array(z.string().min(1)).min(2).max(4),
  nextSteps: z.array(z.string().min(1)).min(2).max(4),
});

export const aiResultChatRequestSchema = z.object({
  question: z.string().trim().min(1).max(2000),
});

export const aiResultChatResponseSchema = z.object({
  reply: z.string().trim().min(1),
  suggestedFollowups: z.array(z.string().trim().min(1)).max(4).optional(),
});

export const resultRecommendedToolItemSchema = z.object({
  slug: z.string().trim().min(1),
  title: z.string().trim().min(1),
  whyRecommended: z.string().trim().min(1),
});

export const aiToolExplanationResponseSchema = z.object({
  whyThisTool: z.string().trim().min(1),
  whatProblemItSolves: z.array(z.string().trim().min(1)).min(2).max(4),
  whereToApply: z.array(z.string().trim().min(1)).min(2).max(4),
  whatToPrepare: z.array(z.string().trim().min(1)).min(2).max(4),
  commonMistakes: z.array(z.string().trim().min(1)).min(2).max(4),
  expectedOutcome: z.string().trim().min(1),
});

export const diagnosisSummaryContextSchema = z.object({
  weakestDomains: z.array(z.string().min(1)),
  strongestDomains: z.array(z.string().min(1)),
  topProblems: z.array(z.string().min(1)),
  recommendedTools: z.array(
    z.object({
      title: z.string().min(1),
      whyRecommended: z.string().min(1),
    }),
  ),
  company: z
    .object({
      id: z.string().min(1),
      name: z.string().min(1),
      industry: z.string().min(1),
      teamSize: z.string().min(1),
      revenueRange: z.string().nullable(),
      primaryGoal: z.string().nullable(),
    })
    .nullable(),
});

export const diagnosisAiSummarySchema = z.object({
  mainSummary: z.string().min(1),
  mainFocus: z.string().min(1),
  whyNow: z.array(z.string().min(1)).length(3),
  strengths: z.array(z.string().min(1)).length(2),
  firstSteps: z.array(z.string().min(1)).length(3),
});

export const diagnosisChatContextSchema = z.object({
  company: z
    .object({
      name: z.string().nullable(),
      industry: z.string().nullable(),
      teamSize: z.string().nullable(),
      revenue: z.string().nullable(),
      goal: z.string().nullable(),
    })
    .nullable(),
  scores: z.object({
    owner: z.number().nullable(),
    market: z.number().nullable(),
    strategy: z.number().nullable(),
    product: z.number().nullable(),
    sales: z.number().nullable(),
    operations: z.number().nullable(),
    finance: z.number().nullable(),
    team: z.number().nullable(),
    management: z.number().nullable(),
    tech: z.number().nullable(),
    data: z.number().nullable(),
  }),
  summary: z.object({
    main_summary: z.string().min(1),
    main_focus: z.string().min(1),
    why_now: z.array(z.string().min(1)).length(3),
    strengths: z.array(z.string().min(1)).length(2),
    first_steps: z.array(z.string().min(1)).length(3),
  }),
});

export const diagnosisChatRequestSchema = z.object({
  sessionId: z.string().uuid(),
  message: z.string().trim().min(1).max(2000),
  mode: z.enum(["growth", "risk", "start"]).optional(),
  step: z.number().int().min(1).max(2).optional(),
  selectedPath: z.string().trim().min(1).max(200).optional(),
});

export const diagnosisChatReplySchema = z.object({
  reply: z.string().trim().min(1),
  mode: z.enum(["growth", "risk", "start"]).nullable().optional(),
  step: z.number().int().min(1).max(2).nullable().optional(),
  quickReplies: z
    .array(
      z.object({
        label: z.string().trim().min(1),
        selectedPath: z.string().trim().min(1),
      }),
    )
    .optional(),
});

export const diagnosisChatResponseSchema = diagnosisChatReplySchema.extend({
  context: diagnosisChatContextSchema,
});

export const diagnosisResultResponseSchema = z.object({
  questionSet: diagnosisQuestionSetSchema,
  questions: z.array(diagnosisQuestionSchema),
  session: diagnosisSessionSchema,
  answers: z.array(diagnosisAnswerInputSchema),
  dimensionScores: z.array(diagnosisDimensionScoreSchema),
  summary: diagnosisResultSummarySchema,
  tools: z.array(diagnosisRecommendedToolSchema).max(5),
  resultRecommendedTools: z.array(diagnosisResultRecommendedToolSchema).max(3),
  summaryContext: diagnosisSummaryContextSchema,
  aiSummary: diagnosisAiSummarySchema.nullable(),
});

export type DiagnosisQuestionOptionInput = z.infer<
  typeof diagnosisQuestionOptionSchema
>;
export type DiagnosisQuestionSetInput = z.infer<typeof diagnosisQuestionSetSchema>;
export type DiagnosisQuestionInput = z.infer<typeof diagnosisQuestionSchema>;
export type DiagnosisStartRequestInput = z.infer<
  typeof diagnosisStartRequestSchema
>;
export type DiagnosisStartResponseInput = z.infer<
  typeof diagnosisStartResponseSchema
>;
export type DiagnosisSubmitRequestInput = z.infer<
  typeof diagnosisSubmitRequestSchema
>;
export type DiagnosisSubmitResponseInput = z.infer<
  typeof diagnosisSubmitResponseSchema
>;
export type DiagnosisChatRequestInput = z.infer<typeof diagnosisChatRequestSchema>;
export type DiagnosisChatResponseInput = z.infer<typeof diagnosisChatResponseSchema>;
export type DiagnosisResultResponseInput = z.infer<
  typeof diagnosisResultResponseSchema
>;
