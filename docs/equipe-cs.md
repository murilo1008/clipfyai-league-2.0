# Equipe CS (Customer Success) — visão de cliente

> Papel `CUSTOMER_SUCCESS` ("CS" na interface). Um usuário CS escolhe um cliente no
> header e passa a ter **100% do acesso daquele cliente** — mesmas telas, mesmos dados,
> mesmas ações. A única diferença visual é o seletor de cliente no topo. O admin
> cadastra os CS e define a quais clientes cada um tem acesso (nenhum selecionado =
> todos).

| Item | Valor |
| --- | --- |
| Papel no banco | `UserRole.CUSTOMER_SUCCESS` |
| Tabela de acesso | `CsClientAccess` (`csUserId` → `clientId`; zero linhas = todos) |
| Persistência da seleção | cookie httpOnly `clipfy_cs_client` = `<csUserId>:<clientId>` |
| Clientes elegíveis | `User.role = CLIENT` com ≥ 1 competição `ACTIVE` ou `COMPLETED` |
| Página admin | `/settings/cs-team` (Configurações → Equipe CS) |
| Router tRPC | `cs` (`cs.view.clients`, `cs.admin.*`) |
| SQL de produção | `docs/db/cs-role.sql` |

---

## 1. Como funciona (arquitetura)

"Cliente" na plataforma é um `User` com `role = CLIENT`; as competições apontam para
ele por `Campaign.clientId`. Todas as procedures e páginas do cliente (a) releem o
papel no banco a partir de `ctx.userId` e (b) filtram por `clientId: ctx.userId`.

Por isso a feature **não altera procedure por procedure**: a seleção do CS é resolvida
uma única vez por request e o id efetivo é injetado no contexto.

```
cookie clipfy_cs_client = "<csUserId>:<clientId>"
        │
        ▼
resolveCsView({ db, actorId, cookieHeader })      src/server/cs-view/resolve.ts
  • sem cookie / cookie de outro usuário → passthrough, ZERO queries
  • ator é CS + cliente permitido e elegível → effectiveUserId = clientId
  • ator é CS + cliente inválido → effectiveUserId = csId, stale = true
        │
        ├─ isAuth (tRPC, src/server/api/trpc.ts)
        │     ctx.userId = effectiveUserId · ctx.actorUserId = csId · ctx.csView
        ├─ user.getCurrentUser → usuário EFETIVO (role CLIENT) + csView + csSelectionStale
        └─ getViewer() (RSC/Route Handlers, src/server/cs-view/viewer.ts)
              viewer.actor · viewer.effective · viewer.csView · viewer.stale
```

Consequências:

- O CS enxerga e **age** como o cliente (exportar CSV, enfileirar downloads, trocar
  avatar…). Não há modo somente leitura — decisão de produto.
- `ctx.actorUserId` é sempre quem está logado de verdade. Procedures que registrem
  "quem fez" devem usá-lo (hoje nenhuma mutation alcançável pelo cliente grava
  `auditLog`; a trilha "quem viu quem" fica no evento de seleção).
- Clippers, clientes e admins não pagam nada: sem cookie de CS, `resolveCsView` não
  consulta o banco.

## 2. Regras de negócio

| Regra | Onde |
| --- | --- |
| Só clientes com competição `ACTIVE` ou `COMPLETED` aparecem para o CS (`ARCHIVED`, `DRAFT`, `SCHEDULED`, `PAUSED` não contam; status do `ClientProfile` é ignorado) | `VIEWABLE_CAMPAIGN_STATUSES` / `viewableClientWhere` em `src/server/cs-view/eligibility.ts` |
| Allowlist por CS; zero linhas em `CsClientAccess` = acesso a todos os elegíveis | `allowedClientIdsFor` |
| O admin pode pré-autorizar um cliente ainda sem competição elegível (a elegibilidade só vale na hora de visualizar) | `cs.admin.clientOptions` lista todos os `CLIENT` |
| Cookie é só a seleção; a autorização é revalidada em todo request | `resolveCsView` |
| Cookie pertence ao ator (`<csUserId>:…`); outro usuário no mesmo navegador o ignora | `src/server/cs-view/cookie.ts` |
| Acesso revogado / cliente rebaixado / apagado / sem competição elegível ⇒ `stale` ⇒ volta à tela de seleção com aviso e o cookie é limpo | `home-cs.tsx` + `cs-client-selector.tsx` |
| Exatamente um cliente disponível ⇒ seleção automática | `home-cs.tsx` |
| AI Clips: **fora de escopo**; `league-clips.ts` não foi alterado (gate continua pelo e-mail do usuário logado) | — |

