-- Alteração aditiva, seguindo o fluxo de prisma db push deste projeto.
-- Aplicar antes de publicar a feature:
-- npx prisma db execute --file prisma/competition-withdrawal.sql --schema prisma/schema.prisma
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'WITHDRAWN';
ALTER TABLE "ClipperApplication" ADD COLUMN IF NOT EXISTS "withdrawnAt" TIMESTAMP(3);
