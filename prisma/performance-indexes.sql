-- Índices de performance (mesmos nomes que o Prisma gera para os @@index
-- adicionados no schema, então o `db push` não vê diferença depois).
--
-- Rode ANTES do próximo `db push`, um comando por vez, fora de transação:
-- `CREATE INDEX CONCURRENTLY` não bloqueia escritas, mas não pode rodar dentro
-- de BEGIN/COMMIT nem em lote com outros comandos. Ex.:
--   psql "$DATABASE_URL" -c 'CREATE INDEX CONCURRENTLY IF NOT EXISTS ...'
--
-- Se um comando for interrompido, o índice pode ficar INVALID: confira com
--   SELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid;
-- e recrie com DROP INDEX CONCURRENTLY + o CREATE abaixo.

-- Checagem de URL duplicada ao enviar post (hoje: seq scan no ClipPost a cada
-- validação, que roda enquanto o clipador digita o link).
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ClipPost_submittedUrl_idx"
  ON "ClipPost" ("submittedUrl");

-- Checagem de vídeo duplicado entre competições (o unique existente começa por
-- campaignId e não serve para essa busca).
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ClipPost_platformVideoId_platform_idx"
  ON "ClipPost" ("platformVideoId", "platform");

-- Janelas do ranking diário / Top Postadores / página da competição do clipador
-- (campaignId + status ELIGIBLE + intervalo de postedAt).
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ClipPost_campaignId_status_postedAt_idx"
  ON "ClipPost" ("campaignId", "status", "postedAt");

-- FK com ON DELETE CASCADE sem índice: saída/reinscrição na competição filtram
-- por applicationId dentro de transação com FOR UPDATE.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "DailyRankingEntry_applicationId_idx"
  ON "DailyRankingEntry" ("applicationId");
