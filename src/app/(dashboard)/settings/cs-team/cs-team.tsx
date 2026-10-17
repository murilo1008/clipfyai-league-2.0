"use client";

import * as React from "react";
import {
  Buildings,
  CalendarBlank,
  CircleNotch,
  DotsThreeVertical,
  Envelope,
  Eye,
  EyeSlash,
  Headset,
  Key,
  LockKey,
  MagnifyingGlass,
  PencilSimple,
  Shield,
  Trash,
  UserGear,
  UserPlus,
  UsersThree,
  X,
} from "@phosphor-icons/react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

import { HomeHero } from "@/components/home/home-hero";
import { StatTile } from "@/components/home/stat-tile";
import { CsClientMultiSelect } from "@/components/settings/cs-client-multi-select";
import { Reveal } from "@/components/shared/reveal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { api, type RouterOutputs } from "@/trpc/react";

export type CsUser = RouterOutputs["cs"]["admin"]["list"][number];

const CS_BADGE_CLASS =
  "gap-1.5 rounded-full border-[color-mix(in_oklab,var(--brand-cyan)_35%,transparent)] bg-[color-mix(in_oklab,var(--brand-cyan)_12%,transparent)] font-semibold";

function initialsOf(name: string | null, fallback: string) {
  const source = (name ?? "").trim() || fallback;
  return (
    source
      .split(/\s+/)
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "CS"
  );
}

function formatDate(value: Date | string) {
  return format(new Date(value), "dd MMM yyyy", { locale: ptBR });
}

function clientLabel(client: CsUser["clients"][number]) {
  return client.company ?? client.name ?? client.email;
}

