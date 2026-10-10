"use client";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Clapperboard,
  Eye,
  ImageIcon,
  Palette,
  Save,
  Sparkles,
  Type,
  UploadCloud,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { type BrandKit } from "@/server/league-clips/contracts";
import { ClipPreviewPlayer } from "./clip-preview-player";
import { CaptionStylePicker } from "./caption-style-picker";
import { CaptionSample } from "./caption-sample";
import { previewCaptionStyle } from "./caption-preview-utils";
import {
  applyIntroTitlePatch,
  introTitleForSubmit,
  introTitleIssues,
  introTitleOrNull,
  resolveIntroTitle,
  sameIntroTitle,
  type IntroTitleKey,
} from "./intro-title";
import {
  focusIntroTitleField,
  IntroTitleControls,
} from "./intro-title-controls";
import {
  ChoiceButton,
  ColorField,
  EditorSection,
  RangeField,
} from "./brand-style-controls";
import { ErrorPanel, PageHeader } from "./shared";
import { leagueCode } from "./async-state";
import {
  displayTemplateKey,
  logoDimensions,
  logoReasonMessage,
  putLogo,
  shouldPollBrandKit,
  validateLogoMeta,
} from "./brand-kit-utils";
const fonts = ["Archivo Black", "Inter", "Montserrat"] as const;
const introIdPrefix = "kit-intro";
const positions = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
] as const;
function preserveKitDraft(current: BrandKit, updated: BrandKit): BrandKit {
  return {
    ...updated,
    name: current.name,
    fontFamily: current.fontFamily,
    colors: current.colors,
    defaultTemplateKey: current.defaultTemplateKey,
    captionStyle: current.captionStyle,
    titleStyle: current.titleStyle,
    introTitle: current.introTitle,
    logo: {
      ...updated.logo,
      position: current.logo.position,
      scale: current.logo.scale,
      opacity: current.logo.opacity,
    },
  };
}
function reasonFrom(error: unknown): string | null {
  if (!error || typeof error !== "object" || !("data" in error)) return null;
  const data = error.data;
  if (!data || typeof data !== "object" || !("leagueError" in data))
    return null;
  const service = data.leagueError;
  if (!service || typeof service !== "object" || !("details" in service))
    return null;
  const details = service.details;
  return details &&
    typeof details === "object" &&
    "reason" in details &&
    typeof details.reason === "string"
    ? details.reason
    : null;
}
export function BrandKitEditorView({ kitId }: { kitId: string }) {
  const router = useRouter();
  const utils = api.useUtils();
  const kit = api.leagueClips.brandKit.useQuery(
    { id: kitId },
    {
      refetchInterval: (q) => (shouldPollBrandKit(q.state.data) ? 3000 : false),
    },
  );
  const templates = api.leagueClips.templates.useQuery();
  const credits = api.leagueClips.credits.useQuery();
  const patch = api.leagueClips.patchBrandKit.useMutation(),
    requestUpload = api.leagueClips.logoUpload.useMutation(),
    attach = api.leagueClips.attachLogo.useMutation(),
    remove = api.leagueClips.removeLogo.useMutation();
  const [form, setForm] = useState<BrandKit | null>(null),
    [dirty, setDirty] = useState(false),
    [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [leaveHref, setLeaveHref] = useState<string | null>(null);
  const [tab, setTab] = useState("brand");
  const synced = useRef<number | null>(null);
  const controlsRef = useRef<HTMLFieldSetElement>(null);
  const previewRef = useRef<HTMLElement>(null);
  const dirtyRef = useRef(false);
  const busy =
    patch.isPending ||
    requestUpload.isPending ||
    attach.isPending ||
    remove.isPending ||
    uploadProgress !== null;
  useEffect(() => {
    if (!dirty) return;
    const warnBeforeLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeave);
    return () => window.removeEventListener("beforeunload", warnBeforeLeave);
  }, [dirty]);
  useEffect(() => {
    const updated = kit.data;
    if (
      !updated ||
      (synced.current !== null && updated.version < synced.current)
    )
      return;
    setForm((current) =>
      dirty && current ? preserveKitDraft(current, updated) : updated,
    );
    synced.current = updated.version;
  }, [kit.data, dirty]);
  const change = (patch: Partial<BrandKit>) => {
    setForm((old) => (old ? { ...old, ...patch } : old));
    dirtyRef.current = true;
    setDirty(true);
  };
  function applyLogoUpdate(updated: BrandKit) {
    setForm((current) =>
      current && dirtyRef.current
        ? preserveKitDraft(current, updated)
        : updated,
    );
    synced.current = updated.version;
  }
  async function refresh() {
    await Promise.all([
      kit.refetch(),
      utils.leagueClips.brandKits.invalidate(),
    ]);
  }
  async function save() {
    if (!form || !kit.data || busy || shouldPollBrandKit(kit.data)) return;
    if (!form.name.trim()) {
      toast.error("Informe um nome.");
      return;
    }
    const introIssues = resolveIntroTitle(form.introTitle).enabled
      ? introTitleIssues(form.introTitle)
      : {};
    const introErrorKey = Object.keys(introIssues)[0] as
      | IntroTitleKey
      | undefined;
    if (introErrorKey) {
      setTab("title");
      toast.error(introIssues[introErrorKey]);
      window.setTimeout(
        () => focusIntroTitleField(introIdPrefix, introErrorKey),
        0,
      );
      return;
    }
    // Só com mudança: um league sem o recurso continua aceitando o PATCH de sempre.
    const introChanged = !sameIntroTitle(form.introTitle, kit.data.introTitle);
    try {
      const updated = await patch.mutateAsync({
        id: kitId,
        version: form.version,
        patch: {
          name: form.name.trim(),
          fontFamily: form.fontFamily,
          colors: form.colors,
          defaultTemplateKey: form.defaultTemplateKey,
          captionStyle: form.captionStyle,
          titleStyle: form.titleStyle,
          ...(introChanged
            ? {
                introTitle: introTitleForSubmit(
                  introTitleOrNull(form.introTitle),
                ),
              }
            : {}),
          logo: {
            position: form.logo.position,
            scale: form.logo.scale,
            opacity: form.logo.opacity,
          },
        },
      });
      setForm(updated);
      synced.current = updated.version;
      dirtyRef.current = false;
      setDirty(false);
      await refresh();
      toast.success(
        updated.pending
          ? "Alteração enviada. Aguardando confirmação…"
          : "Identidade visual salva.",
      );
    } catch (error) {
      if (leagueCode(error) === "VERSION_CONFLICT") {
        await refresh();
        toast.error(
          "O kit mudou em outra sessão. Suas alterações foram mantidas; revise antes de salvar novamente.",
        );
      } else
        toast.error(
          error instanceof Error
            ? error.message
            : "Não foi possível salvar o kit.",
        );
    }
  }
  async function upload(file: File) {
    if (!kit.data || busy || shouldPollBrandKit(kit.data)) return;
    setUploadProgress(0);
    try {
      const preflight = validateLogoMeta({
        type: file.type,
        size: file.size,
        width: 64,
        height: 64,
      });
      if (preflight) {
        toast.error(preflight);
        return;
      }
      const dimensions = await logoDimensions(file);
      const invalid = validateLogoMeta({
        ...dimensions,
        type: file.type,
        size: file.size,
      });
      if (invalid) {
        toast.error(invalid);
        return;
      }
      const ticket = await requestUpload.mutateAsync({
        id: kitId,
        contentType: file.type as "image/png" | "image/jpeg" | "image/webp",
        sizeBytes: file.size,
      });
      await putLogo(ticket.url, file, setUploadProgress);
      await utils.leagueClips.brandKit.invalidate({ id: kitId });
      const current = await utils.leagueClips.brandKit.fetch({ id: kitId });
      const saved = await attach.mutateAsync({
        id: kitId,
        version: current.version,
        uploadKey: ticket.uploadKey,
      });
      applyLogoUpdate(saved);
      await refresh();
      toast.success(
        saved.pending
          ? "Logo enviado. Aguardando confirmação…"
          : "Logo atualizado.",
      );
    } catch (error) {
      toast.error(
        reasonFrom(error)
          ? logoReasonMessage(reasonFrom(error))
          : error instanceof Error
            ? error.message
            : "Falha no logo.",
      );
    } finally {
      setUploadProgress(null);
    }
  }
  async function removeLogo() {
    if (!kit.data || busy || shouldPollBrandKit(kit.data)) return;
    try {
      const saved = await remove.mutateAsync({
        id: kitId,
        version: kit.data.version,
      });
      applyLogoUpdate(saved);
      await refresh();
      toast.success("Logo removido.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível remover o logo.",
      );
    }
  }
  if (kit.isError)
    return (
      <main className="mx-auto max-w-6xl p-4 md:p-8">
        <ErrorPanel
          message={kit.error.message}
          retry={() => void kit.refetch()}
        />
      </main>
    );
  if (kit.isLoading || !form)
    return (
      <main className="mx-auto max-w-6xl p-4 md:p-8">
        <Skeleton className="h-96" />
      </main>
    );
  const templateList = templates.data ?? [];
  const previewTemplate = templateList.find(
    (template) =>
      template.key ===
      displayTemplateKey(form.defaultTemplateKey ?? "default", templateList),
  );
  const controlsDisabled = busy || shouldPollBrandKit(kit.data);
  const caption = previewCaptionStyle(previewTemplate, form);
  const updateCaption = (patch: Partial<BrandKit["captionStyle"]>) =>
    change({ captionStyle: { ...form.captionStyle, ...patch } });
  const updateTitle = (patch: NonNullable<BrandKit["titleStyle"]>) =>
    change({ titleStyle: { ...form.titleStyle, ...patch } });
  const introValue = resolveIntroTitle(form.introTitle);
  const introIssues = introValue.enabled
    ? introTitleIssues(form.introTitle)
    : {};
  const introCustomized = !!introTitleOrNull(form.introTitle);
  return (
    <main
      className="mx-auto max-w-6xl p-4 pb-16 md:p-8"
      onClickCapture={(event) => {
        if (
          !dirty ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          !(event.target instanceof Element)
        )
          return;
        const link = event.target.closest<HTMLAnchorElement>("a[href]");
        if (!link || link.target === "_blank" || link.hasAttribute("download"))
          return;
        const destination = new URL(link.href, window.location.href);
        if (destination.href === window.location.href) return;
        if (destination.origin !== window.location.origin) return;
        event.preventDefault();
        event.stopPropagation();
        setLeaveHref(
          destination.pathname + destination.search + destination.hash,
        );
      }}
    >
      <PageHeader
        title={form.name || "Editar identidade visual"}
        description="Sua marca em cada corte. Personalize o estilo e acompanhe o resultado na prévia."
      >
        <Button asChild variant="outline">
          <Link href="/ai-clips/brand-kits">
            <ArrowLeft className="size-4" />
            Voltar aos kits
          </Link>
        </Button>
        <Button
          onClick={() => void save()}
          disabled={!dirty || busy || shouldPollBrandKit(kit.data)}
        >
          <Save className="size-4" />
          {patch.isPending ? "Salvando…" : "Salvar alterações"}
        </Button>
      </PageHeader>
      <div className="bg-card/60 mb-5 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3">
        <p
          role="status"
          className="text-muted-foreground flex items-center gap-2 text-xs"
        >
          {dirty ? (
            <>
              <span className="size-2 rounded-full bg-amber-400" />
              Alterações não salvas
            </>
          ) : (
            <>
              <CheckCircle2 className="text-primary size-3.5" />
              {shouldPollBrandKit(kit.data)
                ? "Aguardando confirmação…"
                : "Todas as alterações salvas"}
            </>
          )}
        </p>
        <p className="text-muted-foreground text-[11px]">
          Aplicado em novos projetos
        </p>
      </div>
      {kit.data?.lastError && (
        <div className="mb-4">
          <ErrorPanel message={kit.data.lastError.message} />
        </div>
      )}
      {shouldPollBrandKit(kit.data) && (
        <p role="status" className="mb-4 text-sm">
          Salvando identidade visual…
        </p>
      )}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <fieldset
          ref={controlsRef}
          className="min-w-0"
          disabled={controlsDisabled}
        >
          <legend className="sr-only">Personalizar identidade visual</legend>
          <div className="mb-3 flex justify-end lg:hidden">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                previewRef.current?.scrollIntoView({
                  block: "start",
                  behavior: "instant",
                });
                previewRef.current?.focus({ preventScroll: true });
              }}
            >
              <Eye className="size-4" />
              Ver prévia
            </Button>
          </div>
          <Tabs value={tab} onValueChange={setTab} className="gap-5">
            <TabsList className="bg-card grid min-h-12 w-full grid-cols-4 rounded-xl border p-1.5">
              {[
                { value: "brand", label: "Marca", icon: Palette },
                { value: "captions", label: "Legendas", icon: Type },
                { value: "title", label: "Título", icon: Sparkles },
                { value: "logo", label: "Logo", icon: ImageIcon },
              ].map(({ value, label, icon: Icon }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="gap-2 rounded-lg py-2.5 text-xs"
                >
                  <Icon className="size-4" />
                  <span>{label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="brand" className="space-y-5">
              <EditorSection
                icon={<Palette className="size-5" />}
                title="Essência da sua marca"
                description="Uma identidade consistente, do primeiro ao último clipe."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="kit-edit-name" className="text-xs">
                      Nome da identidade
                    </Label>
                    <Input
                      id="kit-edit-name"
                      maxLength={100}
                      value={form.name}
                      className="h-11 rounded-xl"
                      placeholder="Ex.: Meu podcast"
                      onChange={(event) => change({ name: event.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="kit-font" className="text-xs">
                      Fonte da marca
                    </Label>
                    <select
                      id="kit-font"
                      className="bg-background/40 focus-visible:ring-primary/50 h-11 w-full rounded-xl border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
                      value={form.fontFamily ?? "none"}
                      onChange={(event) =>
                        change({
                          fontFamily:
                            event.target.value === "none"
                              ? null
                              : (event.target.value as BrandKit["fontFamily"]),
                        })
                      }
                    >
                      <option value="none">Padrão do estilo</option>
                      {fonts.map((font) => (
                        <option key={font}>{font}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold">Paleta de cores</p>
                    <span className="text-muted-foreground text-[10px]">
                      Comece com uma combinação
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      {
                        name: "Clipfy",
                        primary: "#14f7fe",
                        secondary: "#08222e",
                        accent: "#2dd4bf",
                      },
                      {
                        name: "Violeta",
                        primary: "#a78bfa",
                        secondary: "#1e1538",
                        accent: "#c4b5fd",
                      },
                      {
                        name: "Solar",
                        primary: "#fbbf24",
                        secondary: "#292211",
                        accent: "#fde047",
                      },
                      {
                        name: "Coral",
                        primary: "#fb7185",
                        secondary: "#321725",
                        accent: "#fda4af",
                      },
                    ].map(({ name, ...colors }) => (
                      <button
                        type="button"
                        key={name}
                        className="bg-background/30 hover:border-primary/40 focus-visible:ring-primary/50 flex items-center gap-2 rounded-xl border p-2.5 text-[11px] transition-colors focus-visible:ring-2 focus-visible:outline-none"
                        onClick={() =>
                          change({
                            colors,
                            captionStyle: {
                              ...form.captionStyle,
                              highlightColor: colors.accent,
                            },
                          })
                        }
                      >
                        <span className="flex -space-x-1">
                          {Object.values(colors).map((color) => (
                            <span
                              key={color}
                              className="border-card size-4 rounded-full border-2"
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </span>
                        {name}
                      </button>
                    ))}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {(["primary", "secondary", "accent"] as const).map(
                      (key) => (
                        <ColorField
                          key={key}
                          id={"color-" + key}
                          label={
                            key === "primary"
                              ? "Principal"
                              : key === "secondary"
                                ? "Secundária"
                                : "Destaque"
                          }
                          value={form.colors?.[key] ?? "#2dd4bf"}
                          onChange={(value) =>
                            change({
                              colors: { ...form.colors, [key]: value },
                              ...(key === "accent" &&
                              (!form.captionStyle.highlightColor ||
                                form.captionStyle.highlightColor ===
                                  form.colors?.accent)
                                ? {
                                    captionStyle: {
                                      ...form.captionStyle,
                                      highlightColor: value,
                                    },
                                  }
                                : {}),
                            })
                          }
                        />
                      ),
                    )}
                  </div>
                </div>
              </EditorSection>
              <EditorSection
                icon={<Sparkles className="size-5" />}
                title="Estilo de partida"
                description="Escolha a base da legenda. As suas personalizações são aplicadas sobre ela."
              >
                <CaptionStylePicker
                  templates={templateList}
                  value={
                    form.defaultTemplateKey
                      ? displayTemplateKey(
                          form.defaultTemplateKey,
                          templateList,
                        )
                      : "__default__"
                  }
                  allowDefault
                  loading={templates.isLoading}
                  disabled={controlsDisabled}
                  onValueChange={(value) =>
                    change({
                      defaultTemplateKey:
                        value === "__default__" ? null : value,
                    })
                  }
                />
              </EditorSection>
            </TabsContent>
            <TabsContent value="captions">
              <EditorSection
                icon={<Type className="size-5" />}
                title="Legendas que prendem a atenção"
                description="Ajuste a tipografia, o destaque e o movimento de cada palavra."
              >
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="caption-font" className="text-xs">
                      Fonte da legenda
                    </Label>
                    <select
                      id="caption-font"
                      className="bg-background/40 focus-visible:ring-primary/50 h-11 w-full rounded-xl border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
                      value={form.captionStyle.fontName ?? "none"}
                      onChange={(event) =>
                        updateCaption({
                          fontName:
                            event.target.value === "none"
                              ? undefined
                              : (event.target.value as (typeof fonts)[number]),
                        })
                      }
                    >
                      <option value="none">Usar fonte da marca</option>
                      {fonts.map((font) => (
                        <option key={font}>{font}</option>
                      ))}
                    </select>
                  </div>
                  <RangeField
                    id="caption-size"
                    label="Tamanho da fonte"
                    value={caption.fontSizePx}
                    min={24}
                    max={160}
                    suffix="px"
                    onChange={(value) => updateCaption({ fontSizePx: value })}
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {(
                    ["textColor", "highlightColor", "outlineColor"] as const
                  ).map((key) => (
                    <ColorField
                      key={key}
                      id={"caption-" + key}
                      label={
                        key === "textColor"
                          ? "Texto"
                          : key === "highlightColor"
                            ? "Palavra em destaque"
                            : "Contorno"
                      }
                      value={caption[key]}
                      onChange={(value) => updateCaption({ [key]: value })}
                    />
                  ))}
                </div>
                <div className="space-y-3">
                  <p className="text-xs font-semibold">Movimento da legenda</p>
                  <div
                    className="grid grid-cols-2 gap-3 sm:grid-cols-4"
                    role="group"
                    aria-label="Animação da legenda"
                  >
                    {(
                      [
                        { value: "none", label: "Sem animação" },
                        { value: "color", label: "Destaque" },
                        { value: "pop", label: "Pop" },
                        { value: "karaoke", label: "Karaokê" },
                      ] as const
                    ).map(({ value, label }) => (
                      <ChoiceButton
                        key={value}
                        selected={caption.animation === value}
                        onClick={() => updateCaption({ animation: value })}
                        className="overflow-hidden px-2"
                      >
                        <span className="flex h-10 w-full items-center justify-center rounded-lg bg-slate-950 px-1">
                          <CaptionSample
                            text="Sua melhor ideia"
                            style={{ ...caption, animation: value }}
                            loop
                            className="text-[10px]"
                          />
                        </span>
                        <span className="text-[10px]">{label}</span>
                      </ChoiceButton>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <p className="text-xs font-semibold">Posição no vídeo</p>
                  <div
                    className="grid grid-cols-3 gap-3"
                    role="group"
                    aria-label="Posição da legenda"
                  >
                    {(
                      [
                        { value: "top", label: "Superior" },
                        { value: "middle", label: "Centro" },
                        { value: "bottom", label: "Inferior" },
                      ] as const
                    ).map(({ value, label }) => (
                      <ChoiceButton
                        key={value}
                        selected={caption.position === value}
                        onClick={() => updateCaption({ position: value })}
                      >
                        <span className="relative h-10 w-7 rounded-md border border-current/40">
                          <span
                            className={
                              "absolute inset-x-1 h-1 rounded-full bg-current " +
                              (value === "top"
                                ? "top-2"
                                : value === "middle"
                                  ? "top-1/2 -translate-y-1/2"
                                  : "bottom-2")
                            }
                          />
                        </span>
                        {label}
                      </ChoiceButton>
                    ))}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      {
                        key: "bold",
                        label: "Negrito",
                        description: "Mais presença no vídeo",
                      },
                      {
                        key: "uppercase",
                        label: "Maiúsculas",
                        description: "Todas as letras em caixa alta",
                      },
                    ] as const
                  ).map(({ key, label, description }) => (
                    <div
                      key={key}
                      className="bg-background/30 flex items-center justify-between gap-3 rounded-xl border p-3"
                    >
                      <div>
                        <Label htmlFor={"caption-" + key} className="text-xs">
                          {label}
                        </Label>
                        <p className="text-muted-foreground mt-1 text-[10px]">
                          {description}
                        </p>
                      </div>
                      <Switch
                        id={"caption-" + key}
                        checked={caption[key]}
                        onCheckedChange={(checked) =>
                          updateCaption({ [key]: checked })
                        }
                      />
                    </div>
                  ))}
                </div>
                <details className="group rounded-xl border">
                  <summary className="focus-visible:ring-primary/50 flex cursor-pointer list-none items-center justify-between rounded-xl p-4 text-xs font-medium focus-visible:ring-2 focus-visible:outline-none">
                    Acabamento e ritmo
                    <ChevronDown className="text-muted-foreground size-4 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="grid gap-6 border-t p-4 sm:grid-cols-2">
                    <RangeField
                      id="caption-outline"
                      label="Espessura do contorno"
                      value={caption.outline}
                      min={0}
                      max={3}
                      step={0.1}
                      onChange={(value) => updateCaption({ outline: value })}
                    />
                    <RangeField
                      id="caption-shadow"
                      label="Sombra"
                      value={caption.shadow}
                      min={0}
                      max={4}
                      step={0.1}
                      onChange={(value) => updateCaption({ shadow: value })}
                    />
                    <RangeField
                      id="caption-margin"
                      label="Margem vertical"
                      value={caption.marginV}
                      min={0}
                      max={1800}
                      suffix="px"
                      onChange={(value) => updateCaption({ marginV: value })}
                    />
                    <RangeField
                      id="caption-words"
                      label="Palavras por página"
                      value={caption.maxWordsPerPage}
                      min={1}
                      max={8}
                      onChange={(value) =>
                        updateCaption({ maxWordsPerPage: value })
                      }
                    />
                    <RangeField
                      id="caption-chars"
                      label="Caracteres por página"
                      value={caption.maxCharsPerPage}
                      min={6}
                      max={40}
                      onChange={(value) =>
                        updateCaption({ maxCharsPerPage: value })
                      }
                    />
                  </div>
                </details>
              </EditorSection>
            </TabsContent>
            <TabsContent value="title" className="space-y-5">
              <EditorSection
                icon={<Clapperboard className="size-5" />}
                title="Título de abertura"
                description="O padrão da conta para os novos projetos: o título de cada corte numa faixa nos primeiros segundos. Dá para mudar ao criar cada projeto e em cada corte."
              >
                <IntroTitleControls
                  idPrefix={introIdPrefix}
                  value={introValue}
                  look={{
                    caption,
                    titleStyle: form.titleStyle,
                    templateUppercase: previewTemplate?.uppercase,
                  }}
                  brandColors={form.colors}
                  disabled={controlsDisabled}
                  autoBgHint={
                    form.titleStyle?.textColor
                      ? "Cor do texto do título, definida abaixo."
                      : undefined
                  }
                  issues={introIssues}
                  onChange={(patch) =>
                    change({
                      introTitle: applyIntroTitlePatch(form.introTitle, patch),
                    })
                  }
                  footer={
                    introCustomized && (
                      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                        <p className="text-muted-foreground text-xs">
                          Use o título de abertura padrão da Clipfy.
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => change({ introTitle: null })}
                        >
                          Voltar ao padrão Clipfy
                        </Button>
                      </div>
                    )
                  }
                />
              </EditorSection>
              <EditorSection
                icon={<Sparkles className="size-5" />}
                title="Uma abertura com a sua assinatura"
                description="Personalize a aparência do título mostrado nos seus clipes."
              >
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="title-font" className="text-xs">
                      Fonte do título
                    </Label>
                    <select
                      id="title-font"
                      className="bg-background/40 focus-visible:ring-primary/50 h-11 w-full rounded-xl border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
                      value={form.titleStyle?.fontName ?? "none"}
                      onChange={(event) =>
                        updateTitle({
                          fontName:
                            event.target.value === "none"
                              ? undefined
                              : (event.target.value as (typeof fonts)[number]),
                        })
                      }
                    >
                      <option value="none">Usar fonte da marca</option>
                      {fonts.map((font) => (
                        <option key={font}>{font}</option>
                      ))}
                    </select>
                  </div>
                  <RangeField
                    id="title-size"
                    label="Tamanho do título"
                    value={form.titleStyle?.fontSizePx ?? 56}
                    min={32}
                    max={96}
                    suffix="px"
                    onChange={(value) => updateTitle({ fontSizePx: value })}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {(["textColor", "outlineColor"] as const).map((key) => (
                    <ColorField
                      key={key}
                      id={"title-" + key}
                      label={key === "textColor" ? "Texto" : "Contorno"}
                      value={
                        form.titleStyle?.[key] ??
                        (key === "textColor" ? "#ffffff" : "#000000")
                      }
                      onChange={(value) => updateTitle({ [key]: value })}
                    />
                  ))}
                </div>
                <div className="bg-background/30 flex items-center justify-between gap-3 rounded-xl border p-4">
                  <div>
                    <Label htmlFor="title-uppercase" className="text-xs">
                      Título em maiúsculas
                    </Label>
                    <p className="text-muted-foreground mt-1 text-[11px]">
                      Dê mais força à mensagem de abertura.
                    </p>
                  </div>
                  <Switch
                    id="title-uppercase"
                    checked={form.titleStyle?.uppercase ?? false}
                    onCheckedChange={(checked) =>
                      updateTitle({ uppercase: checked })
                    }
                  />
                </div>
              </EditorSection>
            </TabsContent>
            <TabsContent value="logo">
              <EditorSection
                icon={<ImageIcon className="size-5" />}
                title="A sua marca em cena"
                description="Adicione um logo e ajuste sua presença no vídeo."
              >
                <label
                  className={
                    "bg-background/30 hover:border-primary/40 focus-within:ring-primary/50 relative flex cursor-pointer flex-col items-center gap-3 overflow-hidden rounded-xl border border-dashed p-7 text-center transition-colors focus-within:ring-2 " +
                    (controlsDisabled ? "pointer-events-none opacity-50" : "")
                  }
                >
                  {form.logo.url ? (
                    <span className="bg-muted/50 relative size-16 rounded-xl p-2">
                      <Image
                        src={form.logo.url}
                        alt="Logo atual"
                        fill
                        sizes="64px"
                        unoptimized
                        className="object-contain p-2"
                      />
                    </span>
                  ) : (
                    <span className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-xl">
                      <UploadCloud className="size-6" />
                    </span>
                  )}
                  <span className="text-xs font-semibold">
                    {form.logo.url
                      ? "Trocar logo"
                      : "Clique para enviar seu logo"}
                  </span>
                  <span className="text-muted-foreground max-w-xs text-[11px] leading-relaxed">
                    PNG, WebP ou JPEG · Até 2 MB
                    <br />
                    De 16 a 1024 px por lado
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/webp,image/jpeg"
                    aria-label="Enviar logo"
                    disabled={controlsDisabled}
                    className="absolute inset-0 size-full cursor-pointer opacity-0"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void upload(file);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
                {uploadProgress !== null && (
                  <div role="status" className="space-y-2">
                    <p className="text-xs">Enviando logo: {uploadProgress}%</p>
                    <Progress value={uploadProgress} />
                  </div>
                )}
                {form.logo.key && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void removeLogo()}
                    disabled={controlsDisabled}
                  >
                    Remover logo
                  </Button>
                )}
                <div className="space-y-3">
                  <p className="text-xs font-semibold">Posição da marca</p>
                  <div
                    className="grid grid-cols-2 gap-3 sm:grid-cols-4"
                    role="group"
                    aria-label="Posição do logo"
                  >
                    {positions.map((position) => (
                      <ChoiceButton
                        key={position}
                        selected={form.logo.position === position}
                        onClick={() =>
                          change({ logo: { ...form.logo, position } })
                        }
                      >
                        <span className="relative h-10 w-7 rounded-md border border-current/40">
                          <span
                            className={
                              "absolute size-2 rounded-sm bg-current " +
                              (position.startsWith("top")
                                ? "top-1"
                                : "bottom-1") +
                              (position.endsWith("left") ? "left-1" : "right-1")
                            }
                          />
                        </span>
                        <span className="text-center text-[10px]">
                          {
                            {
                              "top-left": "Superior esquerdo",
                              "top-right": "Superior direito",
                              "bottom-left": "Inferior esquerdo",
                              "bottom-right": "Inferior direito",
                            }[position]
                          }
                        </span>
                      </ChoiceButton>
                    ))}
                  </div>
                </div>
                <div className="grid gap-6 sm:grid-cols-2">
                  <RangeField
                    id="logo-scale"
                    label="Tamanho do logo"
                    value={Math.round(form.logo.scale * 100)}
                    min={5}
                    max={40}
                    suffix="%"
                    onChange={(value) =>
                      change({ logo: { ...form.logo, scale: value / 100 } })
                    }
                  />
                  <RangeField
                    id="logo-opacity"
                    label="Opacidade"
                    value={Math.round(form.logo.opacity * 100)}
                    min={10}
                    max={100}
                    suffix="%"
                    onChange={(value) =>
                      change({ logo: { ...form.logo, opacity: value / 100 } })
                    }
                  />
                </div>
              </EditorSection>
            </TabsContent>
          </Tabs>
          <div className="bg-card/60 mt-5 flex items-center justify-between gap-3 rounded-xl border p-4">
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Seu estilo estará pronto para os próximos clipes.
            </p>
            <Button
              type="button"
              size="sm"
              onClick={() => void save()}
              disabled={!dirty || controlsDisabled}
            >
              <Save className="size-4" />
              {patch.isPending ? "Salvando…" : "Salvar identidade"}
            </Button>
          </div>
        </fieldset>
        <aside
          ref={previewRef}
          tabIndex={-1}
          className="mx-auto w-full max-w-sm scroll-mt-4 outline-none lg:sticky lg:top-6"
        >
          <ClipPreviewPlayer
            kit={form}
            template={previewTemplate}
            watermark={credits.data?.watermark}
            editableText
            introTitle={introValue}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 w-full lg:hidden"
            onClick={() => {
              controlsRef.current?.scrollIntoView({
                block: "start",
                behavior: "instant",
              });
              controlsRef.current
                ?.querySelector<HTMLButtonElement>(
                  '[role="tab"][data-state="active"]',
                )
                ?.focus({ preventScroll: true });
            }}
          >
            <ArrowLeft className="size-4" />
            Voltar aos ajustes
          </Button>
          <div className="bg-card/60 mt-3 flex items-center justify-between rounded-xl border px-4 py-3">
            <span className="text-muted-foreground text-[11px]">
              Sua paleta
            </span>
            <div className="flex gap-1.5">
              {(["primary", "secondary", "accent"] as const).map((key) => (
                <span
                  key={key}
                  className="size-5 rounded-full border border-white/10"
                  style={{ backgroundColor: form.colors?.[key] ?? "#2dd4bf" }}
                  title={
                    key === "primary"
                      ? "Cor principal"
                      : key === "secondary"
                        ? "Cor secundária"
                        : "Cor de destaque"
                  }
                />
              ))}
            </div>
          </div>
          {credits.data?.watermark && (
            <p className="text-muted-foreground mt-3 px-1 text-[10px] leading-relaxed">
              No plano gratuito, a marca d’água Clipfy acompanha o logo. Se
              ambos ocuparem o canto inferior direito, seu logo aparece à
              esquerda.
            </p>
          )}
        </aside>
      </div>
      <AlertDialog
        open={!!leaveHref}
        onOpenChange={(open) => {
          if (!open) setLeaveHref(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem alterações não salvas</AlertDialogTitle>
            <AlertDialogDescription>
              Salve a identidade visual antes de sair para manter suas
              alterações.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (!leaveHref) return;
                dirtyRef.current = false;
                setDirty(false);
                router.push(leaveHref);
              }}
            >
              Sair sem salvar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
