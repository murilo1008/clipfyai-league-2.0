-- Sistema de advertências de clipadores: tipos, tabelas, índices e FKs novos.
-- Mudança 100% aditiva: nenhum objeto existente é alterado.
-- Aplicar com: npx prisma db execute --file docs/db/clipper-discipline.sql --schema prisma/schema.prisma
-- O mesmo SQL é a migration 20261016120000_add_clipper_discipline do backend league;
-- em produção, aplique uma única vez pelo runbook do league (MIGRATIONS.md).
-- Pode ser reaplicado.
BEGIN;

DO $$
BEGIN
  CREATE TYPE "ClipperInfractionType" AS ENUM ('LIGHT', 'MEDIUM', 'SEVERE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ClipperWarningStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ClipperSanctionType" AS ENUM (
    'VIDEO_INVALIDATION', 'POSTING_SUSPENSION', 'SCORE_MULTIPLIER',
    'COMPETITION_REMOVAL', 'PAYOUT_HOLD', 'OBSERVATION_MODE', 'BONUS_LOSS',
    'PREMIUM_CAMPAIGN_BLOCK', 'DAY_POINTS_RESET', 'PLATFORM_BAN',
    'PODIUM_INELIGIBLE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- Banco que já tinha o tipo de uma aplicação anterior deste SQL.
ALTER TYPE "ClipperSanctionType" ADD VALUE IF NOT EXISTS 'PODIUM_INELIGIBLE';

DO $$
BEGIN
  CREATE TYPE "ClipperBanReviewStatus" AS ENUM ('PENDING', 'BANNED', 'DISMISSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ClipperWarning" (
  "id" TEXT NOT NULL,
  "clipperProfileId" TEXT NOT NULL,
  "campaignId" TEXT,
  "clipPostId" TEXT,
  "videoUrl" TEXT,
  "infractionType" "ClipperInfractionType" NOT NULL,
  "level" INTEGER,
  "suggestedLevel" INTEGER,
  "reason" TEXT NOT NULL,
  "status" "ClipperWarningStatus" NOT NULL DEFAULT 'ACTIVE',
  "appliedById" TEXT NOT NULL,
  "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "revokedById" TEXT,
  "revokeReason" TEXT,
  "defenseText" TEXT,
  "defenseSubmittedAt" TIMESTAMP(3),
  "banReviewStatus" "ClipperBanReviewStatus",
  "banReviewedAt" TIMESTAMP(3),
  "banReviewedById" TEXT,
  "configSnapshot" JSONB NOT NULL,
  "effects" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClipperWarning_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ClipperSanction" (
  "id" TEXT NOT NULL,
  "clipperProfileId" TEXT NOT NULL,
  "warningId" TEXT,
  "type" "ClipperSanctionType" NOT NULL,
  "campaignId" TEXT,
  "clipPostId" TEXT,
  "scoreMultiplierBps" INTEGER,
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" TIMESTAMP(3),
  "reason" TEXT,
  "createdById" TEXT NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "revokedById" TEXT,
  "revokeReason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClipperSanction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ClipperDisciplineSettings" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "level1SuspensionHours" INTEGER NOT NULL DEFAULT 24,
  "level2SuspensionHours" INTEGER NOT NULL DEFAULT 72,
  "level2ScoreMultiplierBps" INTEGER NOT NULL DEFAULT 8000,
  "level2ScoreMultiplierDays" INTEGER NOT NULL DEFAULT 7,
  "warningExpiryDays" INTEGER NOT NULL DEFAULT 60,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClipperDisciplineSettings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ClipperWarning_clipperProfileId_status_expiresAt_idx"
  ON "ClipperWarning"("clipperProfileId", "status", "expiresAt");
CREATE INDEX IF NOT EXISTS "ClipperWarning_campaignId_idx"
  ON "ClipperWarning"("campaignId");
CREATE INDEX IF NOT EXISTS "ClipperWarning_infractionType_appliedAt_idx"
  ON "ClipperWarning"("infractionType", "appliedAt");
CREATE INDEX IF NOT EXISTS "ClipperWarning_appliedAt_idx"
  ON "ClipperWarning"("appliedAt");
CREATE INDEX IF NOT EXISTS "ClipperWarning_banReviewStatus_idx"
  ON "ClipperWarning"("banReviewStatus");
CREATE INDEX IF NOT EXISTS "ClipperSanction_clipperProfileId_type_startsAt_idx"
  ON "ClipperSanction"("clipperProfileId", "type", "startsAt");
CREATE INDEX IF NOT EXISTS "ClipperSanction_warningId_idx"
  ON "ClipperSanction"("warningId");
CREATE INDEX IF NOT EXISTS "ClipperSanction_type_endsAt_idx"
  ON "ClipperSanction"("type", "endsAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClipperWarning_clipperProfileId_fkey') THEN
    ALTER TABLE "ClipperWarning" ADD CONSTRAINT "ClipperWarning_clipperProfileId_fkey"
      FOREIGN KEY ("clipperProfileId") REFERENCES "ClipperProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClipperWarning_campaignId_fkey') THEN
    ALTER TABLE "ClipperWarning" ADD CONSTRAINT "ClipperWarning_campaignId_fkey"
      FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClipperWarning_clipPostId_fkey') THEN
    ALTER TABLE "ClipperWarning" ADD CONSTRAINT "ClipperWarning_clipPostId_fkey"
      FOREIGN KEY ("clipPostId") REFERENCES "ClipPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClipperSanction_clipperProfileId_fkey') THEN
    ALTER TABLE "ClipperSanction" ADD CONSTRAINT "ClipperSanction_clipperProfileId_fkey"
      FOREIGN KEY ("clipperProfileId") REFERENCES "ClipperProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClipperSanction_warningId_fkey') THEN
    ALTER TABLE "ClipperSanction" ADD CONSTRAINT "ClipperSanction_warningId_fkey"
      FOREIGN KEY ("warningId") REFERENCES "ClipperWarning"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClipperSanction_campaignId_fkey') THEN
    ALTER TABLE "ClipperSanction" ADD CONSTRAINT "ClipperSanction_campaignId_fkey"
      FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
