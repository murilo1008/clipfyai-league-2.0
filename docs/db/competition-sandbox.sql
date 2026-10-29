-- Alteração aditiva para bancos existentes que usam prisma db push.
-- Aplicar com: npx prisma db execute --file docs/db/competition-sandbox.sql --schema prisma/schema.prisma
-- Pode ser reaplicado (idempotente).
-- Sandbox de competição: cópias editáveis dos dados de uma competição (snapshot em JSON).
-- Só este front lê a tabela; o league-clipfyai não precisa de mudança no schema dele.

BEGIN;

CREATE TABLE IF NOT EXISTS "CompetitionSandbox" (
  "id" TEXT NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "sourceCampaignId" TEXT,
  "sourceCampaignName" VARCHAR(200) NOT NULL,
  "data" JSONB NOT NULL,
  "createdById" TEXT,
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompetitionSandbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CompetitionSandbox_updatedAt_idx"
  ON "CompetitionSandbox"("updatedAt");

CREATE INDEX IF NOT EXISTS "CompetitionSandbox_sourceCampaignId_idx"
  ON "CompetitionSandbox"("sourceCampaignId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'CompetitionSandbox_sourceCampaignId_fkey'
      AND conrelid = '"CompetitionSandbox"'::regclass
  ) THEN
    ALTER TABLE "CompetitionSandbox"
      ADD CONSTRAINT "CompetitionSandbox_sourceCampaignId_fkey"
      FOREIGN KEY ("sourceCampaignId") REFERENCES "Campaign"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'CompetitionSandbox_createdById_fkey'
      AND conrelid = '"CompetitionSandbox"'::regclass
  ) THEN
    ALTER TABLE "CompetitionSandbox"
      ADD CONSTRAINT "CompetitionSandbox_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
