import { z } from "zod";

/** Valores da escala de advertências editáveis no painel admin. */
export type DisciplineSettings = {
  level1SuspensionHours: number;
  level2SuspensionHours: number;
  /** Redutor do nível 2 em bps (8000 = ×0,8). */
  level2ScoreMultiplierBps: number;
  level2ScoreMultiplierDays: number;
  warningExpiryDays: number;
};

export const DEFAULT_DISCIPLINE_SETTINGS: DisciplineSettings = {
  level1SuspensionHours: 24,
  level2SuspensionHours: 72,
  level2ScoreMultiplierBps: 8000,
  level2ScoreMultiplierDays: 7,
  warningExpiryDays: 60,
};

export const disciplineSettingsSchema = z.object({
  level1SuspensionHours: z.number().int().min(1).max(24 * 90),
  level2SuspensionHours: z.number().int().min(1).max(24 * 90),
  level2ScoreMultiplierBps: z.number().int().min(100).max(9999),
  level2ScoreMultiplierDays: z.number().int().min(1).max(365),
  warningExpiryDays: z.number().int().min(1).max(730),
});