## 3. Inventário de arquivos

### Novos

| Arquivo | Papel |
| --- | --- |
| `docs/db/cs-role.sql` | SQL idempotente: enum + tabela (seção 5) |
| `src/server/cs-view/cookie.ts` | nome, formato, parser e opções do cookie |
| `src/server/cs-view/eligibility.ts` | regras de elegibilidade e allowlist (Prisma `where`) |
| `src/server/cs-view/resolve.ts` | `resolveCsView` + versão memoizada por request |
| `src/server/cs-view/viewer.ts` | `getViewer()` para Server Components e Route Handlers |
| `src/server/cs-view/actions.ts` | Server Actions `selectCsClient` / `clearCsClient` |
| `src/server/clerk-errors.ts` | `getClerkUserCreationError` (extraído de `client.ts`, compartilhado) |
| `src/server/api/routers/cs.ts` | router `cs` (`view.clients`, `admin.list/stats/clientOptions/create/update/delete`) |
| `src/hooks/use-cs-view.ts` | `useCsView()` e `useSelectCsClient()` |
| `src/components/cs/cs-hero-viz.tsx` | visualizações animadas dos heros (`CsTeamHeroViz` "a ponte", `CsPickerHeroViz` "a lente") e seus fantasmas de skeleton |
| `src/components/cs/segmented-filter.tsx` | filtro segmentado em pílulas (gradiente da marca, contagens, rolagem horizontal no mobile) |
| `src/lib/initials.ts` | `initialsOf()` para os avatares |
| `src/components/header/cs-client-selector.tsx` | seletor no header (só para CS) |
| `src/app/(dashboard)/(home)/home-cs.tsx` | landing de escolha de cliente |
| `src/app/(dashboard)/settings/cs-team/{page,cs-team}.tsx` | página admin Equipe CS |
| `src/components/settings/cs-client-multi-select.tsx` | multi-select de clientes liberados |
| `docs/equipe-cs.md` | este documento |

### Alterados

| Arquivo | Mudança |
| --- | --- |
| `prisma/schema.prisma` | `CUSTOMER_SUCCESS` em `UserRole`; model `CsClientAccess`; relações em `User` |
| `src/server/api/trpc.ts` | `isAuth` resolve o CS e injeta `userId` efetivo, `actorUserId`, `csView`, `csSelectionStale`; novo `csProcedure` |
| `src/server/api/routers/user.ts` | `getCurrentUser` devolve usuário efetivo + `csView`; mutations de perfil usam `ctx.userId` |
| `src/server/api/routers/admin.ts` | `CUSTOMER_SUCCESS` nos enums zod de `users.*`; `users.delete` recusa CS |
| `src/server/api/routers/client.ts` | importa o helper de erros do Clerk do arquivo compartilhado |
| `src/server/api/root.ts` | monta `cs` |
| `src/app/api/video-downloads/[downloadId]/download/route.ts` | usa `getViewer()` (CS baixa arquivos do cliente visualizado) |
| `src/app/(dashboard)/(home)/page.tsx` | CS sem seleção → `HomeCs`; demais ramos pelo papel efetivo |
| `posts/page.tsx`, `posts/[postId]/page.tsx`, `performance/page.tsx`, `client-comments/page.tsx`, `client-downloads/page.tsx` | guards usam `viewer.effective` |
| `src/config/navigation.ts` | menu `CUSTOMER_SUCCESS` (só "Clientes"); "Equipe CS" no menu ADMIN |
| `src/components/header/app-topbar.tsx` | renderiza `CsClientSelector` |
| `src/components/sidebar/nav-user.tsx` | mostra a identidade do CS com o avatar do cliente visualizado como selo; limpa o cookie ao sair |
| `src/components/header/app-breadcrumbs.tsx`, `settings/profile/profile.tsx` | rótulos |

