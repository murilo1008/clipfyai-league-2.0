"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { useSignIn } from "@clerk/nextjs"
import { toast } from "sonner"

import { api } from "@/trpc/react"

export const applyPhoneMask = (value: string): string => {
  const numbers = value.replace(/\D/g, "")
  if (numbers.length <= 2) return numbers
  else if (numbers.length <= 7)
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`
  else if (numbers.length <= 11)
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`
  else
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`
}

export const removePhoneMask = (value: string): string =>
  value.replace(/\D/g, "")

/**
 * Estado + submit do cadastro — fluxo da Clipfy League:
 * user.create (Clerk + banco no servidor) → login automático → /onboarding.
 *
 * @param referralSlug Slug de origem do cadastro (`?slug=` — competição/canal).
 * @param affiliateCode Código de afiliado do clipador indicador (`?ref=`).
 *   Código inválido é ignorado no servidor e nunca derruba o cadastro.
 */
export function useSignUpForm(
  referralSlug?: string | null,
  affiliateCode?: string | null,
) {
  const { isLoaded, signIn, setActive } = useSignIn()
  const router = useRouter()
  const createUserMutation = api.user.create.useMutation()

  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [showPassword, setShowPassword] = React.useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)

  const handlePhoneChange = (value: string) => setPhone(applyPhoneMask(value))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast.error("Nome é obrigatório", {
        description: "Por favor, insira seu nome completo",
        duration: 4000,
      })
      return
    }

    if (!email.trim()) {
      toast.error("Email é obrigatório", {
        description: "Por favor, insira um endereço de email válido",
        duration: 4000,
      })
      return
    }

    if (!phone.trim() || removePhoneMask(phone).length < 10) {
      toast.error("Telefone inválido", {
        description: "Por favor, insira um telefone válido",
        duration: 4000,
      })
      return
    }

    if (!password.trim() || password.length < 8) {
      toast.error("Senha muito curta", {
        description: "A senha deve ter pelo menos 8 caracteres",
        duration: 4000,
      })
      return
    }

    if (password !== confirmPassword) {
      toast.error("Senhas não coincidem", {
        description: "Por favor, verifique se as senhas são iguais",
        duration: 4000,
      })
      return
    }

    setIsLoading(true)

    const affiliate = affiliateCode?.trim()

    try {
      await createUserMutation.mutateAsync({
        name: name,
        email: email,
        phone: removePhoneMask(phone),
        password: password,
        ...(referralSlug ? { referralSlug } : {}),
        ...(affiliate ? { affiliateCode: affiliate } : {}),
      })

      if (isLoaded && signIn) {
        try {
          const signInResult = await signIn.create({
            identifier: email,
            password: password,
          })

          if (signInResult.status === "complete") {
            await setActive({ session: signInResult.createdSessionId })
            toast.success("🎉 Conta criada com sucesso!", {
              description:
                "Bem-vindo ao Clipfy! Redirecionando para o onboarding...",
              duration: 3000,
            })
            setTimeout(() => {
              router.push("/onboarding")
            }, 1500)
          } else {
            router.push(`/sign-in`)
          }
        } catch {
          toast.success("🎉 Conta criada!", {
            description: "Faça login para continuar.",
            duration: 3000,
          })
          router.push(`/sign-in`)
        }
      } else {
        toast.success("🎉 Conta criada com sucesso!", {
          description: "Faça login para continuar.",
          duration: 3000,
        })
        router.push(`/sign-in`)
      }
    } catch (err: unknown) {
      const error = err as { message?: string; data?: { message?: string } }
      let errorMessage = "Algo deu errado. Tente novamente"
      let errorTitle = "Erro ao criar conta"

      if (error.message) errorMessage = error.message
      if (error.data?.message) errorMessage = error.data.message

      const lower = errorMessage.toLowerCase()
      if (
        lower.includes("email já está em uso") ||
        lower.includes("email already exists") ||
        lower.includes("identifier_exists")
      ) {
        errorTitle = "Email já cadastrado"
        errorMessage =
          "Este email já está em uso. Tente fazer login ou use outro email."
      } else if (lower.includes("senha") && lower.includes("curta")) {
        errorTitle = "Senha muito curta"
        errorMessage = "A senha deve ter pelo menos 8 caracteres."
      } else if (
        lower.includes("senha") &&
        (lower.includes("fraca") || lower.includes("forte"))
      ) {
        errorTitle = "Senha fraca"
        errorMessage = "Use uma senha mais forte com letras, números e símbolos."
      } else if (lower.includes("email") && lower.includes("inválido")) {
        errorTitle = "Email inválido"
        errorMessage = "Por favor, insira um email válido."
      } else if (lower.includes("network") || lower.includes("rede")) {
        errorTitle = "Erro de conexão"
        errorMessage = "Verifique sua conexão com a internet e tente novamente."
      }

      toast.error(errorTitle, { description: errorMessage, duration: 6000 })
    } finally {
      setIsLoading(false)
    }
  }

  return {
    name,
    setName,
    email,
    setEmail,
    phone,
    handlePhoneChange,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    isLoading,
    handleSubmit,
  }
}
