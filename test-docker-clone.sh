#!/bin/bash
# Script de prueba para verificar que el clon Docker funciona automáticamente
# Este script simula un nuevo clon del repositorio

echo "🚀 Iniciando prueba de clon Docker automático..."
echo "=================================================="

# Crear directorio temporal para prueba
TEST_DIR="/tmp/check-docker-test-$(date +%s)"
echo "📁 Creando directorio de prueba: $TEST_DIR"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# Clonar repositorio
echo "📦 Clonando repositorio..."
git clone https://github.com/carlosh7/check.git .

# Verificar formato de archivos bash
echo "🔍 Verificando formato de archivos bash..."
echo "docker-entrypoint.sh:"
file docker-entrypoint.sh
echo ""
head -5 docker-entrypoint.sh | cat -A

# Verificar .gitattributes
echo ""
echo "🔍 Verificando .gitattributes..."
cat .gitattributes | head -10

# Construir contenedor Docker
echo ""
echo "🐳 Construyendo contenedor Docker..."
docker-compose down 2>/dev/null || true
docker-compose up --build -d

# Esperar a que el contenedor inicie
echo "⏳ Esperando a que el contenedor inicie (10 segundos)..."
sleep 10

# Verificar estado del contenedor
echo ""
echo "🔍 Verificando estado del contenedor..."
docker-compose ps

# Verificar salud del servidor
echo ""
echo "🔍 Verificando salud del servidor..."
curl -s http://localhost:3000/api/health || echo "❌ Servidor no responde"

# Limpiar
echo ""
echo "🧹 Limpiando..."
docker-compose down
cd /
rm -rf "$TEST_DIR"

echo ""
echo "✅ Prueba completada!"
echo "Si todo funcionó correctamente, el clon Docker debería funcionar automáticamente."