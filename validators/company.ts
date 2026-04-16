import { z } from "zod";

export const companyPayloadSchema = z.object({
  name: z.string().trim().min(2, "Укажите название компании."),
  industry: z.string().trim().min(2, "Укажите сферу бизнеса."),
  team_size: z.string().trim().min(1, "Выберите размер команды."),
  monthly_revenue_range: z
    .string()
    .trim()
    .min(1, "Выберите диапазон выручки."),
  goal: z.string().trim().min(5, "Коротко опишите цель."),
});

export type CompanyPayloadInput = z.infer<typeof companyPayloadSchema>;