## 4. Fluxos

### 4.1 CS entra na plataforma
1. Login normal (Clerk). `getCurrentUser` devolve o CS (`role: CUSTOMER_SUCCESS`, `csView: null`).
2. Sidebar mostra só "Clientes" (`MENU_BY_ROLE.CUSTOMER_SUCCESS`). A home renderiza `HomeCs`.
3. O CS escolhe um cliente (landing ou seletor do header) → `selectCsClient(clientId)`:
   valida papel + allowlist + elegibilidade, grava o cookie httpOnly e um `AuditLog`
   (`action: LOGIN`, `entityType: CsClientView`, `entityId: clientId`).
4. A UI faz `window.location.assign("/")` — navegação completa de propósito: zera o
   cache do React Query e qualquer estado do cliente anterior.
5. A partir daí `getCurrentUser` devolve o **cliente** (role `CLIENT`) com `csView`;
   sidebar, home, posts, performance, comentários, downloads e perfil são os do cliente.
   O footer da sidebar mostra o nome/e-mail do CS com a sublinha `CS · <cliente>`.

### 4.2 Trocar de cliente
Seletor no header → mesmo fluxo da etapa 3/4.

### 4.3 Seleção obsoleta (`stale`)
Admin removeu o cliente da lista, cliente rebaixado/apagado ou ficou sem competição
elegível. No próximo request `resolveCsView` devolve `stale: true`:
- guards RSC das páginas do cliente redirecionam para `/` (papel efetivo já não é `CLIENT`);
- `HomeCs` mostra o aviso, chama `clearCsClient()` e invalida `getCurrentUser`;
- em páginas sem guard (ex.: `/settings`), o seletor do header leva para `/`.

### 4.4 Sair
`NavUser` chama `clearCsClient()` antes do `signOut` (computador compartilhado).

### 4.5 Admin gerencia a equipe
`/settings/cs-team`: lista (nome, e-mail, clientes liberados ou "Todos os clientes",
cadastro), criar (nome, e-mail, senha, clientes), editar (nome, clientes), alterar
senha, remover. Criação espelha `customers.create`: Clerk primeiro
(`publicMetadata.role = CUSTOMER_SUCCESS`), depois `User` + `CsClientAccess` +
`AuditLog` em transação; se o banco falhar, a conta do Clerk é removida. Remoção apaga
no banco (cascade limpa os acessos) e no Clerk.

## 4.6 Linguagem visual e responsividade

- **Heros** com visualização animada própria (`CsTeamHeroViz` / `CsPickerHeroViz`) e fantasma
  equivalente no skeleton, no mesmo kit das demais páginas (vidro petróleo, hairline ciano,
  aurora, grid em pan, sparkles, partículas e cometa). A viz some abaixo de `md`.
- **Skeletons** espelham o layout real (hero, KPIs, toolbar, tabela/cards, grid de clientes)
  com o shimmer da marca e stagger por `delay`, sem salto de layout.
- **Animações**: `Reveal` com stagger nos blocos, `animate-fade-in-up` com atraso por índice
  nas linhas/cards, `glass-card-hover` nos cartões, anel pulsante no seletor sem cliente,
  ponto "ao vivo" nos clientes com competição ativa. Tudo respeita `prefers-reduced-motion`.
- **Responsividade**: tabela em `lg+` e cards abaixo; grid de clientes 1→2→3→4 colunas;
  filtros segmentados com rolagem horizontal no mobile; dialogs com cabeçalho/corpo rolável/
  rodapé fixos (`max-h-[92svh]`, botões em coluna no mobile); seletor do header só com avatar
  abaixo de `sm` e popover limitado a `calc(100vw-1rem)`.

## 5. Banco de dados e deploy

