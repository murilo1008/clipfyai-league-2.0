import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'
import * as path from 'path'

const prisma = new PrismaClient()

async function exportUnverifiedClippersXLSX() {
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

    // Preparar dados para o Excel
    const data = unverifiedClippers.map((clipper) => {
      return {
        'Nome Completo': clipper.fullName || '',
        'Nome Artístico': clipper.artisticName || '',
        'Email': clipper.user.email,
        'Telefone': clipper.phone || '',
        'CPF': clipper.cpf || '',
        'PIX': clipper.pixKey || '',
        'País': clipper.country || '',
        'Estado': clipper.state || '',
        'Cidade': clipper.city || '',
        'Instagram': clipper.instagramUsernames.join('; '),
        'TikTok': clipper.tiktokUsernames.join('; '),
        'YouTube': clipper.youtubeUsernames.join('; '),
        'Kwai': clipper.kwaiUsernames.join('; '),
        'Facebook': clipper.facebookUsernames.join('; '),
        'Nichos': clipper.niches.join('; '),
        'Ferramentas': clipper.tools.join('; '),
        'Frequência de Postagem': clipper.postingFrequency || '',
        'Comprometimento Semanal': clipper.weeklyCommitment || '',
        'Portfolio Links': clipper.portfolioLinks.join('; '),
        'Melhor Vídeo URL': clipper.bestVideoUrl || '',
        'Melhor Vídeo Views': clipper.bestVideoViews || '',
        'Média de Views': clipper.avgViews || '',
        'Taxa de Engajamento Média': clipper.avgEngagementRate?.toFixed(2) || '',
        'Motivação': clipper.motivationText || '',
        'Data de Cadastro': clipper.user.createdAt.toLocaleDateString('pt-BR'),
      }
    })

    // Criar workbook e worksheet
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(data)

    // Ajustar largura das colunas
    const columnWidths = [
      { wch: 25 }, // Nome Completo
      { wch: 20 }, // Nome Artístico
      { wch: 30 }, // Email
      { wch: 18 }, // Telefone
      { wch: 18 }, // CPF
      { wch: 25 }, // PIX
      { wch: 12 }, // País
      { wch: 12 }, // Estado
      { wch: 20 }, // Cidade
      { wch: 30 }, // Instagram
      { wch: 30 }, // TikTok
      { wch: 30 }, // YouTube
      { wch: 30 }, // Kwai
      { wch: 30 }, // Facebook
      { wch: 30 }, // Nichos
      { wch: 30 }, // Ferramentas
      { wch: 20 }, // Frequência de Postagem
      { wch: 25 }, // Comprometimento Semanal
      { wch: 40 }, // Portfolio Links
      { wch: 40 }, // Melhor Vídeo URL
      { wch: 15 }, // Melhor Vídeo Views
      { wch: 15 }, // Média de Views
      { wch: 22 }, // Taxa de Engajamento Média
      { wch: 50 }, // Motivação
      { wch: 15 }, // Data de Cadastro
    ]
    worksheet['!cols'] = columnWidths

    // Adicionar worksheet ao workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Clipadores Não Verificados')

    // Salvar arquivo XLSX
    const timestamp = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    const filename = `clipadores-nao-verificados-${timestamp}.xlsx`
    const filepath = path.join(process.cwd(), filename)

    XLSX.writeFile(workbook, filepath)

    console.log(`\n✅ Excel gerado com sucesso!`)
    console.log(`📁 Arquivo: ${filename}`)
    console.log(`📍 Local: ${filepath}`)
    console.log(`👥 Total de registros: ${unverifiedClippers.length}`)

    // Exibir estatísticas
    console.log('\n📊 Estatísticas:')
    const withInstagram = unverifiedClippers.filter(c => c.instagramUsernames.length > 0).length
    const withTikTok = unverifiedClippers.filter(c => c.tiktokUsernames.length > 0).length
    const withYouTube = unverifiedClippers.filter(c => c.youtubeUsernames.length > 0).length
    const withKwai = unverifiedClippers.filter(c => c.kwaiUsernames.length > 0).length
    const withFacebook = unverifiedClippers.filter(c => c.facebookUsernames.length > 0).length
    const withPhone = unverifiedClippers.filter(c => c.phone && c.phone.length > 0).length
    const withCPF = unverifiedClippers.filter(c => c.cpf && c.cpf.length > 0).length
    const withPIX = unverifiedClippers.filter(c => c.pixKey && c.pixKey.length > 0).length

    console.log(`  - Com Instagram: ${withInstagram} (${((withInstagram/unverifiedClippers.length)*100).toFixed(1)}%)`)
    console.log(`  - Com TikTok: ${withTikTok} (${((withTikTok/unverifiedClippers.length)*100).toFixed(1)}%)`)
    console.log(`  - Com YouTube: ${withYouTube} (${((withYouTube/unverifiedClippers.length)*100).toFixed(1)}%)`)
    console.log(`  - Com Kwai: ${withKwai} (${((withKwai/unverifiedClippers.length)*100).toFixed(1)}%)`)
    console.log(`  - Com Facebook: ${withFacebook} (${((withFacebook/unverifiedClippers.length)*100).toFixed(1)}%)`)
    console.log(`  - Com Telefone: ${withPhone} (${((withPhone/unverifiedClippers.length)*100).toFixed(1)}%)`)
    console.log(`  - Com CPF: ${withCPF} (${((withCPF/unverifiedClippers.length)*100).toFixed(1)}%)`)
    console.log(`  - Com PIX: ${withPIX} (${((withPIX/unverifiedClippers.length)*100).toFixed(1)}%)`)

    // Estatísticas de nichos e ferramentas mais comuns
    console.log('\n🎯 Top 5 Nichos mais comuns:')
    const nichesCount: Record<string, number> = {}
    unverifiedClippers.forEach(c => {
      c.niches.forEach(niche => {
        nichesCount[niche] = (nichesCount[niche] || 0) + 1
      })
    })
    const topNiches = Object.entries(nichesCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
    topNiches.forEach(([niche, count], index) => {
      console.log(`  ${index + 1}. ${niche}: ${count} clipadores`)
    })

    console.log('\n🛠️ Top 5 Ferramentas mais usadas:')
    const toolsCount: Record<string, number> = {}
    unverifiedClippers.forEach(c => {
      c.tools.forEach(tool => {
        toolsCount[tool] = (toolsCount[tool] || 0) + 1
      })
    })
    const topTools = Object.entries(toolsCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
    topTools.forEach(([tool, count], index) => {
      console.log(`  ${index + 1}. ${tool}: ${count} clipadores`)
    })

  } catch (error) {
    console.error('❌ Erro ao exportar clipadores:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Executar o script
exportUnverifiedClippersXLSX()
  .then(() => {
    console.log('\n✨ Script finalizado com sucesso!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Erro fatal:', error)
    process.exit(1)
  })

