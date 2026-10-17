-- Alteração aditiva para bancos existentes que usam prisma db push.
-- Aplicar com: npx prisma db execute --file prisma/cs-role.sql --schema prisma/schema.prisma
-- Pode ser reaplicado (idempotente).
-- Adiciona o papel CUSTOMER_SUCCESS (CS) e a tabela de clientes liberados por usuário CS.
--
-- IMPORTANTE: o ALTER TYPE fica FORA da transação. O Postgres não permite usar um valor
-- de enum recém-criado dentro da mesma transação que o adicionou, e nada dentro do bloco
-- abaixo referencia 'CUSTOMER_SUCCESS'. Se o executor reclamar de "unsafe use of new
-- value", rode o ALTER TYPE isoladamente e depois o bloco BEGIN/COMMIT.
--
-- Repositório irmão: o league-clipfyai compartilha este banco. Um Prisma Client gerado
-- sem CUSTOMER_SUCCESS no enum falha ao ler usuários com esse papel. Adicione o valor ao
-- enum UserRole do schema de lá (e rode prisma generate) antes de criar o primeiro CS.

ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'CUSTOMER_SUCCESS';

BEGIN;

CREATE TABLE IF NOT EXISTS "CsClientAccess" (
  "id" TEXT NOT NULL,
  "csUserId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "grantedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CsClientAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CsClientAccess_csUserId_clientId_key"
  ON "CsClientAccess"("csUserId", "clientId");

CREATE INDEX IF NOT EXISTS "CsClientAccess_clientId_idx"
  ON "CsClientAccess"("clientId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'CsClientAccess_csUserId_fkey'
      AND conrelid = '"CsClientAccess"'::regclass
  ) THEN
    ALTER TABLE "CsClientAccess"
      ADD CONSTRAINT "CsClientAccess_csUserId_fkey"
      FOREIGN KEY ("csUserId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'CsClientAccess_clientId_fkey'
      AND conrelid = '"CsClientAccess"'::regclass
  ) THEN
    ALTER TABLE "CsClientAccess"
      ADD CONSTRAINT "CsClientAccess_clientId_fkey"
      FOREIGN KEY ("clientId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
