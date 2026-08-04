"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { useSignIn } from "@clerk/nextjs"
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  CircleNotch,
  EnvelopeSimple,
  Eye,
  EyeSlash,
  Key,
  LockSimple,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { DashboardBackground } from "@/components/dashboard-background"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type Step = "email" | "code" | "success"

export default function ForgotPassword() {
  const { isLoaded, signIn } = useSignIn()
  const router = useRouter()

  const [step, setStep] = React.useState<Step>("email")
  const [email, setEmail] = React.useState("")
  const [code, setCode] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [showPassword, setShowPassword] = React.useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)

  type ClerkError = {
    errors?: Array<{ code?: string; message?: string }>
  }

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isLoaded) return

    if (!email.trim()) {
      toast.error("Email é obrigatório", {
        description: "Por favor, insira seu endereço de email",
        duration: 4000,
      })
      return
    }

    setIsLoading(true)

    try {
      await signIn.create({
        strategy: "reset_password_email_code",
        identifier: email,
      })
      toast.success("Código enviado!", {
        description: "Verifique seu email para o código de verificação",
        duration: 5000,
      })
      setStep("code")
    } catch (err: unknown) {
      const clerkError = (err as ClerkError).errors?.[0]
      if (clerkError) {
        if (clerkError.code === "form_identifier_not_found") {
          toast.error("Email não encontrado", {
            description: "Nenhuma conta encontrada com este email",
            duration: 5000,
          })
        } else if (clerkError.code === "form_param_format_invalid") {
          toast.error("Email inválido", {
            description: "Por favor, insira um email válido",
            duration: 4000,
          })
        } else {
          toast.error("Erro ao enviar código", {
            description:
              clerkError.message ??
              "Não foi possível enviar o código. Tente novamente",
            duration: 5000,
          })
        }
      } else {
        toast.error("Erro ao enviar código", {
          description: "Algo deu errado. Tente novamente",
          duration: 4000,
        })
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isLoaded) return

    if (!code.trim()) {
      toast.error("Código é obrigatório", {
        description: "Por favor, insira o código recebido no email",
        duration: 4000,
      })
      return
    }

    if (password.length < 8) {
      toast.error("Senha muito curta", {
        description: "A senha deve ter pelo menos 8 caracteres",
        duration: 4000,
      })
      return
    }

    if (password !== confirmPassword) {
      toast.error("Senhas não coincidem", {
        description: "As senhas devem ser iguais",
        duration: 4000,
      })
      return
    }

    setIsLoading(true)

    try {
      const result = await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code: code,
        password: password,
      })

      if (result.status === "complete") {
        toast.success("🎉 Senha alterada com sucesso!", {
          description: "Sua senha foi redefinida. Redirecionando...",
          duration: 5000,
        })
        setStep("success")
        setTimeout(() => {
          router.push("/sign-in")
        }, 2000)
      } else {
        toast.error("Processo incompleto", {
          description: "Algo deu errado. Tente novamente",
          duration: 4000,
        })
      }
    } catch (err: unknown) {
      const clerkError = (err as ClerkError).errors?.[0]
      if (clerkError) {
        switch (clerkError.code) {
          case "form_code_incorrect":
            toast.error("Código incorreto", {
              description:
                "O código informado está incorreto. Verifique e tente novamente",
              duration: 5000,
            })
            break
          case "form_password_pwned":
            toast.error("Senha comprometida", {
              description:
                "Esta senha foi encontrada em vazamentos de dados. Escolha outra",
              duration: 6000,
            })
            break
          case "form_password_length_too_short":
            toast.error("Senha muito curta", {
              description: "A senha deve ter pelo menos 8 caracteres",
              duration: 4000,
            })
            break
          case "form_password_not_strong_enough":
            toast.error("Senha fraca", {
              description: "Use uma combinação de letras, números e símbolos",
              duration: 5000,
            })
            break
          case "verification_expired":
            toast.error("Código expirado", {
              description: "O código expirou. Solicite um novo código",
              duration: 5000,
            })
            setStep("email")
            break
          default:
            toast.error("Erro ao alterar senha", {
              description:
                clerkError.message ??
                "Não foi possível alterar a senha. Tente novamente",
              duration: 5000,
            })
        }
      } else {
        toast.error("Erro ao alterar senha", {
          description: "Algo deu errado. Tente novamente",
          duration: 4000,
        })
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleBack = () => {
    setStep("email")
    setCode("")
    setPassword("")
    setConfirmPassword("")
  }

  const headerIcon =
    step === "email" ? (
      <EnvelopeSimple className="size-6 text-[#04222A]" weight="bold" />
    ) : step === "code" ? (
      <Key className="size-6 text-[#04222A]" weight="bold" />
    ) : (
      <CheckCircle className="size-6 text-[#04222A]" weight="bold" />
    )

  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-4 py-10">
      <DashboardBackground />

      <div className="animate-fade-in-up flex w-full max-w-md flex-col items-center">
        <Link href="/" aria-label="Clipfy League">
          <Logo
            width={160}
            height={40}
            className="h-10 w-auto dark:drop-shadow-[0_0_24px_rgba(20,247,254,0.3)]"
          />
        </Link>

        <div className="glass-card mt-8 w-full rounded-3xl p-6 sm:p-8">
          {/* Ícone do passo */}
          <div className="mb-5 flex justify-center">
            <span
              className={cn(
                "bg-gradient-custom flex size-13 items-center justify-center rounded-2xl shadow-[0_8px_30px_-8px_rgba(20,247,254,0.5)]",
                step === "success" && "animate-glow",
              )}
            >
              {headerIcon}
            </span>
          </div>

          {/* Indicador de passos */}
          {step !== "success" && (
            <div className="mb-6 flex items-center justify-center gap-2">
              <span
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  step === "email" ? "bg-gradient-custom w-8" : "bg-border w-1.5",
                )}
              />
              <span
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  step === "code" ? "bg-gradient-custom w-8" : "bg-border w-1.5",
                )}
              />
            </div>
          )}

          {step === "email" && (
            <>
              <div className="mb-7 text-center">
                <h1 className="text-2xl font-bold tracking-tight">
                  Esqueceu a <span className="text-gradient">senha?</span>
                </h1>
                <p className="text-muted-foreground mt-1.5 text-sm">
                  Insira seu email e enviaremos um código de verificação
                </p>
              </div>

              <form onSubmit={handleSendCode} className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <EnvelopeSimple className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2" />
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                      className="focus-visible:ring-brand-cyan/40 h-12 rounded-xl pl-10.5"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading || !isLoaded}
                  className="btn-gradient-auth h-12 w-full rounded-xl text-[0.95rem] font-semibold shadow-[0_8px_30px_-8px_rgba(20,247,254,0.45)] transition-all hover:shadow-[0_10px_36px_-8px_rgba(55,250,156,0.5)]"
                >
                  {isLoading ? (
                    <CircleNotch className="size-5 animate-spin" />
                  ) : (
                    <>
                      Enviar código
                      <ArrowRight className="size-4.5" weight="bold" />
                    </>
                  )}
                </Button>
              </form>

              <p className="mt-6 text-center">
                <Link
                  href="/sign-in"
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
                >
                  <ArrowLeft className="size-4" />
                  Voltar para o login
                </Link>
              </p>
            </>
          )}

          {step === "code" && (
            <>
              <div className="mb-7 text-center">
                <h1 className="text-2xl font-bold tracking-tight">
                  Redefinir <span className="text-gradient">senha</span>
                </h1>
                <p className="text-muted-foreground mt-1.5 text-sm">
                  Digite o código enviado para{" "}
                  <span className="text-foreground font-medium">{email}</span> e
                  escolha uma nova senha
                </p>
              </div>

              <form
                onSubmit={handleResetPassword}
                className="flex flex-col gap-5"
              >
                <div className="flex flex-col items-center gap-2.5">
                  <Label htmlFor="code">Código de verificação</Label>
                  <InputOTP
                    id="code"
                    maxLength={6}
                    value={code}
                    onChange={setCode}
                    disabled={isLoading}
                  >
                    <InputOTPGroup className="gap-2">
                      {[0, 1, 2, 3, 4, 5].map((index) => (
                        <InputOTPSlot
                          key={index}
                          index={index}
                          className="border-border data-[active=true]:border-brand-cyan data-[active=true]:ring-brand-cyan/25 size-11 rounded-xl border text-base font-semibold first:rounded-l-xl last:rounded-r-xl sm:size-12"
                        />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="new-password">Nova senha</Label>
                  <div className="relative">
                    <LockSimple className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2" />
                    <Input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Mínimo de 8 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                      className="focus-visible:ring-brand-cyan/40 h-12 rounded-xl pr-11 pl-10.5"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      onClick={() => setShowPassword((v) => !v)}
                      className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3.5 -translate-y-1/2 transition-colors"
                    >
                      {showPassword ? (
                        <EyeSlash className="size-4.5" />
                      ) : (
                        <Eye className="size-4.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="confirm-new-password">
                    Confirmar nova senha
                  </Label>
                  <div className="relative">
                    <LockSimple className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2" />
                    <Input
                      id="confirm-new-password"
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Repita a nova senha"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={isLoading}
                      className="focus-visible:ring-brand-cyan/40 h-12 rounded-xl pr-11 pl-10.5"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-label={
                        showConfirmPassword ? "Ocultar senha" : "Mostrar senha"
                      }
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3.5 -translate-y-1/2 transition-colors"
                    >
                      {showConfirmPassword ? (
                        <EyeSlash className="size-4.5" />
                      ) : (
                        <Eye className="size-4.5" />
                      )}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading || !isLoaded}
                  className="btn-gradient-auth h-12 w-full rounded-xl text-[0.95rem] font-semibold shadow-[0_8px_30px_-8px_rgba(20,247,254,0.45)] transition-all hover:shadow-[0_10px_36px_-8px_rgba(55,250,156,0.5)]"
                >
                  {isLoading ? (
                    <CircleNotch className="size-5 animate-spin" />
                  ) : (
                    "Alterar senha"
                  )}
                </Button>
              </form>

              <p className="mt-6 text-center">
                <button
                  type="button"
                  onClick={handleBack}
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
                >
                  <ArrowLeft className="size-4" />
                  Voltar
                </button>
              </p>
            </>
          )}

          {step === "success" && (
            <div className="animate-scale-in flex flex-col items-center gap-3 text-center">
              <h1 className="text-2xl font-bold tracking-tight">
                Senha <span className="text-gradient">alterada!</span>
              </h1>
              <p className="text-muted-foreground text-sm">
                Sua senha foi redefinida com sucesso. Redirecionando para o
                login...
              </p>
              <div className="text-muted-foreground mt-2 flex items-center gap-2 text-sm">
                <CircleNotch className="text-brand-cyan size-4 animate-spin" />
                Redirecionando...
              </div>
            </div>
          )}
        </div>

        <p className="text-muted-foreground/60 mt-8 text-center text-xs">
          © 2026 Clipfy. Todos os direitos reservados.
        </p>
      </div>
    </main>
  )
}
