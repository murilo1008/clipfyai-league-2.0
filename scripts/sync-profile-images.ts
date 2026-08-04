/**
 * Script para sincronizar fotos de perfil do Clerk com o banco de dados
 * 
 * Este script:
 * 1. Busca todos os usuários do Clerk
 * 2. Para cada usuário com imageUrl, atualiza no banco de dados
 * 3. Funciona tanto em ambiente de dev quanto produção
 * 
 * Uso:
 *   npm run sync:images
 */

import { PrismaClient } from '@prisma/client'
import { createClerkClient } from '@clerk/backend'

const prisma = new PrismaClient()

// Criar cliente do Clerk usando a chave secreta
const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
})

async function main() {
  console.log('🔄 Iniciando sincronização de imagens de perfil...\n')
  
  // Determinar ambiente baseado na chave do Clerk
  const clerkSecretKey = process.env.CLERK_SECRET_KEY || ''
  const isProduction = clerkSecretKey.includes('_live_')
  const environment = isProduction ? '🟢 PRODUÇÃO' : '🟡 DESENVOLVIMENTO'
  
  console.log(`📌 Ambiente detectado: ${environment}`)
  console.log(`🔑 Clerk Secret Key: ${clerkSecretKey.substring(0, 20)}...`)
  console.log('')
  
  try {
    // 1. Buscar todos os usuários do banco de dados
    console.log('📊 Buscando usuários do banco de dados...')
    const dbUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        imageUrl: true,
      },
    })
    console.log(`✅ ${dbUsers.length} usuários encontrados no banco de dados\n`)
    
    // 2. Buscar usuários do Clerk
    console.log('🔍 Buscando usuários do Clerk...')
    const clerkUsers = await clerkClient.users.getUserList({
      limit: 500, // Máximo por página
    })
    console.log(`✅ ${clerkUsers.data.length} usuários encontrados no Clerk\n`)
    
    // 3. Processar cada usuário
    let updatedCount = 0
    let skippedCount = 0
    let errorCount = 0
    
    console.log('🔄 Processando usuários...\n')
    
    for (const clerkUser of clerkUsers.data) {
      try {
        // Verificar se usuário existe no banco
        const dbUser = dbUsers.find(u => u.id === clerkUser.id)
        
        if (!dbUser) {
          console.log(`⚠️  Usuário ${clerkUser.emailAddresses[0]?.emailAddress} existe no Clerk mas não no banco`)
          skippedCount++
          continue
        }
        
        // Verificar se tem imageUrl no Clerk
        if (!clerkUser.imageUrl) {
          console.log(`⏭️  ${dbUser.email}: Sem foto no Clerk`)
          skippedCount++
          continue
        }
        
        // Verificar se já está sincronizado
        if (dbUser.imageUrl === clerkUser.imageUrl) {
          console.log(`✓  ${dbUser.email}: Já sincronizado`)
          skippedCount++
          continue
        }
        
        // Atualizar no banco de dados
        await prisma.user.update({
          where: { id: clerkUser.id },
          data: { imageUrl: clerkUser.imageUrl },
        })
        
        console.log(`✅ ${dbUser.email}: Foto sincronizada`)
        console.log(`   URL: ${clerkUser.imageUrl.substring(0, 50)}...`)
        updatedCount++
        
      } catch (error: any) {
        console.error(`❌ Erro ao processar ${clerkUser.emailAddresses[0]?.emailAddress}:`, error.message)
        errorCount++
      }
    }
    
    // 4. Resumo final
    console.log('\n' + '='.repeat(60))
    console.log('📊 RESUMO DA SINCRONIZAÇÃO')
    console.log('='.repeat(60))
    console.log(`✅ Atualizados: ${updatedCount}`)
    console.log(`⏭️  Ignorados: ${skippedCount}`)
    console.log(`❌ Erros: ${errorCount}`)
    console.log(`📊 Total processado: ${clerkUsers.data.length}`)
    console.log('='.repeat(60))
    
    if (updatedCount > 0) {
      console.log('\n🎉 Sincronização concluída com sucesso!')
    } else {
      console.log('\nℹ️  Nenhuma atualização necessária')
    }
    
  } catch (error: any) {
    console.error('\n❌ Erro fatal durante sincronização:', error.message)
    process.exit(1)
  }
}

main()
  .catch((error) => {
    console.error('❌ Erro não tratado:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

