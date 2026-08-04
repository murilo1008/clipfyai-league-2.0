"use client";

import * as React from "react";
import { useUser } from "@clerk/nextjs";
import {
  Bell,
  CalendarBlank,
  Camera,
  CircleNotch,
  DeviceMobile,
  DiscordLogo,
  EnvelopeSimple,
  Eye,
  EyeSlash,
  FloppyDisk,
  Info,
  LockKey,
  PencilSimple,
  PixLogo,
  SealCheck,
  ShieldCheck,
  User,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { toast } from "sonner";

import { ProfileHeroViz, ProfileHeroVizSkeleton } from "@/components/settings/profile-hero-viz";
import { DarkScope } from "@/components/shared/dark-scope";
import { Reveal } from "@/components/shared/reveal";
import { Bone, HeroSkeleton } from "@/components/shared/skeletons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  PIX_KEY_TYPE_OPTIONS,
  inferPixKeyType,
  normalizePixKeyForType,
  pixKeyPlaceholder,
  type PixKeyType,
} from "@/lib/pix-key";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

/** Blurple do Discord. */
const DISCORD = "#5865F2";

/** Rótulo legível do tipo da chave PIX. */
const pixKeyTypeLabel = (type: PixKeyType) =>
  PIX_KEY_TYPE_OPTIONS.find((option) => option.value === type)?.label ??
  "Chave";

// ============================================================================
// Peças de layout
// ============================================================================

/** Chip informativo do hero (valores textuais — o perfil não tem métricas). */
function HeroChip({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-background/60 flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_18%,transparent)] backdrop-blur-sm">
      <span className="bg-gradient-custom flex size-7 shrink-0 items-center justify-center rounded-lg text-[#04222A]">
        {icon}
      </span>
      <div className="flex flex-col leading-tight">
        <span className="text-foreground text-sm font-semibold">{value}</span>
        <span className="text-muted-foreground text-[10px] font-semibold tracking-[0.12em] uppercase">
          {label}
        </span>
      </div>
    </div>
  );
}

/** Card de seção: glow decorativo, ícone acentuado, título/descrição e ação. */
function SectionCard({
  glow,
  icon,
  iconClass,
  title,
  description,
  action,
  children,
}: {
  glow: string;
  icon: React.ReactNode;
  iconClass: string;
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-card relative overflow-hidden rounded-3xl p-4 sm:p-6">
      <span
        aria-hidden
        className="pointer-events-none absolute -top-14 -right-14 size-44 rounded-full blur-3xl"
        style={{ background: glow }}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-xl",
              iconClass,
            )}
          >
            {icon}
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-bold tracking-tight sm:text-lg">
              {title}
            </h2>
            <p className="text-muted-foreground text-xs sm:text-sm">
              {description}
            </p>
          </div>
        </div>
        {action}
      </div>
      <div className="relative mt-4 sm:mt-5">{children}</div>
    </div>
  );
}

/** Linha de leitura (ícone acentuado + rótulo + valor). */
function InfoRow({
  icon,
  iconClass,
  label,
  value,
  mono = false,
}: {
  icon: React.ReactNode;
  iconClass: string;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="border-border/60 bg-muted/20 flex items-center gap-3 rounded-2xl border p-3 sm:p-4">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-xl",
          iconClass,
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold sm:text-sm">{label}</p>
        <p
          className={cn(
            "text-muted-foreground truncate text-xs sm:text-sm",
            mono && "font-mono",
          )}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

/** Campo de senha com botão de olho. */
function PasswordField({
  id,
  label,
  placeholder,
  value,
  onChange,
  show,
  onToggleShow,
  disabled,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  onToggleShow: () => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-xs sm:text-sm">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          required
          className="h-10 rounded-xl pr-10"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={onToggleShow}
          aria-label={show ? "Ocultar senha" : "Mostrar senha"}
          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer transition-colors"
        >
          {show ? <EyeSlash className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  );
}

/** Linha de preferência de notificação com Switch. */
function NotificationRow({
  icon,
  iconClass,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  icon: React.ReactNode;
  iconClass: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="border-border/60 bg-muted/20 flex items-center justify-between gap-3 rounded-2xl border p-3 sm:p-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl",
            iconClass,
          )}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold sm:text-sm">{label}</p>
          <p className="text-muted-foreground text-xs">{description}</p>
        </div>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="cursor-pointer"
      />
    </div>
  );
}

/** Linha das estatísticas rápidas do card de perfil. */
function QuickStatRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="border-border/60 bg-muted/20 flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-3">
      <span className="text-muted-foreground inline-flex items-center gap-2 text-xs sm:text-sm">
        {icon}
        {label}
      </span>
      <span className="text-xs font-semibold sm:text-sm">{value}</span>
    </div>
  );
}

