import {
  DEFAULT_DISCIPLINE_SETTINGS,
  type DisciplineSettings,
} from "@/lib/clipper-discipline/settings";

import type { DisciplineDb } from "./restrictions";

const SETTINGS_ID = "default";

export async function getDisciplineSettings(
  db: DisciplineDb,
): Promise<DisciplineSettings> {
  const row = await db.clipperDisciplineSettings.findUnique({
    where: { id: SETTINGS_ID },
  });
  if (!row) return { ...DEFAULT_DISCIPLINE_SETTINGS };
  return {
    level1SuspensionHours: row.level1SuspensionHours,
    level2SuspensionHours: row.level2SuspensionHours,
    level2ScoreMultiplierBps: row.level2ScoreMultiplierBps,
    level2ScoreMultiplierDays: row.level2ScoreMultiplierDays,
    warningExpiryDays: row.warningExpiryDays,
  };
}

export async function updateDisciplineSettings(
  db: DisciplineDb,
  values: DisciplineSettings,
  actorUserId: string,
) {
  const previous = await getDisciplineSettings(db);
  await db.clipperDisciplineSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, ...values, updatedById: actorUserId },
    update: { ...values, updatedById: actorUserId },
  });
  await db.auditLog.create({
    data: {
      userId: actorUserId,
      action: "UPDATE",
      entityType: "ClipperDisciplineSettings",
      entityId: SETTINGS_ID,
      changes: { action: "update_clipper_discipline_settings", previous, next: values },
    },
  });
  return values;
}
