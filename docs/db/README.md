# Runbooks de banco de dados

Scripts SQL que o time rodou **à mão** no banco de produção (Neon, compartilhado com o
`league-clipfyai`). Este projeto não usa `prisma migrate`: cada mudança de schema vem
acompanhada de um script idempotente aqui, aplicado antes do deploy do código.

Eles **não são lidos pelo código** (o Prisma usa apenas `prisma/schema.prisma`) e ficam
aqui como registro do que já foi aplicado e como receita para reproduzir em outro ambiente.

| Script | O que faz | Como aplicar | Estado em produção |
| --- | --- | --- | --- |
| `competition-announcements.sql` | Mural de avisos: enum, tabela `CompetitionAnnouncement` e coluna em `Notification` | `npx prisma db execute --file docs/db/competition-announcements.sql --schema prisma/schema.prisma` | aplicado |
| `competition-withdrawal.sql` | `ApplicationStatus.WITHDRAWN` e coluna `withdrawnAt` | `npx prisma db execute --file …` | aplicado |
| `performance-indexes.sql` | Índices de performance em `ClipPost` e `DailyRankingEntry` | um comando por vez via `psql` (`CREATE INDEX CONCURRENTLY` não roda em transação) | aplicado |
| `clip-post-metrics-views-index.sql` | Troca o índice de `ClipPostMetrics` para incluir `views` (index-only scan) | um comando por vez via `psql`, pela URL direta (sem `-pooler`) | aplicado |
| `clipper-discipline.sql` | Advertências de clipadores: enums, tabelas `ClipperWarning`, `ClipperSanction`, `ClipperDisciplineSettings` e índices (espelho da migration `20261016120000_add_clipper_discipline` do backend league) | `npx prisma db execute --file docs/db/clipper-discipline.sql --schema prisma/schema.prisma` (em produção, uma única vez pelo runbook do league) | aplicado |
| `cs-role.sql` | Papel `CUSTOMER_SUCCESS` e tabela `CsClientAccess` | `npx prisma db execute --file docs/db/cs-role.sql --schema prisma/schema.prisma` | aplicado em 2026-10-16 |
| `competition-sandbox.sql` | Tabela `CompetitionSandbox` (cópias editáveis de competições, tela Competições → Sandbox) | `npx prisma db execute --file docs/db/competition-sandbox.sql --schema prisma/schema.prisma` | aplicado em 2026-10-28 |

Ao criar um script novo: deixe-o idempotente (`IF NOT EXISTS`, `ADD VALUE IF NOT EXISTS`),
documente o comando de aplicação no cabeçalho e lembre que o `league-clipfyai` precisa receber
a mesma mudança de enum no schema dele antes de ler linhas com o valor novo.