/** Fantasma de um card de seção (header + duas linhas). */
function SectionCardSkeleton({ delay }: { delay: number }) {
  return (
    <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Bone delay={delay} className="size-9 rounded-xl" />
        <div className="flex flex-col gap-1.5">
          <Bone delay={delay + 60} className="h-4 w-40" />
          <Bone delay={delay + 120} className="h-3 w-52 rounded-full" />
        </div>
      </div>
      <Bone delay={delay + 180} className="h-14 w-full rounded-2xl" />
      <Bone delay={delay + 240} className="h-14 w-full rounded-2xl" />
    </div>
  );
}

/** Skeleton completo da página espelhando o layout real. */
function ProfilePageSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      <HeroSkeleton stats={3} viz={<ProfileHeroVizSkeleton />} />
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
        <div className="glass-card flex flex-col items-center gap-4 self-start rounded-3xl p-5 sm:p-6">
          <Bone className="size-24 rounded-full sm:size-32" />
          <Bone delay={80} className="h-4 w-36" />
          <Bone delay={160} className="h-3 w-44 rounded-full" />
          <Bone delay={240} className="h-[22px] w-24 rounded-full" />
          <div className="mt-2 flex w-full flex-col gap-2.5">
            <Bone delay={300} className="h-12 w-full rounded-2xl" />
            <Bone delay={380} className="h-12 w-full rounded-2xl" />
          </div>
        </div>
        <div className="flex flex-col gap-4 sm:gap-6 lg:col-span-2">
          {[0, 1, 2].map((index) => (
            <SectionCardSkeleton key={index} delay={index * 140} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Página
// ============================================================================

export default function Profile() {
  const { user, isLoaded } = useUser();
  const utils = api.useUtils();

  // Flags de edição/salvamento
  const [isUploadingImage, setIsUploadingImage] = React.useState(false);
  const [isEditingName, setIsEditingName] = React.useState(false);
  const [isSavingName, setIsSavingName] = React.useState(false);
  const [isChangingPassword, setIsChangingPassword] = React.useState(false);
  const [isEditingDiscord, setIsEditingDiscord] = React.useState(false);
  const [isEditingPixKey, setIsEditingPixKey] = React.useState(false);

  // Formulários
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [discordUsername, setDiscordUsername] = React.useState("");
  const [discordId, setDiscordId] = React.useState("");
  const [pixKey, setPixKey] = React.useState("");
  const [pixKeyType, setPixKeyType] = React.useState<PixKeyType>("CPF");

  // Visibilidade das senhas
  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  // Preferências de notificação (estado local apenas — o original não
  // persiste; não existe endpoint para isso, então mantemos o mock 1:1)
  const [emailNotifications, setEmailNotifications] = React.useState(true);
  const [pushNotifications, setPushNotifications] = React.useState(true);
  const [smsNotifications, setSmsNotifications] = React.useState(false);

  // Dados do usuário com clipper profile (para o card do Discord)
  const { data: userData } = api.user.getCurrentUser.useQuery(undefined, {
    enabled: isLoaded && !!user,
  });

  const updateProfileImage = api.user.updateProfileImage.useMutation();
  const updateDiscordInfo = api.user.updateDiscordInfo.useMutation();
  const isSavingDiscord = updateDiscordInfo.isPending;
  const updatePixKey = api.user.updatePixKey.useMutation();
  const isSavingPixKey = updatePixKey.isPending;

  // Sincroniza o formulário do Discord quando os dados chegam — mas nunca
  // durante a edição (o original clobberava o que o usuário digitava se a
  // query refetchasse no meio da edição).
  React.useEffect(() => {
    if (isEditingDiscord) return;
    if (userData?.clipperProfile) {
      setDiscordUsername(userData.clipperProfile.discordUsername ?? "");
      setDiscordId(userData.clipperProfile.discordId ?? "");
    }
  }, [userData, isEditingDiscord]);

  // Mesma regra para a chave PIX: nunca sobrescreve o que está sendo digitado.
  React.useEffect(() => {
    if (isEditingPixKey) return;
    if (userData?.clipperProfile) {
      const savedPixKey = userData.clipperProfile.pixKey ?? "";
      setPixKey(savedPixKey);
      setPixKeyType(inferPixKeyType(savedPixKey));
    }
  }, [userData, isEditingPixKey]);

  // O financeiro linka para `/settings/profile#chave-pix`, mas o card só existe
  // depois que a query resolve — no momento em que o browser tenta rolar, a
  // página ainda é skeleton. Rolamos manualmente quando a seção aparece.
  const hasClipperProfile = !!userData?.clipperProfile;
  React.useEffect(() => {
    if (!hasClipperProfile) return;
    if (window.location.hash !== "#chave-pix") return;
    document
      .getElementById("chave-pix")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hasClipperProfile]);

  // ===== Handlers =====

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    // Permite re-selecionar o mesmo arquivo depois (o original não limpava)
    event.target.value = "";
    if (!file || !user) return;

    setIsUploadingImage(true);
    try {
      // 1. Upload para o Clerk
      await user.setProfileImage({ file });
      // 2. Espera o Clerk processar
      await new Promise((resolve) => setTimeout(resolve, 1000));
      // 3. Recarrega para pegar a nova imageUrl
      await user.reload();
      // 4. Persiste a imageUrl no banco
      if (user.imageUrl) {
        await updateProfileImage.mutateAsync({ imageUrl: user.imageUrl });
        // O original não invalidava getCurrentUser — cache ficava stale
        void utils.user.getCurrentUser.invalidate();
      }
      toast.success("Foto atualizada!", {
        description: "Sua foto de perfil foi alterada com sucesso.",
      });
    } catch {
      toast.error("Erro ao atualizar foto", {
        description: "Não foi possível atualizar sua foto de perfil.",
      });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSaveName = async () => {
    if (!user) return;

    setIsSavingName(true);
    try {
      await user.update({ firstName, lastName });
      toast.success("Nome atualizado!", {
        description: "Suas informações foram alteradas com sucesso.",
      });
      setIsEditingName(false);
    } catch {
      toast.error("Erro ao atualizar", {
        description: "Não foi possível atualizar seu nome.",
      });
    } finally {
      setIsSavingName(false);
    }
  };

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("Senhas não coincidem", {
        description: "A nova senha e a confirmação devem ser iguais.",
      });
      return;
    }

    if (newPassword.length < 8) {
      toast.error("Senha muito curta", {
        description: "A senha deve ter no mínimo 8 caracteres.",
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      await user?.updatePassword({ currentPassword, newPassword });
      toast.success("Senha alterada!", {
        description: "Sua senha foi atualizada com sucesso.",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      toast.error("Erro ao alterar senha", {
        description: "Verifique se a senha atual está correta.",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSaveDiscord = async () => {
    if (!discordUsername.trim()) {
      toast.error("Username do Discord é obrigatório");
      return;
    }

    if (!discordId.trim()) {
      toast.error("ID do Discord é obrigatório");
      return;
    }

    if (!/^\d+$/.test(discordId)) {
      toast.error("ID do Discord inválido", {
        description: "O ID deve conter apenas números",
      });
      return;
    }

    try {
      await updateDiscordInfo.mutateAsync({ discordUsername, discordId });
      toast.success("Discord atualizado!", {
        description: "Suas informações do Discord foram atualizadas.",
      });
      setIsEditingDiscord(false);
      // O original não invalidava — recarregar a página repunha valores stale
      void utils.user.getCurrentUser.invalidate();
    } catch (error) {
      toast.error("Erro ao atualizar Discord", {
        description:
          error instanceof Error && error.message
            ? error.message
            : "Não foi possível atualizar suas informações.",
      });
    }
  };

  const handleSavePixKey = async () => {
    const check = normalizePixKeyForType(pixKey, pixKeyType);
    if (!check.ok) {
      toast.error(check.error);
      return;
    }

    try {
      await updatePixKey.mutateAsync({ pixKey, pixKeyType });
      toast.success("Chave PIX atualizada!", {
        description: "Os prêmios da sua carteira serão pagos nessa chave.",
      });
      setIsEditingPixKey(false);
      void utils.user.getCurrentUser.invalidate();
    } catch (error) {
      toast.error("Erro ao atualizar chave PIX", {
        description:
          error instanceof Error && error.message
            ? error.message
            : "Não foi possível salvar sua chave PIX.",
      });
    }
  };

  // ===== Loading (skeleton do kit no lugar do spinner solto do original) =====
  if (!isLoaded || !user) {
    return <ProfilePageSkeleton />;
  }

  // ===== Derivados =====
  const userName = user.fullName ?? user.firstName ?? "Usuário";
  const userEmail = user.primaryEmailAddress?.emailAddress ?? "";
  const userAvatar = user.imageUrl;
  const userInitials =
    user.firstName?.[0] ?? user.emailAddresses[0]?.emailAddress[0] ?? "U";
  const isEmailVerified =
    user.primaryEmailAddress?.verification.status === "verified";
  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("pt-BR", {
        month: "short",
        year: "numeric",
      })
    : "—";
  const ROLE_LABELS: Record<string, string> = {
    ADMIN: "Admin Clipfy",
    ORGANIZER_ADMIN: "Organizador",
    CLIENT: "Cliente",
    CLIPPER: "Clipador",
  };
  const roleLabel = userData
    ? (ROLE_LABELS[userData.role] ??
      (userData.clipperProfile ? "Clipador" : "—"))
    : "—";

  // Chave PIX: validação em tempo real por tipo (mesma régua do onboarding)
  const savedPixKey = userData?.clipperProfile?.pixKey?.trim() ?? "";
  const trimmedPixKey = pixKey.trim();
  const pixKeyCheck = trimmedPixKey
    ? normalizePixKeyForType(trimmedPixKey, pixKeyType)
    : null;
  const pixKeyError = pixKeyCheck && !pixKeyCheck.ok ? pixKeyCheck.error : null;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      {/* ===== Hero do perfil ===== */}
      <DarkScope className="contents">
        <section className="animate-fade-in-up relative overflow-hidden rounded-3xl bg-[#050f1c] p-6 ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_18%,transparent)] sm:p-8 lg:p-10">
          <span
            aria-hidden
            className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_16%,transparent)] blur-3xl"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -left-10 size-72 rounded-full bg-[color-mix(in_oklab,var(--brand-green)_12%,transparent)] blur-3xl"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-[color-mix(in_oklab,var(--brand-cyan)_60%,transparent)] via-[color-mix(in_oklab,var(--brand-mint)_40%,transparent)] to-transparent"
          />

          <ProfileHeroViz />

          <div className="relative z-10 flex max-w-2xl flex-col gap-4">
            <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.18em] uppercase">
              <span className="bg-gradient-custom size-1.5 rounded-full" />
              Clipfy League · Perfil
            </span>

            <h1 className="text-foreground text-3xl leading-tight font-bold tracking-tight sm:text-4xl lg:text-[2.75rem]">
              Meu <span className="text-gradient">Perfil</span>
            </h1>

            <p className="text-muted-foreground max-w-xl text-sm leading-relaxed sm:text-base">
              Gerencie suas informações pessoais e configurações
            </p>

            <div className="mt-2 flex flex-wrap gap-2.5">
              <HeroChip
                icon={<CalendarBlank className="size-3.5" weight="fill" />}
                label="Membro desde"
                value={memberSince}
              />
              {isEmailVerified && (
                <HeroChip
                  icon={<SealCheck className="size-3.5" weight="fill" />}
                  label="Email"
                  value="Verificado"
                />
              )}
              {userData?.clipperProfile && (
                <HeroChip
                  icon={<User className="size-3.5" weight="fill" />}
                  label="Função"
                  value="Clipador"
                />
              )}
            </div>
          </div>
        </section>
      </DarkScope>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
        {/* ===== Card de identidade (esquerda) ===== */}
        <Reveal immediate className="lg:col-span-1">
          <div className="glass-card relative overflow-hidden rounded-3xl p-5 sm:p-6">
            <span
              aria-hidden
              className="pointer-events-none absolute -top-14 -right-14 size-44 rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_12%,transparent)] blur-3xl"
            />
            <div className="relative flex flex-col items-center gap-4 text-center">
              {/* Avatar com upload no hover */}
              <div className="group relative">
                <Avatar className="border-background size-24 border-4 shadow-xl sm:size-32">
                  <AvatarImage src={userAvatar} alt={userName} />
                  <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold sm:text-3xl">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <label
                  htmlFor="avatar-upload"
                  className={cn(
                    "absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/60 opacity-0 transition-opacity group-hover:opacity-100",
                    isUploadingImage && "cursor-wait opacity-100",
                  )}
                >
                  {isUploadingImage ? (
                    <CircleNotch className="size-7 animate-spin text-white sm:size-8" />
                  ) : (
                    <Camera
                      className="size-7 text-white sm:size-8"
                      weight="fill"
                    />
                  )}
                </label>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void handleImageUpload(e)}
                  disabled={isUploadingImage}
                />
              </div>

              <div className="space-y-1.5">
                <h2 className="text-lg font-bold tracking-tight sm:text-xl">
                  {userName}
                </h2>
                <p className="text-muted-foreground text-xs break-all sm:text-sm">
                  {userEmail}
                </p>
                {isEmailVerified && (
                  <Badge
                    variant="outline"
                    className="gap-1 rounded-full border-emerald-500/30 bg-emerald-500/15 font-semibold text-emerald-600 dark:text-emerald-400"
                  >
                    <SealCheck className="size-3" weight="fill" />
                    Verificado
                  </Badge>
                )}
              </div>
            </div>

            <Separator className="my-4 sm:my-6" />

            {/* Estatísticas rápidas — só dados reais (o original mostrava
                "2 dispositivos" e "Brasil" hard-coded) */}
            <div className="relative flex flex-col gap-2.5">
              <QuickStatRow
                icon={<CalendarBlank className="size-4" />}
                label="Membro desde"
                value={memberSince}
              />
              <QuickStatRow
                icon={<User className="size-4" />}
                label="Função"
                value={roleLabel}
              />
            </div>
          </div>
        </Reveal>

        {/* ===== Coluna direita ===== */}
        <div className="flex flex-col gap-4 sm:gap-6 lg:col-span-2">
          {/* Informações Pessoais */}
          <Reveal immediate delayMs={60}>
            <SectionCard
              glow="radial-gradient(circle, color-mix(in oklab, var(--brand-cyan) 14%, transparent), transparent 70%)"
              icon={<User className="size-4.5" weight="fill" />}
              iconClass="bg-brand-cyan/15 text-brand-cyan not-dark:bg-primary/10 not-dark:text-primary"
              title="Informações Pessoais"
              description="Atualize seus dados pessoais"
              action={
                !isEditingName ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFirstName(user.firstName ?? "");
                      setLastName(user.lastName ?? "");
                      setIsEditingName(true);
                    }}
                    className="h-8 shrink-0 cursor-pointer rounded-xl sm:h-9"
                  >
                    <PencilSimple className="size-4" />
                    <span className="hidden sm:inline">Editar</span>
                  </Button>
                ) : null
              }
            >
              {isEditingName ? (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="text-xs sm:text-sm">
                        Primeiro Nome
                      </Label>
                      <Input
                        id="firstName"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Digite seu primeiro nome"
                        disabled={isSavingName}
                        className="h-10 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName" className="text-xs sm:text-sm">
                        Sobrenome
                      </Label>
                      <Input
                        id="lastName"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Digite seu sobrenome"
                        disabled={isSavingName}
                        className="h-10 rounded-xl"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => void handleSaveName()}
                      disabled={isSavingName || (!firstName && !lastName)}
                      className="btn-gradient-auth h-9 flex-1 cursor-pointer rounded-xl font-semibold sm:h-10 sm:flex-initial"
                    >
                      {isSavingName ? (
                        <>
                          <CircleNotch className="size-4 animate-spin" />
                          <span className="hidden sm:inline">Salvando...</span>
                        </>
                      ) : (
                        <>
                          <FloppyDisk className="size-4" />
                          <span className="hidden sm:inline">Salvar</span>
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditingName(false)}
                      disabled={isSavingName}
                      className="h-9 cursor-pointer rounded-xl sm:h-10"
                    >
                      <X className="size-4" />
                      <span className="hidden sm:inline">Cancelar</span>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-2.5 sm:gap-3">
                  <InfoRow
                    icon={<User className="size-4.5" weight="fill" />}
                    iconClass="bg-brand-cyan/15 text-brand-cyan not-dark:bg-primary/10 not-dark:text-primary"
                    label="Nome Completo"
                    value={userName}
                  />
                  <InfoRow
                    icon={<EnvelopeSimple className="size-4.5" weight="fill" />}
                    iconClass="bg-brand-mint/15 text-brand-mint not-dark:bg-primary/10 not-dark:text-primary"
                    label="Email"
                    value={userEmail}
                  />
                </div>
              )}
            </SectionCard>
          </Reveal>

          {/* Discord — apenas clipadores */}
          {userData?.clipperProfile && (
            <Reveal immediate delayMs={120}>
              <SectionCard
                glow={`radial-gradient(circle, color-mix(in oklab, ${DISCORD} 18%, transparent), transparent 70%)`}
                icon={
                  <DiscordLogo
                    className="size-4.5"
                    style={{ color: DISCORD }}
                    weight="fill"
                  />
                }
                iconClass="bg-[#5865F2]/15"
                title="Discord"
                description="Suas informações do Discord"
                action={
                  !isEditingDiscord ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditingDiscord(true)}
                      className="h-8 shrink-0 cursor-pointer rounded-xl sm:h-9"
                    >
                      <PencilSimple className="size-4" />
                      <span className="hidden sm:inline">Editar</span>
                    </Button>
                  ) : null
                }
              >
                {isEditingDiscord ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label
                        htmlFor="discordUsername"
                        className="text-xs sm:text-sm"
                      >
                        Username do Discord{" "}
                        <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="discordUsername"
                        value={discordUsername}
                        onChange={(e) => setDiscordUsername(e.target.value)}
                        placeholder="exemplo#1234 ou @exemplo"
                        disabled={isSavingDiscord}
                        className="h-10 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="discordId" className="text-xs sm:text-sm">
                        ID do Discord{" "}
                        <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="discordId"
                        value={discordId}
                        onChange={(e) => setDiscordId(e.target.value)}
                        placeholder="123456789012345678"
                        disabled={isSavingDiscord}
                        className="h-10 rounded-xl font-mono"
                      />
                      <p className="text-muted-foreground text-xs">
                        Apenas números. Para encontrar seu ID, vá em
                        Configurações {">"} Avançado {">"} Ativar Modo
                        Desenvolvedor, depois clique com o botão direito no seu
                        nome e selecione &quot;Copiar ID&quot;.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => void handleSaveDiscord()}
                        disabled={
                          isSavingDiscord || !discordUsername || !discordId
                        }
                        className="btn-gradient-auth h-9 flex-1 cursor-pointer rounded-xl font-semibold sm:h-10 sm:flex-initial"
                      >
                        {isSavingDiscord ? (
                          <>
                            <CircleNotch className="size-4 animate-spin" />
                            <span className="hidden sm:inline">
                              Salvando...
                            </span>
                          </>
                        ) : (
                          <>
                            <FloppyDisk className="size-4" />
                            <span className="hidden sm:inline">Salvar</span>
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsEditingDiscord(false);
                          // Restaura os valores originais
                          if (userData.clipperProfile) {
                            setDiscordUsername(
                              userData.clipperProfile.discordUsername ?? "",
                            );
                            setDiscordId(
                              userData.clipperProfile.discordId ?? "",
                            );
                          }
                        }}
                        disabled={isSavingDiscord}
                        className="h-9 cursor-pointer rounded-xl sm:h-10"
                      >
                        <X className="size-4" />
                        <span className="hidden sm:inline">Cancelar</span>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-2.5 sm:gap-3">
                    <InfoRow
                      icon={
                        <User
                          className="size-4.5"
                          style={{ color: DISCORD }}
                          weight="fill"
                        />
                      }
                      iconClass="bg-[#5865F2]/15"
                      label="Username"
                      value={discordUsername || "Não configurado"}
                    />
                    <InfoRow
                      icon={
                        <ShieldCheck
                          className="size-4.5"
                          style={{ color: DISCORD }}
                          weight="fill"
                        />
                      }
                      iconClass="bg-[#5865F2]/15"
                      label="ID do Discord"
                      value={discordId || "Não configurado"}
                      mono
                    />
                    <div className="flex items-center gap-2.5 rounded-2xl border border-[#5865F2]/25 bg-[#5865F2]/8 p-3">
                      <Info
                        className="size-4 shrink-0"
                        style={{ color: DISCORD }}
                        weight="fill"
                      />
                      <p className="text-muted-foreground text-xs">
                        Essas informações são usadas para comunicação da
                        comunidade
                      </p>
                    </div>
                  </div>
                )}
              </SectionCard>
            </Reveal>
          )}

          {/* Chave PIX — apenas clipadores (destino dos pagamentos) */}
          {userData?.clipperProfile && (
            <Reveal immediate delayMs={150}>
              <div id="chave-pix" className="scroll-mt-24">
                <SectionCard
                  glow="radial-gradient(circle, color-mix(in oklab, #14b8a6 16%, transparent), transparent 70%)"
                  icon={<PixLogo className="size-4.5" weight="fill" />}
                  iconClass="bg-teal-500/15 text-teal-600 dark:text-teal-400"
                  title="Chave PIX"
                  description="Destino dos pagamentos da sua carteira"
                  action={
                    !isEditingPixKey ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditingPixKey(true)}
                        className="h-8 shrink-0 cursor-pointer rounded-xl sm:h-9"
                      >
                        <PencilSimple className="size-4" />
                        <span className="hidden sm:inline">
                          {savedPixKey ? "Editar" : "Cadastrar"}
                        </span>
                      </Button>
                    ) : null
                  }
                >
                  {isEditingPixKey ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="pixKey" className="text-xs sm:text-sm">
                          Chave PIX <span className="text-destructive">*</span>
                        </Label>
                        <div className="flex flex-col gap-2 sm:grid sm:grid-cols-[9.5rem_1fr]">
                          <Select
                            value={pixKeyType}
                            onValueChange={(value) =>
                              setPixKeyType(value as PixKeyType)
                            }
                          >
                            <SelectTrigger
                              aria-label="Tipo da chave PIX"
                              className="w-full cursor-pointer rounded-xl data-[size=default]:h-10"
                            >
                              <SelectValue placeholder="Tipo" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                              {PIX_KEY_TYPE_OPTIONS.map((option) => (
                                <SelectItem
                                  key={option.value}
                                  value={option.value}
                                  className="cursor-pointer"
                                >
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            id="pixKey"
                            value={pixKey}
                            onChange={(e) => setPixKey(e.target.value)}
                            placeholder={pixKeyPlaceholder(pixKeyType)}
                            autoComplete="off"
                            spellCheck={false}
                            disabled={isSavingPixKey}
                            aria-invalid={!!pixKeyError}
                            aria-describedby={
                              pixKeyError ? "pixKey-error" : "pixKey-hint"
                            }
                            className={cn(
                              "h-10 min-w-0 rounded-xl",
                              pixKeyError && "border-destructive/60",
                            )}
                          />
                        </div>
                        {pixKeyError ? (
                          <p
                            id="pixKey-error"
                            role="alert"
                            className="text-destructive flex items-start gap-1.5 text-xs"
                          >
                            <WarningCircle
                              aria-hidden
                              className="mt-px size-3.5 shrink-0"
                              weight="fill"
                            />
                            <span className="min-w-0">{pixKeyError}</span>
                          </p>
                        ) : (
                          <p
                            id="pixKey-hint"
                            className="text-muted-foreground text-xs"
                          >
                            A chave é normalizada ao salvar (telefone com +55,
                            e-mail em minúsculas). Confira antes de salvar: os
                            prêmios são pagos exatamente nessa chave.
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => void handleSavePixKey()}
                          disabled={
                            isSavingPixKey || !trimmedPixKey || !!pixKeyError
                          }
                          className="btn-gradient-auth h-9 flex-1 cursor-pointer rounded-xl font-semibold sm:h-10 sm:flex-initial"
                        >
                          {isSavingPixKey ? (
                            <>
                              <CircleNotch className="size-4 animate-spin" />
                              <span className="hidden sm:inline">
                                Salvando...
                              </span>
                            </>
                          ) : (
                            <>
                              <FloppyDisk className="size-4" />
                              <span className="hidden sm:inline">Salvar</span>
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setIsEditingPixKey(false);
                            setPixKey(savedPixKey);
                            setPixKeyType(inferPixKeyType(savedPixKey));
                          }}
                          disabled={isSavingPixKey}
                          className="h-9 cursor-pointer rounded-xl sm:h-10"
                        >
                          <X className="size-4" />
                          <span className="hidden sm:inline">Cancelar</span>
                        </Button>
                      </div>
                    </div>
                  ) : savedPixKey ? (
                    <div className="grid gap-2.5 sm:gap-3">
                      <InfoRow
                        icon={<PixLogo className="size-4.5" weight="fill" />}
                        iconClass="bg-teal-500/15 text-teal-600 dark:text-teal-400"
                        label={pixKeyTypeLabel(inferPixKeyType(savedPixKey))}
                        value={savedPixKey}
                        mono
                      />
                      <div className="flex items-center gap-2.5 rounded-2xl border border-teal-500/25 bg-teal-500/8 p-3">
                        <Info
                          className="size-4 shrink-0 text-teal-600 dark:text-teal-400"
                          weight="fill"
                        />
                        <p className="text-muted-foreground text-xs">
                          Os prêmios da sua carteira são pagos nessa chave
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/5 p-3 sm:p-4">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15">
                        <WarningCircle
                          className="size-4.5 text-amber-600 dark:text-amber-400"
                          weight="fill"
                        />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold sm:text-sm">
                          Nenhuma chave PIX cadastrada
                        </p>
                        <p className="text-muted-foreground text-xs">
                          Sem chave PIX não é possível receber os prêmios da
                          carteira.
                        </p>
                      </div>
                    </div>
                  )}
                </SectionCard>
              </div>
            </Reveal>
          )}

          {/* Segurança */}
          <Reveal immediate delayMs={180}>
            <SectionCard
              glow="radial-gradient(circle, color-mix(in oklab, #f97316 14%, transparent), transparent 70%)"
              icon={<LockKey className="size-4.5" weight="fill" />}
              iconClass="bg-orange-500/15 text-orange-500"
              title="Segurança"
              description="Altere sua senha de acesso"
            >
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handlePasswordChange();
                }}
                className="space-y-3 sm:space-y-4"
              >
                <PasswordField
                  id="current-password"
                  label="Senha Atual"
                  placeholder="Digite sua senha atual"
                  value={currentPassword}
                  onChange={setCurrentPassword}
                  show={showCurrentPassword}
                  onToggleShow={() =>
                    setShowCurrentPassword(!showCurrentPassword)
                  }
                  disabled={isChangingPassword}
                />

                <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                  <PasswordField
                    id="new-password"
                    label="Nova Senha"
                    placeholder="Mín. 8 caracteres"
                    value={newPassword}
                    onChange={setNewPassword}
                    show={showNewPassword}
                    onToggleShow={() => setShowNewPassword(!showNewPassword)}
                    disabled={isChangingPassword}
                  />
                  <PasswordField
                    id="confirm-password"
                    label="Confirmar Senha"
                    placeholder="Confirme a senha"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    show={showConfirmPassword}
                    onToggleShow={() =>
                      setShowConfirmPassword(!showConfirmPassword)
                    }
                    disabled={isChangingPassword}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={
                    isChangingPassword ||
                    !currentPassword ||
                    !newPassword ||
                    !confirmPassword
                  }
                  className="btn-gradient-auth h-10 w-full cursor-pointer rounded-xl font-semibold"
                >
                  {isChangingPassword ? (
                    <>
                      <CircleNotch className="size-4 animate-spin" />
                      Alterando...
                    </>
                  ) : (
                    <>
                      <LockKey className="size-4" weight="fill" />
                      Alterar Senha
                    </>
                  )}
                </Button>
              </form>
            </SectionCard>
          </Reveal>

          {/* Notificações */}
          <Reveal immediate delayMs={240}>
            <SectionCard
              glow="radial-gradient(circle, color-mix(in oklab, #3b82f6 14%, transparent), transparent 70%)"
              icon={<Bell className="size-4.5" weight="fill" />}
              iconClass="bg-blue-500/15 text-blue-500 dark:text-blue-400"
              title="Notificações"
              description="Gerencie como você recebe notificações"
            >
              <div className="flex flex-col gap-2.5 sm:gap-3">
                <NotificationRow
                  icon={<EnvelopeSimple className="size-4.5" weight="fill" />}
                  iconClass="bg-brand-cyan/15 text-brand-cyan not-dark:bg-primary/10 not-dark:text-primary"
                  label="Email"
                  description="Receba notificações por email"
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                />
                <NotificationRow
                  icon={<Bell className="size-4.5" weight="fill" />}
                  iconClass="bg-brand-mint/15 text-brand-mint not-dark:bg-primary/10 not-dark:text-primary"
                  label="Push"
                  description="Notificações no navegador"
                  checked={pushNotifications}
                  onCheckedChange={setPushNotifications}
                />
                <NotificationRow
                  icon={<DeviceMobile className="size-4.5" weight="fill" />}
                  iconClass="bg-orange-500/15 text-orange-500"
                  label="SMS"
                  description="Alertas por mensagem de texto"
                  checked={smsNotifications}
                  onCheckedChange={setSmsNotifications}
                />
              </div>
            </SectionCard>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
