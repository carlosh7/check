#!/bin/sh
# Universal Entrypoint (v12.44.318)
set -e

echo "--------------------------------------------------------"
echo "🔍 DIAGNÓSTICO DE ARRANQUE (Check Pro v12.44.318)"
echo "⏱️  Hora: $(date)"
echo "👤 Usuario: $(id)"
echo "📁 Directorio actual: $(pwd)"
echo "--------------------------------------------------------"

# 0. Diagnóstico Físico (v12.44.318)
if [ ! -z "$DATA_PATH" ]; then
    echo "🔨 Ejecutando test de persistencia en $DATA_PATH..."
    mkdir -p "$DATA_PATH/events" "$DATA_PATH/uploads" 2>/dev/null || true
    date > "$DATA_PATH/ESTOY_VIVO.txt" 2>/dev/null && echo "✅ Archivo ESTOY_VIVO.txt creado en el host." || echo "❌ FALLO: No se pudo escribir en el host."
    chmod -R 777 "$DATA_PATH" 2>/dev/null || true
else
    echo "⚠️ ADVERTENCIA: DATA_PATH no está definida. Usando almacenamiento interno."
fi

# 1. Verificar archivo .env
if [ ! -f ".env" ]; then
    cp .env.example .env 2>/dev/null || touch .env
fi

# 2. Iniciar aplicación
echo "🚀 Arrancando servidor Node.js..."
exec npm start