// ============================================================================
// Page
// ============================================================================
export default function CsTeam() {
  const utils = api.useUtils();

  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  React.useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<CsUser | null>(null);
  const [passwordFor, setPasswordFor] = React.useState<CsUser | null>(null);
  const [deleting, setDeleting] = React.useState<CsUser | null>(null);

  const list = api.cs.admin.list.useQuery({ search: debouncedSearch });
  const stats = api.cs.admin.stats.useQuery();

  const invalidate = () => {
    void utils.cs.admin.list.invalidate();
    void utils.cs.admin.stats.invalidate();
  };

  const createMutation = api.cs.admin.create.useMutation({
    onSuccess: () => {
      toast.success("Usuário de CS criado com sucesso!");
      invalidate();
      setIsAddOpen(false);
    },
    onError: (error) =>
      toast.error(error.message || "Erro ao criar usuário de CS"),
  });

  const updateMutation = api.cs.admin.update.useMutation({
    onSuccess: () => {
      toast.success("Usuário de CS atualizado!");
      invalidate();
      setEditing(null);
      setPasswordFor(null);
    },
    onError: (error) =>
      toast.error(error.message || "Erro ao atualizar usuário de CS"),
  });

  const deleteMutation = api.cs.admin.delete.useMutation({
    onSuccess: () => {
      toast.success("Usuário de CS removido.");
      invalidate();
      setDeleting(null);
    },
    onError: (error) =>
      toast.error(error.message || "Erro ao remover usuário de CS"),
  });

  const users = list.data ?? [];
  const isInitialLoading = list.isLoading && stats.isLoading;

  if (isInitialLoading) return <CsTeamSkeleton />;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      {/* ===== Hero ===== */}
      <HomeHero
        eyebrow="Clipfy League · Configurações"
        title={
          <>
            A equipe de <span className="text-gradient">Customer Success</span>
          </>
        }
        subtitle="Usuários de CS enxergam e operam a conta dos clientes exatamente como o cliente, trocando de cliente pelo seletor no topo. Defina aqui quem tem acesso a quais clientes."
        isLoading={stats.isLoading}
        stats={[
          {
            icon: <Headset className="size-3.5" weight="fill" />,
            label: "Usuários CS",
            value: stats.data?.total ?? 0,
            kind: "int",
          },
          {
            icon: <UsersThree className="size-3.5" weight="fill" />,
            label: "Acesso total",
            value: stats.data?.unrestricted ?? 0,
            kind: "int",
          },
          {
            icon: <LockKey className="size-3.5" weight="fill" />,
            label: "Acesso restrito",
            value: stats.data?.restricted ?? 0,
            kind: "int",
          },
        ]}
      />

      {/* ===== KPIs ===== */}
      <Reveal immediate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            icon={<Headset className="size-4" weight="fill" />}
            label="Usuários CS"
            value={stats.data?.total ?? 0}
            kind="int"
            hint="contas de Customer Success"
            accent="gradient"
            isLoading={stats.isLoading}
          />
          <StatTile
            icon={<UsersThree className="size-4" weight="fill" />}
            label="Acesso total"
            value={stats.data?.unrestricted ?? 0}
            kind="int"
            hint="veem todos os clientes"
            accent="cyan"
            isLoading={stats.isLoading}
          />
          <StatTile
            icon={<LockKey className="size-4" weight="fill" />}
            label="Acesso restrito"
            value={stats.data?.restricted ?? 0}
            kind="int"
            hint="com lista de clientes"
            accent="purple"
            isLoading={stats.isLoading}
          />
          <StatTile
            icon={<Buildings className="size-4" weight="fill" />}
            label="Clientes elegíveis"
            value={stats.data?.eligibleClients ?? 0}
            kind="int"
            hint="com competição ativa ou concluída"
            accent="green"
            isLoading={stats.isLoading}
          />
        </div>
      </Reveal>

      {/* ===== Toolbar ===== */}
      <Reveal immediate delayMs={60}>
        <div className="glass-card flex flex-col gap-3 rounded-3xl p-3.5 sm:p-4 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <MagnifyingGlass className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar CS por nome ou e-mail..."
              aria-label="Buscar usuário de CS"
              className="focus-visible:ring-brand-cyan/40 h-10 rounded-xl pl-10"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Limpar busca"
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <Button
            onClick={() => setIsAddOpen(true)}
            className="btn-gradient-auth h-10 cursor-pointer rounded-xl px-4 font-semibold"
          >
            <UserPlus className="size-4" weight="bold" />
            Adicionar CS
          </Button>
        </div>
      </Reveal>

      {/* ===== Lista ===== */}
      <Reveal immediate delayMs={120}>
        <div className="glass-card overflow-hidden rounded-3xl">
          {/* Tabela (lg+) */}
          <div className="hidden overflow-x-auto lg:block">
            <Table>
              <TableHeader>
                <TableRow className="border-border/60 hover:bg-transparent">
                  {["Usuário", "Clientes liberados", "Cadastro", ""].map(
                    (label, index) => (
                      <TableHead
                        key={index}
                        className="text-muted-foreground h-12 px-4 text-[11px] font-semibold tracking-[0.12em] whitespace-nowrap uppercase"
                      >
                        {label}
                      </TableHead>
                    ),
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.isLoading ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <TableRow key={index} className="hover:bg-transparent">
                      <TableCell className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <Skeleton className="size-9 rounded-lg" />
                          <div className="space-y-1.5">
                            <Skeleton className="h-3.5 w-32" />
                            <Skeleton className="h-3 w-44" />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3.5">
                        <Skeleton className="h-5 w-40 rounded-full" />
                      </TableCell>
                      <TableCell className="px-4 py-3.5">
                        <Skeleton className="h-3.5 w-24" />
                      </TableCell>
                      <TableCell className="px-4 py-3.5" />
                    </TableRow>
                  ))
                ) : users.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={4}>
                      <EmptyState searching={debouncedSearch.length > 0} />
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow
                      key={user.id}
                      className="border-border/40 hover:bg-muted/30 transition-colors"
                    >
                      <TableCell className="px-4 py-3.5 align-middle">
                        <UserIdentity user={user} />
                      </TableCell>
                      <TableCell className="px-4 py-3.5 align-middle">
                        <ClientsCell user={user} />
                      </TableCell>
                      <TableCell className="text-muted-foreground px-4 py-3.5 align-middle text-sm whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarBlank className="size-3.5" />
                          {formatDate(user.createdAt)}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3.5 text-right align-middle">
                        <ActionsMenu
                          onEdit={() => setEditing(user)}
                          onPassword={() => setPasswordFor(user)}
                          onDelete={() => setDeleting(user)}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Cards (mobile/tablet) */}
          <div className="block lg:hidden">
            {list.isLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="border-border/40 flex items-center gap-3 border-b p-4 last:border-b-0"
                >
                  <Skeleton className="size-10 rounded-lg" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-44" />
                  </div>
                </div>
              ))
            ) : users.length === 0 ? (
              <EmptyState searching={debouncedSearch.length > 0} />
            ) : (
              users.map((user) => (
                <div
                  key={user.id}
                  className="border-border/40 flex flex-col gap-3 border-b p-4 last:border-b-0"
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <UserIdentity user={user} />
                    </div>
                    <ActionsMenu
                      onEdit={() => setEditing(user)}
                      onPassword={() => setPasswordFor(user)}
                      onDelete={() => setDeleting(user)}
                    />
                  </div>
                  <ClientsCell user={user} />
                  <p className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                    <CalendarBlank className="size-3.5" />
                    Cadastro em {formatDate(user.createdAt)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </Reveal>

      {/* ===== Dialogs ===== */}
      <AddCsDialog
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        isLoading={createMutation.isPending}
        onSubmit={(data) => createMutation.mutate(data)}
      />
      <EditCsDialog
        user={editing}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        isLoading={updateMutation.isPending}
        onSubmit={(data) =>
          editing && updateMutation.mutate({ id: editing.id, ...data })
        }
      />
      <PasswordDialog
        user={passwordFor}
        open={passwordFor !== null}
        onOpenChange={(open) => !open && setPasswordFor(null)}
        isLoading={updateMutation.isPending}
        onSubmit={(password) =>
          passwordFor && updateMutation.mutate({ id: passwordFor.id, password })
        }
      />
      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover usuário de CS?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleting?.name ?? deleting?.email}</strong> perderá o
              acesso à plataforma imediatamente e a conta será removida do
              sistema de autenticação. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleteMutation.isPending}
              className="cursor-pointer rounded-xl"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                if (deleting) deleteMutation.mutate({ id: deleting.id });
              }}
              disabled={deleteMutation.isPending}
              className="cursor-pointer rounded-xl bg-red-600 text-white hover:bg-red-700"
            >
              {deleteMutation.isPending ? (
                <>
                  <CircleNotch className="size-4 animate-spin" />
                  Removendo...
                </>
              ) : (
                <>
                  <Trash className="size-4" weight="bold" />
                  Remover
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================================
// Pieces
// ============================================================================
function UserIdentity({ user }: { user: CsUser }) {
  const name = user.name ?? user.email;
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className="ring-border size-9 rounded-lg ring-1">
        <AvatarImage src={user.imageUrl ?? undefined} alt={name} />
        <AvatarFallback className="bg-gradient-custom rounded-lg text-xs font-semibold text-[#04222A]">
          {initialsOf(user.name, user.email)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 leading-tight">
        <p className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          <span className="truncate">{name}</span>
          <Badge
            variant="outline"
            className={cn(CS_BADGE_CLASS, "h-4 px-1.5 text-[10px]")}
          >
            <Headset className="size-3" weight="fill" />
            CS
          </Badge>
        </p>
        <p className="text-muted-foreground flex min-w-0 items-center gap-1 truncate text-xs">
          <Envelope className="size-3 shrink-0" />
          <span className="truncate">{user.email}</span>
        </p>
      </div>
    </div>
  );
}

function ClientsCell({ user }: { user: CsUser }) {
  if (user.allClients) {
    return (
      <Badge
        variant="outline"
        className={cn(CS_BADGE_CLASS, "h-6 px-2.5 text-xs")}
      >
        <UsersThree className="size-3.5" weight="fill" />
        Todos os clientes
      </Badge>
    );
  }
  const visible = user.clients.slice(0, 3);
  const rest = user.clients.length - visible.length;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {visible.map((client) => (
        <Badge
          key={client.id}
          variant="outline"
          className="h-6 max-w-[14rem] gap-1 rounded-full px-2.5 text-xs font-medium"
          title={client.email}
        >
          <Buildings className="size-3 shrink-0" />
          <span className="truncate">{clientLabel(client)}</span>
        </Badge>
      ))}
      {rest > 0 && (
        <Badge
          variant="outline"
          className="text-muted-foreground h-6 rounded-full px-2 text-xs"
          title={user.clients.slice(3).map(clientLabel).join(", ")}
        >
          +{rest}
        </Badge>
      )}
    </div>
  );
}

function ActionsMenu({
  onEdit,
  onPassword,
  onDelete,
}: {
  onEdit: () => void;
  onPassword: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Ações"
          className="size-8 cursor-pointer rounded-lg"
        >
          <DotsThreeVertical className="size-4" weight="bold" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 rounded-xl">
        <DropdownMenuItem onClick={onEdit} className="cursor-pointer">
          <PencilSimple className="size-4" />
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onPassword} className="cursor-pointer">
          <Key className="size-4" />
          Alterar senha
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={onDelete}
          className="cursor-pointer"
        >
          <Trash className="size-4" />
          Remover
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EmptyState({ searching }: { searching: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 p-10 text-center">
      <span className="bg-muted flex size-12 items-center justify-center rounded-2xl">
        <Headset className="text-muted-foreground size-6" />
      </span>
      <p className="text-sm font-semibold">
        {searching
          ? "Nenhum usuário de CS encontrado para esta busca."
          : "Nenhum usuário de CS cadastrado ainda."}
      </p>
      <p className="text-muted-foreground max-w-md text-sm">
        {searching
          ? "Tente outro nome ou e-mail."
          : "Clique em “Adicionar CS” para criar a primeira conta de Customer Success."}
      </p>
    </div>
  );
}

function CsTeamSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      <Skeleton className="h-[260px] rounded-3xl" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-[116px] rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-[72px] rounded-3xl" />
      <Skeleton className="h-[320px] rounded-3xl" />
    </div>
  );
}

