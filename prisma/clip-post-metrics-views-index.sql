-- Troca o índice (clipPostId, collectedAt) de ClipPostMetrics por
-- (clipPostId, collectedAt, views). Com views no índice, o histórico da
-- Performance lê as métricas de cada post sem abrir a tabela (index-only scan).
--
-- NÃO aplique com `prisma db execute`: CREATE/DROP INDEX CONCURRENTLY não roda
-- dentro de transação. Rode um comando por vez, pela URL direta do Neon (sem
-- "-pooler" no host; o pooler descarta o SET entre comandos). Ex.:
--   psql "$DIRECT_URL" -c '<comando>'
--
-- Ordem obrigatória. Este repositório e o League usam `prisma db push` no
-- mesmo banco:
--   1. Passos 1 a 4 abaixo.
--   2. Nos dois schema.prisma (este e o do League), no model ClipPostMetrics:
--        @@index([clipPostId, collectedAt])  ->  @@index([clipPostId, collectedAt, views])
--   3. Passo 5.
-- Um db push com o schema antigo apaga o índice novo. Um db push com o schema
-- novo antes do passo 2 cria o índice sem CONCURRENTLY, travando a gravação
-- de métricas durante toda a construção.
--
-- Rode fora do horário de coleta (antes das 10h ou depois das 22h de
-- Brasília): a construção lê a tabela inteira (12 GB) duas vezes.

-- 1. Autovacuum a cada 100 mil inserções. No padrão (20% da tabela, ~13,6
--    milhões de linhas) as métricas ficam semanas sem ser marcadas como
--    visíveis, e o índice não evita a leitura da tabela justamente para as
--    competições em andamento. O Prisma não gerencia esses parâmetros.
ALTER TABLE "ClipPostMetrics" SET (
  autovacuum_vacuum_insert_scale_factor = 0,
  autovacuum_vacuum_insert_threshold = 100000
);

-- 2. Índice novo. Não bloqueia leituras nem escritas. Para acelerar, rode na
--    mesma sessão (psql com dois -c) um SET maintenance_work_mem maior, se a
--    compute tiver memória para isso:
--      psql "$DIRECT_URL" -c "SET maintenance_work_mem = '512MB'" -c '<CREATE INDEX abaixo>'
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ClipPostMetrics_clipPostId_collectedAt_views_idx"
  ON "ClipPostMetrics" ("clipPostId", "collectedAt", "views");

-- 3. Deve retornar true. Se retornar false, a construção foi interrompida:
--    rode DROP INDEX CONCURRENTLY "ClipPostMetrics_clipPostId_collectedAt_views_idx";
--    e repita o passo 2.
SELECT indisvalid FROM pg_index
WHERE indexrelid = '"ClipPostMetrics_clipPostId_collectedAt_views_idx"'::regclass;

-- 4. Marca como visíveis as métricas inseridas desde o último vacuum. Não
--    bloqueia leituras nem escritas.
VACUUM (VERBOSE) "ClipPostMetrics";

-- 5. Só depois de trocar o @@index nos dois schema.prisma.
DROP INDEX CONCURRENTLY IF EXISTS "ClipPostMetrics_clipPostId_collectedAt_idx";
