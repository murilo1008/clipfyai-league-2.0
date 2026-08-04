#!/bin/bash

# Script para sincronizar imagens em PRODUÇÃO
# Este script usa as credenciais de produção para sincronizar fotos

set -e  # Parar em caso de erro

echo "⚠️  ATENÇÃO: Você está prestes a rodar o sync em PRODUÇÃO"
echo ""
echo "Certifique-se de que:"
echo "  1. Você tem o arquivo .env.production.local configurado"
echo "  2. As credenciais de produção estão corretas"
echo "  3. Você tem backup do banco de dados"
echo ""
read -p "Deseja continuar? (digite 'SIM' para confirmar): " confirm

if [ "$confirm" != "SIM" ]; then
    echo "❌ Operação cancelada"
    exit 1
fi

echo ""
echo "🚀 Iniciando sincronização em PRODUÇÃO..."
echo ""

# Carregar variáveis de ambiente de produção
if [ -f .env.production.local ]; then
    export $(cat .env.production.local | grep -v '^#' | xargs)
else
    echo "❌ Erro: Arquivo .env.production.local não encontrado"
    echo "   Copie .env.production.local.example e configure as credenciais"
    exit 1
fi

# Verificar se estamos usando credenciais de produção
if [[ $CLERK_SECRET_KEY != sk_live_* ]]; then
    echo "❌ Erro: CLERK_SECRET_KEY não é uma chave de produção (deve começar com sk_live_)"
    exit 1
fi

echo "✅ Credenciais de produção detectadas"
echo "🔑 Clerk Key: ${CLERK_SECRET_KEY:0:20}..."
echo ""

# Rodar o script
npm run sync:images

echo ""
echo "✅ Sincronização concluída!"

