-- Alteração aditiva para bancos existentes que usam prisma db push.
-- Aplicar com: npx prisma db execute --file prisma/competition-announcements.sql --schema prisma/schema.prisma
-- Pode ser reaplicado para atualizar destinatários individuais e notificações.
-- Atualiza apenas a estrutura do mural e não inclui dados do ADMIN nas postagens.
BEGIN;

DO $$
BEGIN
  CREATE TYPE "CompetitionAnnouncementCategory" AS ENUM (
    'CONTENT', 'RULES', 'NOTICE', 'GUIDANCE', 'CLIPFY_NOTICE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "CompetitionAnnouncement" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "recipientClipperProfileId" TEXT,
  "category" "CompetitionAnnouncementCategory" NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "content" TEXT NOT NULL,
  "linkUrl" TEXT,
  "notifyClippers" BOOLEAN NOT NULL DEFAULT false,
  "notificationSentAt" TIMESTAMP(3),
  "notificationRecipientCount" INTEGER NOT NULL DEFAULT 0,
  "notificationLastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompetitionAnnouncement_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CompetitionAnnouncement"
  ADD COLUMN IF NOT EXISTS "recipientClipperProfileId" TEXT;

CREATE INDEX IF NOT EXISTS "CompetitionAnnouncement_campaignId_createdAt_id_idx"
  ON "CompetitionAnnouncement"("campaignId", "createdAt", "id");

CREATE INDEX IF NOT EXISTS "CompetitionAnnouncement_recipientClipperProfileId_idx"
  ON "CompetitionAnnouncement"("recipientClipperProfileId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'CompetitionAnnouncement_campaignId_fkey'
      AND conrelid = '"CompetitionAnnouncement"'::regclass
  ) THEN
    ALTER TABLE "CompetitionAnnouncement"
      ADD CONSTRAINT "CompetitionAnnouncement_campaignId_fkey"
      FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'CompetitionAnnouncement_recipientClipperProfileId_fkey'
      AND conrelid = '"CompetitionAnnouncement"'::regclass
  ) THEN
    ALTER TABLE "CompetitionAnnouncement"
      ADD CONSTRAINT "CompetitionAnnouncement_recipientClipperProfileId_fkey"
      FOREIGN KEY ("recipientClipperProfileId") REFERENCES "ClipperProfile"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "announcementId" TEXT;
CREATE INDEX IF NOT EXISTS "Notification_announcementId_idx" ON "Notification"("announcementId");
CREATE UNIQUE INDEX IF NOT EXISTS "Notification_userId_announcementId_key" ON "Notification"("userId", "announcementId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Notification_announcementId_fkey'
      AND conrelid = '"Notification"'::regclass
  ) THEN
    ALTER TABLE "Notification" ADD CONSTRAINT "Notification_announcementId_fkey"
      FOREIGN KEY ("announcementId") REFERENCES "CompetitionAnnouncement"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
