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

export const diagnosisSessionSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  questionSetId: z.string().uuid(),
  status: z.enum(["in_progress", "completed"]),
  totalScore: z.number().int().nullable(),
  summaryKey: z.enum(["low", "medium", "high"]).nullable(),
  createdAt: z.string().min(1),
  completedAt: z.string().nullable(),
});

export const diagnosisAnswerInputSchema = z.object({
  questionId: z.string().uuid(),
  answerValue: z.number().int().min(1).max(5),
  answerLabel: z.string().min(1).nullable().optional(),
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
  shortSummary: z.string().min(1),
  keyFocus: z.string().min(1),
  whyNow: z.string().min(1),
});

export const diagnosisResultResponseSchema = z.object({
  questionSet: diagnosisQuestionSetSchema,
  questions: z.array(diagnosisQuestionSchema),
  session: diagnosisSessionSchema,
  answers: z.array(diagnosisAnswerInputSchema),
  dimensionScores: z.array(diagnosisDimensionScoreSchema),
  summary: diagnosisResultSummarySchema,
  tools: z.array(diagnosisRecommendedToolSchema).max(5),
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
export type DiagnosisResultResponseInput = z.infer<
  typeof diagnosisResultResponseSchema
>;