1. **Antes do deploy**, aplicar o SQL no banco de produção:
   ```bash
   npx prisma db execute --file docs/db/cs-role.sql --schema prisma/schema.prisma
   ```
   O `ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'CUSTOMER_SUCCESS'` fica fora da
   transação (Postgres não permite usar um valor de enum na mesma transação que o
   criou). Se o executor reclamar de "unsafe use of new value", rode o `ALTER TYPE`
   isoladamente e depois o bloco `BEGIN/COMMIT`. O script é idempotente.
2. `npx prisma generate` (nunca `db push`/`migrate` — banco compartilhado).
3. ⚠️ **Repositório irmão `league-clipfyai`** usa o mesmo banco. Um Prisma Client gerado
   sem `CUSTOMER_SUCCESS` no enum **lança erro ao ler** qualquer `User` com esse papel
   (ex.: `user.findMany` sem filtro). Adicione `CUSTOMER_SUCCESS` ao `enum UserRole` do
   schema de lá e rode `prisma generate` **antes de criar o primeiro CS**. A tabela
   `CsClientAccess` é inofensiva para o outro repositório.

## 6. Segurança

- O cookie nunca autoriza nada: todo request revalida papel do ator, allowlist e
  elegibilidade. Cookie forjado por CLIPPER/CLIENT/ADMIN é ignorado sem efeito.
- `csProcedure` checa o papel de `ctx.actorUserId` (nunca o do cliente visualizado).
- `adminProcedure` não muda: um CS nunca passa por `isAdmin`.
- `user.create` (procedure pública) **não** aceita `CUSTOMER_SUCCESS` — só admins criam CS.
- `admin.users.delete` recusa CS; use `cs.admin.delete` (que também remove no Clerk).
- Achados pré-existentes fora do escopo (recomendados como follow-up):
  IDOR em `customers.getAllPosts` (`campaignId` do input sobrescreve o filtro do
  cliente); `user.create` aceita `role: ADMIN` sem autenticação;
  `organization.create/update/delete` sem checagem de papel.

## 7. Testes (Vitest)

| Arquivo | Cobre |
| --- | --- |
| `src/server/cs-view/cookie.test.ts` | formato, parser, header, opções |
| `src/server/cs-view/resolve.test.ts` | caminho rápido sem query, cookie alheio, não-CS, allowlist, inelegível, memoização |
| `src/server/cs-view/actions.test.ts` | Server Action: autenticação, papel, allowlist, cookie, auditoria |
| `src/server/api/trpc.test.ts` | troca de `ctx.userId`, `actorUserId`, `stale`, cookie forjado, `csProcedure` |
| `src/server/api/routers/user.get-current-user.test.ts` | usuário efetivo + `csView` + `csSelectionStale` |
| `src/server/api/routers/cs.test.ts` | `view.clients` (allowlist, filtros, contagens) e `admin.*` (CRUD, rollback do Clerk, auditoria) |
| `src/config/navigation.test.ts` | menu do CS e item Equipe CS |

```bash
npx vitest run src/server/cs-view src/server/api/trpc.test.ts src/server/api/routers/cs.test.ts src/server/api/routers/user.get-current-user.test.ts src/config
```

## 8. Checklist manual

- Admin: criar CS com 0 clientes e com 2; editar lista; trocar senha; remover → login falha.
- CS sem seleção: landing (nunca a home de admin); só clientes com competição
  ACTIVE/COMPLETED; allowlist respeitada; um único cliente → auto-seleção.
- CS visualizando: Home, Posts (incl. `?campaignId=`), detalhe do post, histórico de
  métricas, Performance (incl. `notFound`), Comentários, Downloads (lista + arquivo),
  Perfil — tudo do cliente; footer da sidebar mostra o CS + cliente; seletor no header.
- Ações: exportar CSV, enfileirar download e trocar avatar recaem sobre o cliente;
  `AuditLog` `LOGIN`/`CsClientView` a cada seleção.
- Troca de cliente sem dados residuais; URL direta de post do cliente anterior → erro.
- Revogação ao vivo → próxima navegação cai na landing com aviso e cookie limpo.
- Cookie forjado como CLIPPER/CLIENT/ADMIN sem efeito; fluxos de clipador inalterados.
