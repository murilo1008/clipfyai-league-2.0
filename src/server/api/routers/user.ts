import { currentUser, clerkClient } from "@clerk/nextjs/server";
import { createTRPCRouter, privateProcedure, publicProcedure } from "../trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { normalizePixKeyForType } from "@/lib/pix-key";

export const userRouter = createTRPCRouter({
  getCurrentUser: publicProcedure.query(async ({ ctx }) => {
    const user = await currentUser()
    
    // Se não houver usuário logado, retornar null
    if (!user) {
      return null
    }
    
    return ctx.db.user.findUnique({
      where: { id: user.id },
      include: {
        clipperProfile: true,
      },
    });
  }),

  create: publicProcedure
    .input(
      z.object({
        id: z.string().optional(), // ID do Clerk (opcional para quando já criado)
        name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
        email: z.string().email("Email inválido"),
        phone: z.string().min(10, "Telefone inválido"),
        password: z.string().min(8, "Senha deve ter pelo menos 8 caracteres").optional(),
        role: z.enum(["ADMIN", "ORGANIZER_ADMIN", "CLIENT", "CLIPPER"]).optional(),
        referralSlug: z.string().optional(), // Slug de origem do cadastro (competição, canal, campanha, etc.)
        affiliateCode: z.string().trim().min(1).max(64).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        console.log(`🚀 Iniciando criação completa do usuário: ${input.email}`)

        // Indicação por afiliado só vale para cadastro de clipador
        const isClipperRegistration = !input.role || input.role === "CLIPPER"
        // Código inválido é ignorado de propósito: nunca deve derrubar o cadastro
        const referringClipper =
          input.affiliateCode && isClipperRegistration
            ? await ctx.db.clipperProfile.findUnique({
                where: { affiliateCode: input.affiliateCode.toLowerCase() },
                select: { id: true, affiliateCode: true },
              })
            : null

        if (input.affiliateCode && isClipperRegistration && !referringClipper) {
          console.warn(
            `⚠️ Código de afiliado inválido ignorado no cadastro: ${input.affiliateCode}`,
          )
        }

        let clerkUserId = input.id;

        // Passo 1: Criar usuário no Clerk (se não foi passado ID)
        if (!clerkUserId && input.password) {
          console.log('📝 Criando usuário no Clerk...')
          const client = await clerkClient()
          
          const clerkUser = await client.users.createUser({
            emailAddress: [input.email],
            password: input.password,
            firstName: input.name.split(' ')[0],
            lastName: input.name.split(' ').slice(1).join(' ') || '',
            publicMetadata: {
              phone: input.phone,
            },
          })

          console.log(`✅ Usuário criado no Clerk com ID: ${clerkUser.id}`)
          clerkUserId = clerkUser.id
        }

        if (!clerkUserId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'ID do Clerk ou senha são necessários para criar o usuário.',
          })
        }

        // Passo 2: Verificar se usuário já existe no banco
        const existingUser = await ctx.db.user.findUnique({
          where: { id: clerkUserId },
        })

        if (existingUser) {
          console.log(`⚠️ Usuário já existe no banco de dados: ${existingUser.email}`)
          return {
            success: true,
            user: {
              id: existingUser.id,
              name: existingUser.name,
              email: existingUser.email,
            },
            message: 'Usuário já existe',
          }
        }

        // Passo 3: Criar usuário no banco de dados usando o ID do Clerk
        console.log('💾 Criando usuário no banco de dados...')
        const newUser = await ctx.db.user.create({
          data: {
            id: clerkUserId, // Usar o ID do Clerk
            name: input.name,
            email: input.email,
            imageUrl: null,
            role: input.role || 'CLIPPER', // Usar role do input ou default CLIPPER
            referralSlug:
              input.referralSlug ||
              (referringClipper ? `affiliate:${referringClipper.affiliateCode}` : null), // Slug de origem do cadastro
            referredByClipperId: referringClipper?.id ?? null,
          },
        })

        console.log(`✅ Usuário criado no banco de dados: ${newUser.email}`)
        
        // Passo 4: Retornar dados do usuário criado
        return {
          success: true,
          user: {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            clerkId: clerkUserId,
          },
          message: 'Usuário criado com sucesso',
        }

      } catch (error: any) {
        console.error('❌ Erro na criação do usuário:', error)
        
        // Mapear erros do Clerk para mensagens em português
        if (error.errors && Array.isArray(error.errors)) {
          const clerkError = error.errors[0]
          const code = clerkError?.code
          const message = clerkError?.message || ''
          const longMessage = clerkError?.longMessage || ''

          console.log('📋 Erro do Clerk:', { code, message, longMessage })

          // Mapear códigos de erro específicos do Clerk
          switch (code) {
            case 'form_identifier_exists':
            case 'identifier_exists':
              throw new TRPCError({
                code: 'CONFLICT',
                message: 'Este email já está em uso. Tente fazer login ou use outro email.',
              })
            
            case 'form_password_length_too_short':
            case 'form_password_pwned':
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'A senha deve ter pelo menos 8 caracteres.',
              })
            
            case 'form_password_not_strong_enough':
            case 'form_password_validation_failed':
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'A senha não é forte o suficiente. Use uma combinação de letras maiúsculas, minúsculas, números e símbolos.',
              })
            
            case 'form_param_format_invalid':
              if (message.toLowerCase().includes('email') || longMessage.toLowerCase().includes('email')) {
                throw new TRPCError({
                  code: 'BAD_REQUEST',
                  message: 'Email inválido. Verifique o formato do email (ex: usuario@exemplo.com).',
                })
              }
              if (message.toLowerCase().includes('phone') || longMessage.toLowerCase().includes('phone')) {
                throw new TRPCError({
                  code: 'BAD_REQUEST',
                  message: 'Telefone inválido. Use o formato correto (ex: 11999999999).',
                })
              }
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Formato inválido. Verifique os dados informados.',
              })
            
            case 'form_param_missing':
            case 'form_param_nil':
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Todos os campos obrigatórios devem ser preenchidos.',
              })
            
            case 'form_username_invalid_length':
            case 'form_param_max_length_exceeded':
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'O nome deve ter entre 2 e 50 caracteres.',
              })
            
            case 'form_param_min_length_exceeded':
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Um ou mais campos são muito curtos. Verifique os dados informados.',
              })
            
            case 'form_password_size_in_bytes_exceeded':
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'A senha é muito longa. Use no máximo 72 caracteres.',
              })
            
            case 'form_code_incorrect':
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Código de verificação incorreto. Tente novamente.',
              })
            
            case 'session_exists':
              throw new TRPCError({
                code: 'CONFLICT',
                message: 'Você já está logado. Faça logout antes de criar uma nova conta.',
              })
            
            default:
              // Tentar extrair informação útil da mensagem original
              const fullMessage = (message + ' ' + longMessage).toLowerCase()
              
              if (fullMessage.includes('email')) {
                if (fullMessage.includes('already') || fullMessage.includes('exists') || fullMessage.includes('taken')) {
                  throw new TRPCError({
                    code: 'CONFLICT',
                    message: 'Este email já está em uso. Tente fazer login ou use outro email.',
                  })
                }
                if (fullMessage.includes('invalid') || fullMessage.includes('format')) {
                  throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Email inválido. Verifique o formato do email (ex: usuario@exemplo.com).',
                  })
                }
              }
              
              if (fullMessage.includes('password')) {
                if (fullMessage.includes('short') || fullMessage.includes('length')) {
                  throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'A senha deve ter pelo menos 8 caracteres.',
                  })
                }
                if (fullMessage.includes('weak') || fullMessage.includes('strong') || fullMessage.includes('common')) {
                  throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'A senha não é forte o suficiente. Use uma combinação de letras maiúsculas, minúsculas, números e símbolos. Evite senhas comuns.',
                  })
                }
              }
              
              if (fullMessage.includes('name')) {
                throw new TRPCError({
                  code: 'BAD_REQUEST',
                  message: 'Nome inválido. Use apenas letras, espaços e acentos.',
                })
              }
              
              if (fullMessage.includes('phone') || fullMessage.includes('telefone')) {
                throw new TRPCError({
                  code: 'BAD_REQUEST',
                  message: 'Telefone inválido. Use o formato correto (ex: 11999999999).',
                })
              }
              
              if (fullMessage.includes('network') || fullMessage.includes('connection')) {
                throw new TRPCError({
                  code: 'INTERNAL_SERVER_ERROR',
                  message: 'Erro de conexão. Verifique sua internet e tente novamente.',
                })
              }
              
              // Erro genérico com mensagem original se disponível
              throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: message || longMessage || 'Erro ao criar conta. Verifique os dados e tente novamente.',
              })
          }
        }
        
        // Se já é um TRPCError, apenas re-throw
        if (error instanceof TRPCError) {
          throw error
        }
        
        // Verificar se é erro de duplicação no banco de dados (Prisma)
        if (error.code === 'P2002' || (error.message && error.message.includes('Unique constraint'))) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Este email já está em uso. Tente fazer login ou use outro email.',
          })
        }
        
        // Outros erros do banco de dados (Prisma)
        if (error.code && error.code.startsWith('P')) {
          console.error('Erro do Prisma:', error.code, error.message)
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Erro ao salvar os dados. Tente novamente em alguns instantes.',
          })
        }
        
        // Erro de timeout
        if (error.message && (error.message.includes('timeout') || error.message.includes('ETIMEDOUT'))) {
          throw new TRPCError({
            code: 'TIMEOUT',
            message: 'A operação demorou muito tempo. Verifique sua conexão e tente novamente.',
          })
        }
        
        // Erro de rede
        if (error.message && (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND'))) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Erro de conexão com o servidor. Tente novamente em alguns instantes.',
          })
        }
        
        // Erro genérico final
        console.error('Erro não tratado:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erro ao criar conta. Por favor, tente novamente ou entre em contato com o suporte.',
        })
      }
    }),

  // Criar ou atualizar ClipperProfile (usado no onboarding)
  upsertClipperProfile: privateProcedure
    .input(
      z.object({
        // Step 1: Informações Pessoais
        fullName: z.string().optional(),
        artisticName: z.string().optional(),
        phone: z.string().optional(),
        cpf: z.string().optional(),
        pixKey: z.string().optional(),
        country: z.string().optional(),
        state: z.string().optional(),
        city: z.string().optional(),
        
        // Step 2: Redes Sociais
        instagramUsernames: z.array(z.string()).optional(),
        tiktokUsernames: z.array(z.string()).optional(),
        youtubeUsernames: z.array(z.string()).optional(),
        kwaiUsernames: z.array(z.string()).optional(),
        facebookUsernames: z.array(z.string()).optional(),
        socialAccountsData: z.array(z.object({
          platform: z.enum(["INSTAGRAM", "TIKTOK", "YOUTUBE", "KWAI", "FACEBOOK"]),
          username: z.string(),
          niche: z.string(),
        })).optional(),
        
        // Step 3: Habilidades e Experiência
        niches: z.array(z.string()).optional(),
        tools: z.array(z.string()).optional(),
        postingFrequency: z.string().optional(),
        weeklyCommitment: z.string().optional(),
        
        // Step 4: Portfólio
        portfolioLinks: z.array(z.string()).optional(),
        bestVideoUrl: z.string().optional(),
        bestVideoViews: z.number().optional(),
        avgViews: z.number().optional(),
        avgEngagementRate: z.number().optional(),
        
        // Step 5: Motivação
        motivationText: z.string().optional(),
        acceptsCoaching: z.boolean().optional(),
        
        // Step 6: Termos
        agreeToTerms: z.boolean().optional(),
        agreeToCompliance: z.boolean().optional(),
        agreeToPublicProfile: z.boolean().optional(),
        agreeToDataProcessing: z.boolean().optional(),
        isOver18: z.boolean().optional(),
        
        // Step 7: Discord
        discordUsername: z.string().optional(),
        discordId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await currentUser()
      
      if (!user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Você precisa estar logado para atualizar o perfil.',
        })
      }

      try {
        // Verificar se já existe um perfil
        const existingProfile = await ctx.db.clipperProfile.findUnique({
          where: { userId: user.id },
        })

        // Preparar os dados para atualização (apenas campos definidos)
        const updateData: any = {}
        Object.keys(input).forEach((key) => {
          if (key === 'acceptsCoaching' || key === 'socialAccountsData') return
          
          const value = (input as any)[key]
          if (value !== undefined) {
            updateData[key] = value
          }
        })

        if (existingProfile) {
          // Atualizar perfil existente
          const updatedProfile = await ctx.db.clipperProfile.update({
            where: { userId: user.id },
            data: updateData,
          })
          
          return {
            success: true,
            profile: updatedProfile,
            message: 'Perfil atualizado com sucesso',
          }
        } else {
          // Criar novo perfil com valores padrão para campos obrigatórios
          // E criar a Wallet e SocialAccounts automaticamente usando uma transação
          const result = await ctx.db.$transaction(async (tx) => {
            // 1. Criar o ClipperProfile
            const newProfile = await tx.clipperProfile.create({
              data: {
                userId: user.id,
                fullName: input.fullName || user.firstName || '',
                phone: input.phone || '',
                cpf: input.cpf || '',
                pixKey: input.pixKey || '',
                country: input.country || 'Brasil',
                state: input.state || '',
                city: input.city || '',
                instagramUsernames: input.instagramUsernames || [],
                tiktokUsernames: input.tiktokUsernames || [],
                youtubeUsernames: input.youtubeUsernames || [],
                kwaiUsernames: input.kwaiUsernames || [],
                facebookUsernames: input.facebookUsernames || [],
                niches: input.niches || [],
                tools: input.tools || [],
                portfolioLinks: input.portfolioLinks || [],
                postingFrequency: input.postingFrequency || '',
                weeklyCommitment: input.weeklyCommitment || '',
                motivationText: input.motivationText || '',
                ...updateData,
              },
            })

            // 2. Criar a Wallet automaticamente para o clipper
            await tx.wallet.create({
              data: {
                clipperProfileId: newProfile.id,
                balance: 0,
                totalEarned: 0,
                totalWithdrawn: 0,
                pendingWithdraw: 0,
                currency: 'BRL',
                isActive: true,
              }
            })

            // 3. Criar SocialAccounts a partir dos dados
            const socialAccountsToCreate: any[] = []
            const nicheMap = new Map<string, string>()

            if (input.socialAccountsData) {
              input.socialAccountsData.forEach(acc => {
                if (acc.niche) {
                  nicheMap.set(`${acc.platform}:${acc.username}`, acc.niche)
                }
              })
            }

            const getNiche = (platform: string, username: string) => {
              const niche = nicheMap.get(`${platform}:${username}`)
              return niche || undefined
            }

            const profileUrlMap: Record<string, (u: string) => string> = {
              INSTAGRAM: (u) => `https://instagram.com/${u.replace('@', '')}`,
              TIKTOK: (u) => `https://tiktok.com/${u}`,
              KWAI: (u) => `https://kwai.com/@${u.replace('@', '')}`,
              FACEBOOK: (u) => `https://facebook.com/${u.replace('@', '')}`,
            }

            const platformArrays: [string, string[] | undefined][] = [
              ['INSTAGRAM', input.instagramUsernames],
              ['TIKTOK', input.tiktokUsernames],
              ['YOUTUBE', input.youtubeUsernames],
              ['KWAI', input.kwaiUsernames],
              ['FACEBOOK', input.facebookUsernames],
            ]

            for (const [platform, usernames] of platformArrays) {
              if (usernames && usernames.length > 0) {
                usernames.forEach((username, index) => {
                  if (username && username.trim() !== '') {
                    let cleanUsername = username
                    let profileUrl = ''

                    if (platform === 'YOUTUBE' && username.startsWith('http')) {
                      profileUrl = username
                      cleanUsername = username.split('/').pop() || username
                    } else {
                      cleanUsername = username.startsWith('@') ? username : `@${username}`
                      const urlFn = profileUrlMap[platform]
                      profileUrl = urlFn ? urlFn(cleanUsername) : `https://${platform.toLowerCase()}.com/${cleanUsername.replace('@', '')}`
                    }

                    socialAccountsToCreate.push({
                      clipperProfileId: newProfile.id,
                      platform,
                      username: cleanUsername,
                      profileUrl,
                      isPrimary: index === 0,
                      isActive: true,
                      niche: getNiche(platform, username),
                    })
                  }
                })
              }
            }

            if (socialAccountsToCreate.length > 0) {
              await tx.socialAccount.createMany({
                data: socialAccountsToCreate,
                skipDuplicates: true,
              })
            }

            return newProfile
          })
          
          return {
            success: true,
            profile: result,
            message: 'Perfil, carteira e contas sociais criados com sucesso',
          }
        }
      } catch (error: any) {
        console.error('Erro ao salvar perfil do clipper:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erro ao salvar perfil',
        })
      }
    }),

  // Finalizar onboarding
  completeOnboarding: privateProcedure
    .mutation(async ({ ctx }) => {
      const user = await currentUser()
      
      if (!user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Você precisa estar logado.',
        })
      }

      try {
        // Atualizar o usuário para onboarding completo
        await ctx.db.user.update({
          where: { id: user.id },
          data: { onboardingCompleted: true },
        })
        
        // Auto-aprovar o clipper
        await ctx.db.clipperProfile.update({
          where: { userId: user.id },
          data: {
            verificationStatus: 'VERIFIED',
            verifiedAt: new Date(),
          },
        })
        
        return {
          success: true,
          message: 'Onboarding concluído com sucesso',
        }
      } catch (error: any) {
        console.error('Erro ao finalizar onboarding:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erro ao finalizar onboarding',
        })
      }
    }),

  // Buscar status de verificação
  getVerificationStatus: privateProcedure
    .query(async ({ ctx }) => {
      const user = await currentUser()
      
      if (!user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Você precisa estar logado.',
        })
      }

      try {
        const profile = await ctx.db.clipperProfile.findUnique({
          where: { userId: user.id },
          select: {
            verificationStatus: true,
            verifiedAt: true,
            fullName: true,
            artisticName: true,
          },
        })
        
        if (!profile) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Perfil não encontrado',
          })
        }
        
        return profile
      } catch (error: any) {
        console.error('Erro ao buscar status de verificação:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erro ao buscar status',
        })
      }
    }),

  // Atualizar informações do Discord do clipper
  updateDiscordInfo: privateProcedure
    .input(z.object({
      discordUsername: z.string().min(1, "Username do Discord é obrigatório"),
      discordId: z.string().regex(/^\d+$/, "ID do Discord deve conter apenas números"),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const user = await currentUser()
        
        if (!user) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Usuário não autenticado',
          })
        }

        // Buscar perfil do clipper
        const clipperProfile = await ctx.db.clipperProfile.findUnique({
          where: { userId: user.id },
        })

        if (!clipperProfile) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Perfil de clipper não encontrado',
          })
        }

        // Atualizar Discord
        const updatedProfile = await ctx.db.clipperProfile.update({
          where: { userId: user.id },
          data: {
            discordUsername: input.discordUsername,
            discordId: input.discordId,
          },
        })

        return {
          success: true,
          profile: updatedProfile,
        }
      } catch (error: any) {
        console.error('Erro ao atualizar Discord:', error)
        if (error instanceof TRPCError) {
          throw error
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erro ao atualizar informações do Discord',
        })
      }
    }),

  // Atualizar a chave PIX do clipper (destino dos pagamentos da carteira)
  updatePixKey: privateProcedure
    .input(z.object({
      pixKey: z.string().max(140, "Chave PIX muito longa"),
      pixKeyType: z.enum(["CPF", "CNPJ", "EMAIL", "PHONE", "EVP"]),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const user = await currentUser()

        if (!user) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Usuário não autenticado',
          })
        }

        const clipperProfile = await ctx.db.clipperProfile.findUnique({
          where: { userId: user.id },
        })

        if (!clipperProfile) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Perfil de clipper não encontrado',
          })
        }

        // A validação/normalização é a mesma do onboarding e do admin
        const normalized = normalizePixKeyForType(input.pixKey, input.pixKeyType)
        if (!normalized.ok) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: normalized.error,
          })
        }

        const updatedProfile = await ctx.db.clipperProfile.update({
          where: { userId: user.id },
          data: { pixKey: normalized.value },
        })

        return {
          success: true,
          pixKey: updatedProfile.pixKey,
        }
      } catch (error: any) {
        if (error instanceof TRPCError) throw error
        console.error('Erro ao atualizar chave PIX:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erro ao atualizar chave PIX',
        })
      }
    }),

  updateArtisticName: privateProcedure
    .input(z.object({
      artisticName: z.string().max(50, "Nome artístico deve ter no máximo 50 caracteres"),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const user = await currentUser()

        if (!user) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Usuário não autenticado',
          })
        }

        const clipperProfile = await ctx.db.clipperProfile.findUnique({
          where: { userId: user.id },
        })

        if (!clipperProfile) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Perfil de clipper não encontrado',
          })
        }

        const updatedProfile = await ctx.db.clipperProfile.update({
          where: { userId: user.id },
          data: {
            artisticName: input.artisticName.trim() || null,
          },
        })

        return {
          success: true,
          artisticName: updatedProfile.artisticName,
        }
      } catch (error: any) {
        if (error instanceof TRPCError) throw error
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erro ao atualizar nome artístico',
        })
      }
    }),

  // Atualizar imageUrl do usuário
  updateProfileImage: privateProcedure
    .input(z.object({
      imageUrl: z.string().url("URL inválida"),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const user = await currentUser()
        
        if (!user) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Usuário não autenticado',
          })
        }

        // Atualizar imageUrl no banco de dados
        const updatedUser = await ctx.db.user.update({
          where: { id: user.id },
          data: { imageUrl: input.imageUrl },
          select: {
            id: true,
            name: true,
            email: true,
            imageUrl: true,
          },
        })

        console.log(`✅ ImageUrl atualizada para usuário ${updatedUser.email}`)
        
        return {
          success: true,
          user: updatedUser,
        }
      } catch (error: any) {
        console.error('Erro ao atualizar imageUrl:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erro ao atualizar imagem',
        })
      }
    }),
});