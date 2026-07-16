#!/bin/sh
# Universal Entrypoint (v12.44.775) — Auto-port detection
set -e

echo "--------------------------------------------------------"
echo "🔍 DIAGNÓSTICO DE ARRANQUE (Check Pro v12.44.775)"
echo "⏱️  Hora: $(date)"
echo "👤 Usuario: $(id)"
echo "📁 Directorio actual: $(pwd)"
echo "--------------------------------------------------------"

# 0. Diagnóstico de Persistencia
if [ ! -z "$DATA_PATH" ]; then
    echo "🔨 Ejecutando test de persistencia en $DATA_PATH..."
    mkdir -p "$DATA_PATH/system" "$DATA_PATH/events" "$DATA_PATH/uploads" 2>/dev/null || true
    date > "$DATA_PATH/ESTOY_VIVO.txt" 2>/dev/null && echo "✅ Archivo ESTOY_VIVO.txt creado en el host." || echo "❌ FALLO: No se pudo escribir en el host."
    chmod -R 777 "$DATA_PATH" 2>/dev/null || true
else
    echo "⚠️ ADVERTENCIA: DATA_PATH no está definida. Usando almacenamiento interno."
    export DATA_PATH=/usr/src/app/data
    mkdir -p "$DATA_PATH/system" "$DATA_PATH/events" "$DATA_PATH/uploads" 2>/dev/null || true
fi

# 1. Verificar archivo .env
if [ ! -f ".env" ]; then
    cp .env.example .env 2>/dev/null || touch .env
    echo "✅ Archivo .env creado desde .env.example"
fi

# 2. Auto-detección de puerto
# Buscar un puerto libre empezando desde el configurado
DESIRED_PORT=${PORT:-3000}
PORT_FOUND=0

# Función para verificar si un puerto está libre
check_port() {
    (echo >/dev/tcp/localhost/$1) 2>/dev/null
    return $?
}

for offset in 0 1 2 3 4 5 6 7 8 9 10; do
    CANDIDATE=$((DESIRED_PORT + offset))
    if ! check_port $CANDIDATE; then
        export PORT=$CANDIDATE
        PORT_FOUND=1
        echo "✅ Puerto disponible: $CANDIDATE"
        
        # Actualizar .env con el puerto encontrado
        if [ -f ".env" ]; then
            sed -i "s/^PORT=.*/PORT=$CANDIDATE/" .env 2>/dev/null || true
            sed -i "s/^APP_URL=.*/APP_URL=http:\/\/localhost:$CANDIDATE/" .env 2>/dev/null || true
            sed -i "s/^ALLOWED_ORIGINS=.*/ALLOWED_ORIGINS=http:\/\/localhost:$CANDIDATE/" .env 2>/dev/null || true
        fi
        
        if [ $offset -gt 0 ]; then
            echo "⚠️  Puerto $DESIRED_PORT ocupado. Usando $CANDIDATE en su lugar."
        fi
        break
    fi
done

if [ $PORT_FOUND -eq 0 ]; then
    echo "❌ No se encontró puerto libre. Usando $DESIRED_PORT de todas formas."
    export PORT=$DESIRED_PORT
fi

# 3. Auto-verificación de dependencias
echo "🔍 Verificando dependencias..."
node -e "try { require('better-sqlite3'); console.log('  ✅ better-sqlite3 OK'); } catch(e) { console.error('  ❌ better-sqlite3 MISSING'); process.exit(1); }"
node -e "try { require('express'); console.log('  ✅ express OK'); } catch(e) { console.error('  ❌ express MISSING'); process.exit(1); }"
node -e "try { require('jsonwebtoken'); console.log('  ✅ jsonwebtoken OK'); } catch(e) { console.warn('  ⚠️  jsonwebtoken no disponible'); }" || true

# 4. Verificar que JWT_SECRET exista
if ! grep -q "JWT_SECRET" .env 2>/dev/null || grep -q "JWT_SECRET=$" .env 2>/dev/null; then
    echo "⚠️  JWT_SECRET no configurado. Generando uno nuevo..."
    NEW_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    echo "JWT_SECRET=$NEW_SECRET" >> .env
    echo "✅ JWT_SECRET generado y guardado en .env"
fi

# 5. Verificar base de datos
echo "🗄️  Verificando base de datos..."
mkdir -p "$DATA_PATH/system" "$DATA_PATH/events" 2>/dev/null || true

# 6. Mostrar resumen
echo ""
echo "========================================================="
echo "🚀 CHECK PRO v$(node -e "console.log(require('./package.json').version)" 2>/dev/null || echo '?.?.?')"
echo "📍 Puerto: $PORT"
echo "🌐 URL: http://localhost:$PORT"
echo "📁 Datos: $DATA_PATH"
echo "========================================================="
echo ""

# 7. Iniciar aplicación
echo "🚀 Arrancando servidor Node.js en puerto $PORT..."
exec npm start