// ============================================================================
// Dialogs
// ============================================================================
function PasswordField({
  id,
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete?: string;
}) {
  const [show, setShow] = React.useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="h-11 rounded-xl pr-10"
        required
      />
      <button
        type="button"
        onClick={() => setShow((current) => !current)}
        aria-label={show ? "Ocultar senha" : "Mostrar senha"}
        className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer"
      >
        {show ? <EyeSlash className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

function AddCsDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    name: string;
    email: string;
    password: string;
    clientIds: string[];
  }) => void;
  isLoading: boolean;
}) {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [clientIds, setClientIds] = React.useState<string[]>([]);

  const reset = () => {
    setName("");
    setEmail("");
    setPassword("");
    setClientIds([]);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return toast.error("Nome é obrigatório");
    if (!email.trim()) return toast.error("E-mail é obrigatório");
    if (password.length < 8)
      return toast.error("Senha deve ter no mínimo 8 caracteres");
    onSubmit({ name: name.trim(), email: email.trim(), password, clientIds });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="bg-gradient-custom flex size-10 items-center justify-center rounded-full text-[#04222A]">
              <Headset className="size-5" weight="fill" />
            </span>
            <span>Adicionar usuário de CS</span>
          </DialogTitle>
          <DialogDescription>
            A conta terá exatamente o acesso dos clientes liberados, trocando de
            cliente pelo seletor no topo da tela.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label
              htmlFor="add-cs-name"
              className="flex items-center gap-2 text-sm font-semibold"
            >
              <UserGear className="text-brand-cyan size-4" weight="fill" />
              Nome completo *
            </Label>
            <Input
              id="add-cs-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Maria Souza"
              className="h-11 rounded-xl"
              required
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="add-cs-email"
              className="flex items-center gap-2 text-sm font-semibold"
            >
              <Envelope className="text-brand-cyan size-4" weight="fill" />
              E-mail *
            </Label>
            <Input
              id="add-cs-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="cs@clipfy.ai"
              className="h-11 rounded-xl"
              autoComplete="off"
              required
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="add-cs-password"
              className="flex items-center gap-2 text-sm font-semibold"
            >
              <Shield className="text-brand-cyan size-4" weight="fill" />
              Senha *
            </Label>
            <PasswordField
              id="add-cs-password"
              value={password}
              onChange={setPassword}
              placeholder="Mínimo de 8 caracteres"
              autoComplete="new-password"
            />
            <p className="text-muted-foreground text-xs">
              Será usada no primeiro acesso. O CS pode trocá-la depois.
            </p>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="add-cs-clients"
              className="flex items-center gap-2 text-sm font-semibold"
            >
              <UsersThree className="text-brand-cyan size-4" weight="fill" />
              Clientes liberados
            </Label>
            <CsClientMultiSelect
              id="add-cs-clients"
              value={clientIds}
              onChange={setClientIds}
              disabled={isLoading}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="w-full cursor-pointer rounded-xl sm:w-auto"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="btn-gradient-auth cursor-pointer rounded-xl font-semibold"
            >
              {isLoading ? (
                <>
                  <CircleNotch className="size-4 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <UserPlus className="size-4" weight="bold" />
                  Criar usuário de CS
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditCsDialog({
  user,
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}: {
  user: CsUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; clientIds: string[] }) => void;
  isLoading: boolean;
}) {
  const [name, setName] = React.useState("");
  const [clientIds, setClientIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (user) {
      setName(user.name ?? "");
      setClientIds(user.clients.map((client) => client.id));
    }
  }, [user]);

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Headset className="text-brand-cyan size-5" weight="fill" />
            Editar usuário de CS
          </DialogTitle>
          <DialogDescription>
            Atualize o nome e os clientes que {user.email} pode visualizar.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) return toast.error("Nome é obrigatório");
            onSubmit({ name: name.trim(), clientIds });
          }}
          className="space-y-5"
        >
          <div className="space-y-2">
            <Label htmlFor="edit-cs-name">Nome</Label>
            <Input
              id="edit-cs-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nome do usuário de CS"
              className="h-11 rounded-xl"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-cs-clients">Clientes liberados</Label>
            <CsClientMultiSelect
              id="edit-cs-clients"
              value={clientIds}
              onChange={setClientIds}
              disabled={isLoading}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="cursor-pointer rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="btn-gradient-auth cursor-pointer rounded-xl font-semibold"
            >
              {isLoading ? (
                <>
                  <CircleNotch className="size-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar alterações"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PasswordDialog({
  user,
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}: {
  user: CsUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (password: string) => void;
  isLoading: boolean;
}) {
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");

  React.useEffect(() => {
    if (!open) {
      setPassword("");
      setConfirm("");
    }
  }, [open]);

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="text-brand-cyan size-5" weight="fill" />
            Alterar senha
          </DialogTitle>
          <DialogDescription>
            Defina uma nova senha para {user.name ?? user.email}.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (password.length < 8)
              return toast.error("Senha deve ter no mínimo 8 caracteres");
            if (password !== confirm)
              return toast.error("As senhas não coincidem");
            onSubmit(password);
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="cs-new-password">Nova senha</Label>
            <PasswordField
              id="cs-new-password"
              value={password}
              onChange={setPassword}
              placeholder="Mínimo de 8 caracteres"
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cs-confirm-password">Confirmar senha</Label>
            <PasswordField
              id="cs-confirm-password"
              value={confirm}
              onChange={setConfirm}
              placeholder="Repita a nova senha"
              autoComplete="new-password"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="cursor-pointer rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="btn-gradient-auth cursor-pointer rounded-xl font-semibold"
            >
              {isLoading ? (
                <>
                  <CircleNotch className="size-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar senha"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
