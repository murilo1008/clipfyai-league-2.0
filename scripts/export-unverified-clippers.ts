import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

async function exportUnverifiedClippers() {
  try {
    console.log('📊 Buscando clipadores não verificados...')

    // Buscar todos os clipadores com status UNVERIFIED
    const unverifiedClippers = await prisma.clipperProfile.findMany({
      where: {
        verificationStatus: 'UNVERIFIED',
      },
      include: {
        user: {
          select: {
            email: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    console.log(`✅ Encontrados ${unverifiedClippers.length} clipadores não verificados`)

    if (unverifiedClippers.length === 0) {
      console.log('⚠️ Nenhum clipador não verificado encontrado.')
      return
    }

    // Preparar dados para o CSV
    const csvHeader = [
      'Nome Completo',
      'Nome Artístico',
      'Email',
      'Telefone',
      'CPF',
      'PIX',
      'País',
      'Estado',
      'Cidade',
      'Instagram',
      'TikTok',
      'YouTube',
      'Kwai',
      'Facebook',
      'Nichos',
      'Ferramentas',
      'Frequência de Postagem',
      'Comprometimento Semanal',
      'Portfolio Links',
      'Melhor Vídeo URL',
      'Melhor Vídeo Views',
      'Média de Views',
      'Taxa de Engajamento Média',
      'Motivação',
      'Data de Cadastro',
    ].join(',')

    const csvRows = unverifiedClippers.map((clipper) => {
      // Formatar arrays para string
      const instagramAccounts = clipper.instagramUsernames.join('; ')
      const tiktokAccounts = clipper.tiktokUsernames.join('; ')
      const youtubeAccounts = clipper.youtubeUsernames.join('; ')
      const kwaiAccounts = clipper.kwaiUsernames.join('; ')
      const facebookAccounts = clipper.facebookUsernames.join('; ')
      const niches = clipper.niches.join('; ')
      const tools = clipper.tools.join('; ')
      const portfolioLinks = clipper.portfolioLinks.join('; ')

      // Formatar data
      const createdDate = clipper.user.createdAt.toLocaleDateString('pt-BR')

      // Escapar aspas e vírgulas no CSV
      const escapeCSV = (value: string | null | undefined): string => {
        if (!value) return ''
        // Se contém vírgula, aspas ou quebra de linha, colocar entre aspas
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`
        }
        return value
      }

      return [
        escapeCSV(clipper.fullName),
        escapeCSV(clipper.artisticName || ''),
        escapeCSV(clipper.user.email),
        escapeCSV(clipper.phone),
        escapeCSV(clipper.cpf),
        escapeCSV(clipper.pixKey),
        escapeCSV(clipper.country),
        escapeCSV(clipper.state),
        escapeCSV(clipper.city),
        escapeCSV(instagramAccounts),
        escapeCSV(tiktokAccounts),
        escapeCSV(youtubeAccounts),
        escapeCSV(kwaiAccounts),
        escapeCSV(facebookAccounts),
        escapeCSV(niches),
        escapeCSV(tools),
        escapeCSV(clipper.postingFrequency),
        escapeCSV(clipper.weeklyCommitment),
        escapeCSV(portfolioLinks),
        escapeCSV(clipper.bestVideoUrl || ''),
        clipper.bestVideoViews?.toString() || '',
        clipper.avgViews?.toString() || '',
        clipper.avgEngagementRate?.toFixed(2) || '',
        escapeCSV(clipper.motivationText),
        createdDate,
      ].join(',')
    })

    // Combinar header e rows
    const csvContent = [csvHeader, ...csvRows].join('\n')

    // Salvar arquivo CSV
    const timestamp = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    const filename = `clipadores-nao-verificados-${timestamp}.csv`
    const filepath = path.join(process.cwd(), filename)

    fs.writeFileSync(filepath, '\uFEFF' + csvContent, 'utf8') // BOM para Excel reconhecer UTF-8

    console.log(`\n✅ CSV gerado com sucesso!`)
    console.log(`📁 Arquivo: ${filename}`)
    console.log(`📍 Local: ${filepath}`)
    console.log(`👥 Total de registros: ${unverifiedClippers.length}`)

    // Exibir estatísticas
    console.log('\n📊 Estatísticas:')
    const withInstagram = unverifiedClippers.filter(c => c.instagramUsernames.length > 0).length
    const withTikTok = unverifiedClippers.filter(c => c.tiktokUsernames.length > 0).length
    const withYouTube = unverifiedClippers.filter(c => c.youtubeUsernames.length > 0).length
    const withPhone = unverifiedClippers.filter(c => c.phone && c.phone.length > 0).length
    const withCPF = unverifiedClippers.filter(c => c.cpf && c.cpf.length > 0).length

    console.log(`  - Com Instagram: ${withInstagram}`)
    console.log(`  - Com TikTok: ${withTikTok}`)
    console.log(`  - Com YouTube: ${withYouTube}`)
    console.log(`  - Com Telefone: ${withPhone}`)
    console.log(`  - Com CPF: ${withCPF}`)

  } catch (error) {
    console.error('❌ Erro ao exportar clipadores:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Executar o script
exportUnverifiedClippers()
  .then(() => {
    console.log('\n✨ Script finalizado com sucesso!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Erro fatal:', error)
    process.exit(1)
  })

