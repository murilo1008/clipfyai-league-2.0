"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Eye, Palette } from "lucide-react";
import {
  ArrowRight,
  CaretDown,
  CheckCircle,
  LinkSimple,
  SlidersHorizontal,
  Sparkle,
  SpinnerGap,
  UploadSimple,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/trpc/react";
import {
  optionsSchema,
  optionsInputSchema,
  type ProjectOptions,
  type ProjectOptionsInput,
  type BrandKit,
  type IntroTitleSettings,
  type ResolvedIntroTitle,
} from "@/server/league-clips/contracts";
import { UploadControl } from "./upload-control";
import { validateUploadOptions } from "./upload";
import { canChangeUploadDialog, canChangeUploadTab } from "./upload-dialog";
import { layoutLabels, optionErrorPt } from "./labels";
import {
  effectiveTemplate,
  selectedBrandKit,
  templateDisplayName,
} from "./brand-kit-utils";
import { ClipPreviewPlayer } from "./clip-preview-player";
import { CaptionStylePicker } from "./caption-style-picker";
import {
  previewCaptionStyle,
  type CaptionTemplate,
} from "./caption-preview-utils";
import { validSource } from "./source-url";
import {
  applyIntroTitlePatch,
  introTitleIssues,
  introTitleOverrides,
  introTitleSummary,
  resolveIntroTitle,
  type IntroTitlePatch,
} from "./intro-title";
import {
  focusIntroTitleField,
  IntroTitleControls,
  type InheritedIntroColors,
} from "./intro-title-controls";

const introIdPrefix = "new-project-intro";

export function NewProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter(),
    utils = api.useUtils(),
    create = api.leagueClips.create.useMutation(),
    templates = api.leagueClips.templates.useQuery(undefined, {
      enabled: open,
    }),
    brandKits = api.leagueClips.brandKits.useQuery(undefined, {
      enabled: open,
    }),
    credits = api.leagueClips.credits.useQuery(undefined, { enabled: open });
  const [url, setUrl] = useState(""),
    [urlError, setUrlError] = useState<string | null>(null),
    [options, setOptions] = useState<ProjectOptions>(optionsSchema.parse({})),
    [changed, setChanged] = useState<Partial<ProjectOptionsInput>>({}),
    [advanced, setAdvanced] = useState(false),
    [uploading, setUploading] = useState(false),
    [tab, setTab] = useState("link"),
    [introEdits, setIntroEdits] = useState<IntroTitleSettings>({});
  const submitting = useRef(false);
  const [durationFocus, setDurationFocus] = useState<string | null>(null);
  useEffect(() => {
    if (!advanced || !durationFocus) return;
    document
      .getElementById(
        durationFocus === "minDurationMs" ? "min-duration" : "max-duration",
      )
      ?.focus();
    setDurationFocus(null);
  }, [advanced, durationFocus]);
  // Título de abertura: valores iniciais do brand kit escolhido (ou do padrão); só o que a pessoa muda vai ao league.
  const kitIntro = selectedBrandKit(
    brandKits.data?.items ?? [],
    changed,
  )?.introTitle;
  const inheritedIntro = resolveIntroTitle(kitIntro);
  const introOverrides = introTitleOverrides(introEdits, inheritedIntro);
  const requestOptions: ProjectOptionsInput = introOverrides
    ? { ...changed, introTitle: introOverrides }
    : changed;
  const intro = {
    value: resolveIntroTitle(kitIntro, introEdits),
    issues: introTitleIssues(introEdits),
    onChange: (patch: IntroTitlePatch) =>
      setIntroEdits((previous) => applyIntroTitlePatch(previous, patch)),
    inherited:
      kitIntro?.bgColor || kitIntro?.textColor
        ? {
            label: "Da identidade",
            bgColor: kitIntro.bgColor,
            textColor: kitIntro.textColor,
          }
        : undefined,
    fromKit: !!kitIntro && Object.keys(kitIntro).length > 0,
    baseline: inheritedIntro,
  };
  function focusOptionError(field: string | undefined) {
    if (field?.startsWith("introTitle")) {
      focusIntroTitleField(introIdPrefix, field.split(".")[1]);
      return;
    }
    if (field !== "minDurationMs" && field !== "maxDurationMs") return;
    setAdvanced(true);
    setDurationFocus(field);
  }
  const busy = uploading || create.isPending;
  const update = <K extends keyof ProjectOptions>(
    key: K,
    value: ProjectOptions[K],
  ) => {
    setOptions((p) => ({ ...p, [key]: value }));
    setChanged((p) => ({ ...p, [key]: value }));
  };
  function chooseKit(value: string) {
    const brandKitId =
      value === "__default__" ? undefined : value === "__none__" ? null : value;
    setOptions((p) => ({ ...p, brandKitId, captionTemplateKey: "default" }));
    setChanged((p) => {
      const next = { ...p };
      delete next.captionTemplateKey;
      if (brandKitId === undefined) delete next.brandKitId;
      else next.brandKitId = brandKitId;
      return next;
    });
  }
  function validateUrl(value: string) {
    const message = value
      ? "Use um link de uma das plataformas aceitas abaixo."
      : "Cole o link do vídeo para continuar.";
    setUrlError(validSource(value) ? null : message);
    return validSource(value);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current || busy) return;
    const source = url.trim();
    setUrl(source);
    if (!validateUrl(source)) {
      document.getElementById("source-url")?.focus();
      return;
    }
    const parsed = validateUploadOptions(requestOptions);
    if (!parsed.ok) {
      focusOptionError(parsed.field);
      toast.error(parsed.message);
      return;
    }
    submitting.current = true;
    try {
      const project = await create.mutateAsync({
        url: source,
        options: parsed.options,
        idempotencyKey: crypto.randomUUID(),
      });
      await utils.leagueClips.list.invalidate();
      onOpenChange(false);
      router.push("/ai-clips/" + project.id);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível criar o projeto.",
      );
    } finally {
      submitting.current = false;
    }
  }
  const preferences = (resuming = false) => (
    <OptionsForm
      options={options}
      update={update}
      templates={templates.data ?? []}
      brandKits={brandKits.data?.items ?? []}
      changed={requestOptions}
      chooseKit={chooseKit}
      intro={intro}
      watermark={credits.data?.watermark ?? false}
      advanced={advanced}
      setAdvanced={setAdvanced}
      disabled={busy || resuming}
      templatesLoading={templates.isLoading}
      kitsLoading={brandKits.isLoading}
    />
  );
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (canChangeUploadDialog(next, busy)) onOpenChange(next);
      }}
    >
      <DialogContent
        showCloseButton={!busy}
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (busy) event.preventDefault();
        }}
        className="bg-card max-h-[90dvh] gap-6 overflow-y-auto rounded-2xl p-5 sm:w-[calc(100%-2rem)] sm:max-w-[940px] sm:p-7"
      >
        <DialogHeader className="gap-3 text-left">
          <span className="text-primary flex items-center gap-2 text-xs font-semibold tracking-wider uppercase">
            <Sparkle className="size-4" weight="fill" aria-hidden="true" />
            AI Clips
          </span>
          <DialogTitle className="text-2xl tracking-tight">
            Seu próximo corte começa aqui
          </DialogTitle>
          <DialogDescription className="max-w-lg leading-relaxed">
            Escolha um vídeo e ajuste suas preferências. A IA encontra os
            momentos para transformar em clipes.
          </DialogDescription>
        </DialogHeader>
        <Tabs
          value={tab}
          onValueChange={(next) => {
            if (canChangeUploadTab(tab, next, busy)) setTab(next);
          }}
        >
          <TabsList className="bg-muted/60 mb-1 h-11 w-full rounded-xl p-1">
            <TabsTrigger
              value="link"
              disabled={busy}
              className="h-full flex-1 gap-2 rounded-lg"
            >
              <LinkSimple className="size-4" aria-hidden="true" />
              Colar link
            </TabsTrigger>
            <TabsTrigger
              value="file"
              disabled={busy && tab !== "file"}
              className="h-full flex-1 gap-2 rounded-lg"
            >
              <UploadSimple className="size-4" aria-hidden="true" />
              Enviar arquivo
            </TabsTrigger>
          </TabsList>
          <TabsContent value="link" className="pt-4">
            <form onSubmit={submit} noValidate className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="source-url">Link do vídeo</Label>
                <div className="relative">
                  <LinkSimple
                    className="text-muted-foreground absolute top-3.5 left-3.5 size-5"
                    aria-hidden="true"
                  />
                  <Input
                    id="source-url"
                    type="url"
                    required
                    disabled={busy}
                    className="bg-background/50 h-12 rounded-xl pl-11"
                    placeholder="Cole o link do seu vídeo"
                    value={url}
                    autoComplete="url"
                    aria-invalid={!!urlError}
                    aria-describedby={
                      urlError
                        ? "source-url-error source-url-help"
                        : "source-url-help"
                    }
                    onChange={(e) => {
                      setUrl(e.target.value);
                      setUrlError(null);
                    }}
                    onBlur={() => {
                      const value = url.trim();
                      setUrl(value);
                      if (value) validateUrl(value);
                    }}
                  />
                </div>
                {urlError && (
                  <p
                    id="source-url-error"
                    role="alert"
                    className="text-destructive text-sm"
                  >
                    {urlError}
                  </p>
                )}
                <p
                  id="source-url-help"
                  className="text-muted-foreground text-xs leading-relaxed"
                >
                  YouTube, Twitch, Kick, TikTok, Instagram, Facebook, Vimeo e
                  Google Drive.
                </p>
              </div>
              {preferences()}
              <div className="border-t pt-5">
                <ProjectSummary
                  options={options}
                  changed={requestOptions}
                  intro={intro.value}
                  templates={templates.data ?? []}
                  brandKits={brandKits.data?.items ?? []}
                  loading={templates.isLoading || brandKits.isLoading}
                />
                <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-muted-foreground max-w-xs text-xs leading-relaxed">
                    A estimativa de créditos aparece após a análise inicial do
                    vídeo.
                  </p>
                  <Button
                    type="submit"
                    disabled={busy}
                    className="h-11 gap-2 rounded-xl px-5"
                  >
                    {create.isPending ? (
                      <SpinnerGap
                        className="size-4 motion-safe:animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Sparkle className="size-4" aria-hidden="true" />
                    )}
                    {create.isPending
                      ? "Criando projeto…"
                      : "Gerar meus clipes"}
                    {!create.isPending && (
                      <ArrowRight className="size-4" aria-hidden="true" />
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </TabsContent>
          <TabsContent value="file" className="pt-4">
            <UploadControl
              options={requestOptions}
              onRunningChange={setUploading}
              onOptionsError={focusOptionError}
              configuration={(resuming) => (
                <>
                  {preferences(resuming)}
                  {!resuming && (
                    <ProjectSummary
                      options={options}
                      changed={requestOptions}
                      intro={intro.value}
                      templates={templates.data ?? []}
                      brandKits={brandKits.data?.items ?? []}
                      loading={templates.isLoading || brandKits.isLoading}
                    />
                  )}
                </>
              )}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

type Template = CaptionTemplate;

function ProjectSummary({
  options,
  changed,
  intro,
  templates,
  brandKits,
  loading,
}: {
  options: ProjectOptions;
  changed: ProjectOptionsInput;
  intro: ResolvedIntroTitle;
  templates: Template[];
  brandKits: BrandKit[];
  loading: boolean;
}) {
  const kit = selectedBrandKit(brandKits, changed);
  const template = effectiveTemplate(brandKits, changed, templates);
  return (
    <div className="bg-primary/5 border-primary/15 rounded-xl border px-4 py-3">
      <p className="flex items-center gap-2 text-xs font-semibold">
        <CheckCircle className="text-primary size-4" aria-hidden="true" />
        Preferências do projeto
      </p>
      <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
        Até {options.clipCount} clipes ·{" "}
        {options.aspectRatios.join(" e ") || "Selecione um formato"} · Duração
        ideal de {options.minDurationMs / 1000}–{options.maxDurationMs / 1000}s
        ·{" "}
        {options.captionsEnabled
          ? loading
            ? "Carregando estilo de legenda…"
            : "Legendas: " + templateDisplayName(template, templates)
          : "Sem legendas"}
        {" · " + introTitleSummary(intro)}
        {!loading && kit ? " · " + kit.name : ""}
      </p>
    </div>
  );
}

function OptionsForm({
  options,
  update,
  templates,
  brandKits,
  changed,
  chooseKit,
  intro,
  watermark,
  advanced,
  setAdvanced,
  disabled,
  templatesLoading,
  kitsLoading,
}: {
  options: ProjectOptions;
  update: <K extends keyof ProjectOptions>(
    key: K,
    value: ProjectOptions[K],
  ) => void;
  templates: Template[];
  brandKits: BrandKit[];
  changed: ProjectOptionsInput;
  chooseKit: (value: string) => void;
  intro: {
    value: ResolvedIntroTitle;
    issues: ReturnType<typeof introTitleIssues>;
    onChange: (patch: IntroTitlePatch) => void;
    inherited?: InheritedIntroColors;
    fromKit: boolean;
    baseline: ResolvedIntroTitle;
  };
  watermark: boolean;
  advanced: boolean;
  setAdvanced: (v: boolean) => void;
  disabled: boolean;
  templatesLoading: boolean;
  kitsLoading: boolean;
}) {
  const [term, setTerm] = useState("");
  const preferencesRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const currentKit = selectedBrandKit(brandKits, changed);
  const currentTemplate = effectiveTemplate(brandKits, changed, templates);
  const previewTemplate = templates.find(
    (template) => template.key === currentTemplate,
  );
  const introLook = {
    caption: previewCaptionStyle(previewTemplate, currentKit ?? undefined),
    titleStyle: currentKit?.titleStyle,
    templateUppercase: previewTemplate?.uppercase,
  };
  const parsed = optionsInputSchema.safeParse(changed);
  const error = parsed.success
    ? null
    : optionErrorPt(
        parsed.error.issues[0]?.path ?? [],
        parsed.error.issues[0]?.message,
      );
  const addTerm = () => {
    const value = term.trim();
    if (value && options.keyterms.length < 100) {
      if (!options.keyterms.includes(value))
        update("keyterms", [...options.keyterms, value]);
      setTerm("");
    }
  };
  return (
    <div ref={preferencesRef} className="space-y-5">
      <div className="flex items-center justify-between gap-3 border-t pt-5">
        <div>
          <p className="text-sm font-semibold">Dê o seu estilo aos clipes</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Escolha o formato e veja sua legenda em ação.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 gap-1 text-xs md:hidden"
            onClick={() => {
              previewRef.current?.scrollIntoView({
                block: "start",
                behavior: "instant",
              });
              previewRef.current?.focus({ preventScroll: true });
            }}
          >
            <Eye className="size-3.5" />
            Ver prévia
          </Button>
          <Sparkle
            className="text-primary hidden size-5 shrink-0 md:block"
            aria-hidden="true"
          />
        </div>
      </div>
      <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0 space-y-6">
          <fieldset className="space-y-3" aria-describedby="formats-help">
            <legend className="mb-1 text-sm font-semibold">
              Formatos de saída
            </legend>
            <div className="grid grid-cols-2 gap-3">
              {(["9:16", "1:1"] as const).map((ratio) => {
                const selected = options.aspectRatios.includes(ratio);
                return (
                  <label
                    key={ratio}
                    className={
                      "group relative flex min-w-0 flex-col gap-3 rounded-xl border p-3 transition-all duration-200 motion-reduce:transition-none sm:flex-row sm:items-center " +
                      (disabled
                        ? "cursor-default opacity-60"
                        : "cursor-pointer") +
                      (selected
                        ? "border-primary/60 bg-primary/5 ring-primary/10 ring-2"
                        : "border-border/70 bg-background/30 hover:border-primary/40 hover:bg-muted/40")
                    }
                  >
                    <span
                      className="relative flex h-24 shrink-0 items-center justify-center sm:w-16"
                      aria-hidden="true"
                    >
                      <span
                        className={
                          "relative block overflow-hidden rounded-lg bg-slate-950 shadow-lg transition-transform duration-300 group-hover:scale-105 motion-reduce:transform-none " +
                          (ratio === "9:16" ? "h-24 w-[54px]" : "size-16")
                        }
                      >
                        <Image
                          src="/images/ai-clips/preview-podcast.webp"
                          alt=""
                          fill
                          sizes="64px"
                          className="object-cover"
                        />
                        <span className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        <span className="absolute inset-x-1 bottom-3 text-center text-[5px] leading-tight font-extrabold text-white">
                          A melhor <span className="text-teal-300">parte</span>
                          <br />
                          do vídeo
                        </span>
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">
                        {ratio}{" "}
                        <span className="text-muted-foreground text-xs font-normal">
                          {ratio === "9:16" ? "Vertical" : "Quadrado"}
                        </span>
                      </span>
                      <span className="text-muted-foreground mt-1 block text-[10px] leading-relaxed">
                        {ratio === "9:16"
                          ? "Reels, TikTok e Shorts"
                          : "Feed e redes sociais"}
                      </span>
                    </span>
                    <Checkbox
                      className="absolute top-3 right-3"
                      checked={selected}
                      disabled={
                        disabled ||
                        (selected && options.aspectRatios.length === 1)
                      }
                      aria-label={
                        "Formato " +
                        ratio +
                        (ratio === "9:16" ? " vertical" : " quadrado")
                      }
                      onCheckedChange={(checked) => {
                        const next =
                          checked === true
                            ? [...options.aspectRatios, ratio]
                            : options.aspectRatios.filter(
                                (value) => value !== ratio,
                              );
                        if (next.length) update("aspectRatios", next);
                      }}
                    />
                  </label>
                );
              })}
            </div>
            <p id="formats-help" className="text-muted-foreground text-[11px]">
              Escolha um ou os dois formatos. Mantenha pelo menos um
              selecionado.
            </p>
          </fieldset>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Label
                htmlFor="captions-enabled"
                className="text-sm font-semibold"
              >
                Estilo da legenda
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-[11px]">
                  {options.captionsEnabled ? "Ativada" : "Desativada"}
                </span>
                <Switch
                  id="captions-enabled"
                  checked={options.captionsEnabled}
                  disabled={disabled}
                  onCheckedChange={(value) => update("captionsEnabled", value)}
                />
              </div>
            </div>
            <CaptionStylePicker
              templates={templates}
              value={currentTemplate}
              onValueChange={(value) => update("captionTemplateKey", value)}
              loading={templatesLoading}
              disabled={disabled || !options.captionsEnabled}
            />
            {currentKit && (
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                As personalizações da sua identidade também são aplicadas à
                legenda.
              </p>
            )}
          </div>
          <div className="bg-background/30 space-y-3 rounded-xl border p-4">
            <Label
              htmlFor="brand-kit"
              className="flex items-center gap-2 text-sm font-semibold"
            >
              <Palette className="text-primary size-4" />
              Identidade visual
            </Label>
            <Select
              value={
                changed.brandKitId === null
                  ? "__none__"
                  : (changed.brandKitId ?? "__default__")
              }
              disabled={disabled || kitsLoading}
              onValueChange={chooseKit}
            >
              <SelectTrigger id="brand-kit" className="w-full rounded-lg">
                {kitsLoading ? <span>Carregando kits…</span> : <SelectValue />}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__default__">
                  {brandKits.find((kit) => kit.isDefault)?.name
                    ? "Padrão: " + brandKits.find((kit) => kit.isDefault)!.name
                    : "Padrão Clipfy"}
                </SelectItem>
                <SelectItem value="__none__">
                  Sem identidade personalizada
                </SelectItem>
                {brandKits
                  .filter((kit) => !kit.isDefault)
                  .map((kit) => (
                    <SelectItem key={kit.id} value={kit.id}>
                      {kit.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              {currentKit && (
                <span
                  className="flex -space-x-1"
                  aria-label="Cores da identidade"
                >
                  {[
                    currentKit.colors?.primary,
                    currentKit.colors?.secondary,
                    currentKit.captionStyle.highlightColor ??
                      currentKit.colors?.accent,
                  ]
                    .filter(Boolean)
                    .map((color, index) => (
                      <span
                        key={index}
                        className="border-card size-4 rounded-full border-2"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                </span>
              )}
              <p className="text-muted-foreground text-[11px]">
                {currentKit
                  ? (currentKit.captionStyle.fontName ??
                    currentKit.fontFamily ??
                    "Fonte do estilo escolhido")
                  : "Cores e fonte do estilo escolhido"}
              </p>
            </div>
          </div>
          <section
            aria-labelledby="new-project-intro-heading"
            className="space-y-3"
          >
            <div>
              <h3
                id="new-project-intro-heading"
                className="text-sm font-semibold"
              >
                Título de abertura
              </h3>
              <p className="text-muted-foreground mt-1 text-[11px] leading-relaxed">
                {intro.fromKit && currentKit
                  ? "Começa com o padrão da identidade " + currentKit.name + "."
                  : "Começa com o padrão Clipfy."}{" "}
                Vale para todos os cortes deste projeto; depois, dá para ajustar
                cada um no editor.
              </p>
            </div>
            <IntroTitleControls
              idPrefix={introIdPrefix}
              density="compact"
              value={intro.value}
              look={introLook}
              brandColors={currentKit?.colors}
              baseline={intro.baseline}
              issues={intro.issues}
              inherited={intro.inherited}
              disabled={disabled}
              onChange={intro.onChange}
            />
          </section>
          <div className="flex items-start gap-4">
            <div className="w-24 shrink-0 space-y-2">
              <Label htmlFor="clip-count" className="text-xs">
                Máximo de clipes
              </Label>
              <Input
                id="clip-count"
                type="number"
                min={1}
                max={30}
                disabled={disabled}
                aria-describedby="clip-count-help"
                aria-invalid={
                  !parsed.success &&
                  parsed.error.issues.some(
                    (issue) => issue.path[0] === "clipCount",
                  )
                }
                value={options.clipCount}
                onChange={(event) =>
                  update("clipCount", Number(event.target.value))
                }
                className="rounded-lg"
              />
            </div>
            <p
              id="clip-count-help"
              className="text-muted-foreground pt-7 text-[11px] leading-relaxed"
            >
              De 1 a 30. A quantidade final depende dos momentos encontrados no
              vídeo.
            </p>
          </div>
        </div>
        <div
          ref={previewRef}
          tabIndex={-1}
          className="mx-auto w-full max-w-sm scroll-mt-4 outline-none md:sticky md:top-0"
        >
          <ClipPreviewPlayer
            kit={currentKit ?? undefined}
            template={previewTemplate}
            watermark={watermark}
            captionsEnabled={options.captionsEnabled}
            aspectRatios={options.aspectRatios}
            introTitle={intro.value}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 w-full md:hidden"
            onClick={() => {
              preferencesRef.current?.scrollIntoView({
                block: "start",
                behavior: "instant",
              });
              document
                .getElementById("captions-enabled")
                ?.focus({ preventScroll: true });
            }}
          >
            Voltar às preferências
          </Button>
        </div>
      </div>
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring flex w-full items-center gap-2 rounded-lg py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
        onClick={() => setAdvanced(!advanced)}
        aria-expanded={advanced}
        aria-controls="project-advanced-options"
      >
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        Opções avançadas
        <span className="ml-auto hidden text-xs sm:inline">
          Duração, idioma e enquadramento
        </span>
        <CaretDown
          className={
            "size-4 transition-transform " + (advanced ? "rotate-180" : "")
          }
          aria-hidden="true"
        />
      </button>
      {advanced && (
        <div
          id="project-advanced-options"
          className="bg-background/50 space-y-4 rounded-xl border p-4"
        >
          <fieldset className="space-y-2" aria-describedby="duration-help">
            <legend className="text-sm font-medium">
              Duração ideal dos clipes
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="min-duration">De (segundos)</Label>
                <Input
                  id="min-duration"
                  type="number"
                  min={15}
                  max={60}
                  disabled={disabled}
                  aria-describedby="duration-help"
                  aria-invalid={
                    !parsed.success &&
                    parsed.error.issues.some(
                      (issue) => issue.path[0] === "minDurationMs",
                    )
                  }
                  value={options.minDurationMs / 1000}
                  onChange={(e) =>
                    update("minDurationMs", Number(e.target.value) * 1000)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-duration">Até (segundos)</Label>
                <Input
                  id="max-duration"
                  type="number"
                  min={30}
                  max={180}
                  disabled={disabled}
                  aria-describedby="duration-help"
                  aria-invalid={
                    !parsed.success &&
                    parsed.error.issues.some(
                      (issue) => issue.path[0] === "maxDurationMs",
                    )
                  }
                  value={options.maxDurationMs / 1000}
                  onChange={(e) =>
                    update("maxDurationMs", Number(e.target.value) * 1000)
                  }
                />
              </div>
            </div>
            <p
              id="duration-help"
              className="text-muted-foreground text-xs leading-relaxed"
            >
              O intervalo é uma preferência, com pelo menos 10 segundos entre os
              limites. Para preservar uma ideia, um clipe pode ficar mais curto
              ou chegar a 3 minutos.
            </p>
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="language">Idioma do vídeo</Label>
              <Select
                value={options.language}
                disabled={disabled}
                onValueChange={(v) =>
                  update("language", v as ProjectOptions["language"])
                }
              >
                <SelectTrigger id="language" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pt">Português</SelectItem>
                  <SelectItem value="en">Inglês</SelectItem>
                  <SelectItem value="es">Espanhol</SelectItem>
                  <SelectItem value="auto">Automático</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="layout">Enquadramento</Label>
              <Select
                value={options.layout}
                disabled={disabled}
                onValueChange={(v) =>
                  update("layout", v as ProjectOptions["layout"])
                }
              >
                <SelectTrigger id="layout" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    Object.entries(layoutLabels) as [
                      ProjectOptions["layout"],
                      string,
                    ][]
                  ).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="term">Palavras-chave</Label>
            <div className="flex gap-2">
              <Input
                id="term"
                disabled={disabled || options.keyterms.length >= 100}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addTerm();
                  }
                }}
                maxLength={50}
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Nomes, marcas ou termos do vídeo"
              />
              <Button
                type="button"
                variant="outline"
                disabled={
                  disabled || !term.trim() || options.keyterms.length >= 100
                }
                onClick={addTerm}
              >
                Adicionar
              </Button>
            </div>
            {options.keyterms.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {options.keyterms.map((value, index) => (
                  <button
                    type="button"
                    key={index}
                    disabled={disabled}
                    aria-label={"Remover palavra-chave " + value}
                    className="bg-primary/10 focus-visible:ring-ring rounded-full px-3 py-1.5 text-xs focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
                    onClick={() =>
                      update(
                        "keyterms",
                        options.keyterms.filter((_, i) => i !== index),
                      )
                    }
                  >
                    {value} ×
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
