"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  Check,
  Copy,
  DotsThree,
  ImageSquare,
  Palette,
  PencilSimple,
  Plus,
  SpinnerGap,
  Star,
  TextAa,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { api } from "@/trpc/react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { BrandPreview } from "./brand-preview";
import { EmptyPanel, ErrorPanel, PageHeader } from "./shared";
import { shouldPollBrandKit } from "./brand-kit-utils";
import { duplicatedIntroTitle } from "./intro-title";
import { type BrandKit } from "@/server/league-clips/contracts";

const kitLimit = 10;
type KitAction = {
  type: "create" | "duplicate" | "default" | "delete";
  kitId?: string;
};

export function BrandKitsView() {
  const router = useRouter();
  const utils = api.useUtils();
  const [name, setName] = useState("");
  const [action, setAction] = useState<KitAction | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BrandKit | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const menuButtons = useRef<Record<string, HTMLButtonElement | null>>({});
  const lastDeleteId = useRef<string | null>(null);
  const list = api.leagueClips.brandKits.useQuery(undefined, {
    refetchInterval: (q) =>
      q.state.data?.items.some(shouldPollBrandKit) ? 3000 : false,
  });
  const create = api.leagueClips.createBrandKit.useMutation();
  const remove = api.leagueClips.deleteBrandKit.useMutation();
  const setDefault = api.leagueClips.setDefaultBrandKit.useMutation();
  const limitReached = (list.data?.items.length ?? 0) >= kitLimit;
  const busy = !!action;

  async function createKit(source?: BrandKit) {
    if (busy || limitReached || !list.data || list.isError) return;
    const chosen = source
      ? source.name.slice(0, 92).trimEnd() + " (cópia)"
      : name.trim();
    if (!chosen) {
      nameInput.current?.focus();
      return;
    }
    setAction({ type: source ? "duplicate" : "create", kitId: source?.id });
    try {
      const kit = await create.mutateAsync(
        source
          ? {
              name: chosen,
              fontFamily: source.fontFamily,
              colors: source.colors,
              defaultTemplateKey: source.defaultTemplateKey,
              captionStyle: source.captionStyle,
              titleStyle: source.titleStyle,
              ...duplicatedIntroTitle(source),
              logo: {
                position: source.logo.position,
                scale: source.logo.scale,
                opacity: source.logo.opacity,
              },
            }
          : { name: chosen },
      );
      await utils.leagueClips.brandKits.invalidate();
      setName("");
      router.push("/ai-clips/brand-kits/" + kit.id);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível criar o kit.",
      );
    } finally {
      setAction(null);
    }
  }

  async function makeDefault(kit: BrandKit) {
    if (busy) return;
    setAction({ type: "default", kitId: kit.id });
    try {
      await setDefault.mutateAsync({ id: kit.id });
      await utils.leagueClips.brandKits.invalidate();
      toast.success("Identidade padrão atualizada.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível definir o padrão.",
      );
    } finally {
      setAction(null);
    }
  }

  async function deleteKit(kit: BrandKit) {
    if (busy) return;
    setDeleteError(null);
    setAction({ type: "delete", kitId: kit.id });
    try {
      await remove.mutateAsync({ id: kit.id });
      await utils.leagueClips.brandKits.invalidate();
      setDeleteTarget(null);
      toast.success("Kit apagado.");
    } catch {
      setDeleteError("Não foi possível apagar o kit. Tente novamente.");
    } finally {
      setAction(null);
    }
  }

  return (
    <main className="mx-auto max-w-6xl p-4 pb-16 md:p-8">
      <PageHeader
        title="Identidade visual"
        description="Cores, fontes e logo da sua marca, prontos para os próximos clipes."
      />

      <section
        aria-labelledby="new-kit-title"
        className="bg-card mb-8 rounded-2xl border p-5 sm:p-6"
      >
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="flex gap-3">
            <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
              <Palette className="size-5" />
            </span>
            <div>
              <h2 id="new-kit-title" className="font-semibold">
                Sua marca, em cada clipe
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Crie um kit e personalize o visual sem começar do zero.
              </p>
            </div>
          </div>
          {list.data && (
            <Badge variant="outline" className="font-normal tabular-nums">
              {list.data.items.length} de {kitLimit} kits
            </Badge>
          )}
        </div>
        <form
          className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            void createKit();
          }}
        >
          <div className="min-w-0 flex-1 space-y-2">
            <label htmlFor="kit-name" className="text-sm font-medium">
              Nome do kit
            </label>
            <Input
              ref={nameInput}
              id="kit-name"
              maxLength={100}
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: Canal principal, Podcast, Melhores momentos"
              aria-describedby="kit-create-help"
              disabled={busy || limitReached}
              className="bg-background h-11"
            />
          </div>
          <Button
            type="submit"
            className="h-11 shrink-0"
            disabled={
              busy || limitReached || !name.trim() || !list.data || list.isError
            }
          >
            {action?.type === "create" ? (
              <SpinnerGap className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            {action?.type === "create" ? "Criando kit…" : "Criar kit"}
          </Button>
        </form>
        <p
          id="kit-create-help"
          className="text-muted-foreground mt-3 text-xs leading-relaxed"
        >
          {limitReached
            ? "Você atingiu o limite de 10 kits. Edite um kit existente ou apague um para liberar espaço."
            : "A identidade é aplicada aos novos projetos. Os projetos já criados mantêm o visual escolhido."}
        </p>
      </section>

      <section aria-labelledby="kits-title">
        <div className="mb-5">
          <h2 id="kits-title" className="text-lg font-semibold">
            Seus kits
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            O kit padrão fica selecionado ao criar um projeto.
          </p>
        </div>
        {list.isLoading ? (
          <div
            className="grid gap-4 md:grid-cols-2"
            role="status"
            aria-label="Carregando identidades visuais"
          >
            <Skeleton className="h-80 rounded-2xl" />
            <Skeleton className="h-80 rounded-2xl" />
          </div>
        ) : list.isError ? (
          <ErrorPanel
            message="Não foi possível carregar seus kits. Tente novamente."
            retry={() => void list.refetch()}
          />
        ) : !list.data?.items.length ? (
          <EmptyPanel
            title="Dê uma identidade aos seus clipes"
            detail="Salve seu primeiro kit com cores, fontes e logo para criar um visual consistente."
          >
            <Button
              variant="outline"
              onClick={() => nameInput.current?.focus()}
            >
              <Plus className="size-4" />
              Criar meu primeiro kit
            </Button>
          </EmptyPanel>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {list.data.items.map((kit) => {
              const saving = shouldPollBrandKit(kit);
              const currentAction = action?.kitId === kit.id ? action : null;
              const swatches = [
                {
                  label: "Texto",
                  color: kit.captionStyle.textColor ?? "#ffffff",
                },
                {
                  label: "Destaque",
                  color:
                    kit.captionStyle.highlightColor ??
                    kit.colors?.accent ??
                    "#2dd4bf",
                },
                {
                  label: "Contorno",
                  color: kit.captionStyle.outlineColor ?? "#000000",
                },
              ];
              return (
                <Card
                  key={kit.id}
                  className="rounded-2xl shadow-none transition-colors"
                >
                  <CardContent className="space-y-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="leading-snug font-semibold break-words">
                          {kit.name}
                        </h3>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {kit.isDefault && (
                            <Badge className="bg-primary/10 text-primary gap-1 border-transparent">
                              <Star className="size-3" weight="fill" />
                              Padrão
                            </Badge>
                          )}
                          {saving && (
                            <Badge variant="outline" className="gap-1">
                              <SpinnerGap className="size-3 animate-spin" />
                              Salvando alterações
                            </Badge>
                          )}
                          {kit.lastError && (
                            <Badge
                              variant="outline"
                              className="text-destructive gap-1"
                            >
                              <WarningCircle className="size-3" />
                              Revisar atualização
                            </Badge>
                          )}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            ref={(element) => {
                              menuButtons.current[kit.id] = element;
                            }}
                            variant="ghost"
                            size="icon"
                            className="size-8 shrink-0"
                            aria-label={"Mais ações para " + kit.name}
                            disabled={busy}
                          >
                            <DotsThree className="size-5" weight="bold" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuItem
                            onSelect={() => void createKit(kit)}
                            disabled={busy || limitReached || saving}
                          >
                            <Copy className="size-4" />
                            Duplicar estilo
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => void makeDefault(kit)}
                            disabled={busy || kit.isDefault || saving}
                          >
                            {kit.isDefault ? (
                              <Check className="size-4" />
                            ) : (
                              <Star className="size-4" />
                            )}
                            {kit.isDefault
                              ? "Este é o kit padrão"
                              : "Definir como padrão"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            disabled={busy || saving}
                            onSelect={() => {
                              lastDeleteId.current = kit.id;
                              setDeleteError(null);
                              setDeleteTarget(kit);
                            }}
                          >
                            <Trash className="size-4" />
                            Apagar kit
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="flex gap-5">
                      <div className="shrink-0">
                        <BrandPreview kit={kit} compact />
                      </div>
                      <div className="min-w-0 flex-1 space-y-5 py-1">
                        <div>
                          <p className="text-muted-foreground mb-2 text-xs">
                            Cores da legenda
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {swatches.map((swatch) => (
                              <span
                                key={swatch.label}
                                className="size-7 rounded-full border shadow-sm"
                                style={{ backgroundColor: swatch.color }}
                                title={swatch.label + ": " + swatch.color}
                              >
                                <span className="sr-only">
                                  {swatch.label}: {swatch.color}
                                </span>
                              </span>
                            ))}
                          </div>
                        </div>
                        <p className="flex items-start gap-2 text-sm">
                          <TextAa className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                          <span className="break-words">
                            {kit.captionStyle.fontName ??
                              kit.fontFamily ??
                              "Fonte do template"}
                          </span>
                        </p>
                        <p className="text-muted-foreground flex items-center gap-2 text-xs">
                          <ImageSquare className="size-4 shrink-0" />
                          {kit.logo.url ? "Logo adicionado" : "Sem logo"}
                        </p>
                        {kit.lastError && (
                          <p
                            role="alert"
                            className="text-destructive text-xs leading-relaxed"
                          >
                            A última atualização não foi aplicada. Abra o kit
                            para revisar.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 border-t pt-4">
                      <Button asChild size="sm">
                        <Link href={"/ai-clips/brand-kits/" + kit.id}>
                          <PencilSimple className="size-4" />
                          Editar identidade
                          <span className="sr-only"> de {kit.name}</span>
                        </Link>
                      </Button>
                      {currentAction && (
                        <span
                          role="status"
                          className="text-muted-foreground flex items-center gap-1.5 text-xs"
                        >
                          <SpinnerGap className="size-3 animate-spin" />
                          {currentAction.type === "duplicate"
                            ? "Duplicando estilo…"
                            : currentAction.type === "default"
                              ? "Definindo padrão…"
                              : "Apagando kit…"}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && action?.type !== "delete") setDeleteTarget(null);
        }}
      >
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const menu = lastDeleteId.current
              ? menuButtons.current[lastDeleteId.current]
              : null;
            (menu ?? nameInput.current)?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar este kit?</AlertDialogTitle>
            <AlertDialogDescription className="leading-relaxed break-words">
              O kit “{deleteTarget?.name}” será apagado. Os projetos já criados
              mantêm a identidade visual aplicada. Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p role="alert" className="text-destructive text-sm">
              {deleteError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={action?.type === "delete"}>
              Manter kit
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                if (deleteTarget) void deleteKit(deleteTarget);
              }}
            >
              {action?.type === "delete" ? (
                <SpinnerGap className="size-4 animate-spin" />
              ) : (
                <Trash className="size-4" />
              )}
              {action?.type === "delete" ? "Apagando…" : "Apagar kit"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
