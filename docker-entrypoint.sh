#!/bin/sh
# Universal Entrypoint (v12.44.775) — Auto-port detection
#
# v12.44.847 (auditoría 2026-11-25, I7): este script asumía que corría como root y con bash:
#   - usaba /dev/tcp (que solo existe en bash) para comprobar puertos: bajo sh la comprobación
#     fallaba siempre y el puerto "libre" era el primero, fuera o no cierto;
#   - reescribía APP_URL y ALLOWED_ORIGINS del .env a http://localhost en cada arranque;
#   - hacía chmod -R 777 de todos los datos y abortaba si no podía escribir el .env, así que con
#     un usuario sin root el contenedor entraba en bucle de reinicio.
# Ahora: puertos comprobados con node, sin reescribir URLs, sin 777 y sin depender del .env.
set -e

echo "--------------------------------------------------------"
echo "🔍 DIAGNÓSTICO DE ARRANQUE (Check Pro $(node -e "console.log(require('./package.json').version)" 2>/dev/null || echo '?.?.?'))"
echo "⏱️  Hora: $(date)"
echo "👤 Usuario: $(id)"
echo "📁 Directorio actual: $(pwd)"
echo "--------------------------------------------------------"

# 0. Diagnóstico de Persistencia
if [ ! -z "$DATA_PATH" ]; then
    echo "🔨 Verificando persistencia en $DATA_PATH..."
    mkdir -p "$DATA_PATH/system" "$DATA_PATH/events" "$DATA_PATH/uploads" 2>/dev/null || true
    if date > "$DATA_PATH/ESTOY_VIVO.txt" 2>/dev/null; then
        echo "✅ Escritura en el volumen de datos correcta."
    else
        echo "❌ FALLO: No se pudo escribir en $DATA_PATH (revisa el dueño del directorio)."
    fi
    # ANTES: chmod -R 777 "$DATA_PATH" — dejaba la base de datos escribible por cualquier usuario del host.
else
    echo "⚠️ ADVERTENCIA: DATA_PATH no está definida. Usando almacenamiento interno."
    export DATA_PATH=/usr/src/app/data
    mkdir -p "$DATA_PATH/system" "$DATA_PATH/events" "$DATA_PATH/uploads" 2>/dev/null || true
fi

# 1. Verificar archivo .env (sin abortar si no se puede crear: valen las variables de entorno)
if [ ! -f ".env" ]; then
    if cp .env.example .env 2>/dev/null || touch .env 2>/dev/null; then
        echo "✅ Archivo .env creado desde .env.example"
    else
        echo "⚠️ .env no creado (sin permiso): se usarán las variables de entorno"
    fi
fi
# ¿Se puede escribir el .env? Si no, los ajustes de abajo solo informan.
ENV_WRITABLE=0
if [ -f ".env" ] && [ -w ".env" ]; then
    ENV_WRITABLE=1
fi

# 2. Auto-detección de puerto
# Buscar un puerto libre empezando desde el configurado
DESIRED_PORT=${PORT:-3000}
PORT_FOUND=0

# Función para verificar si un puerto está ocupado (sale 0 si está ocupado, 1 si está libre)
check_port() {
    node -e "const s=require('net').createServer();s.once('error',()=>process.exit(0));s.listen({port:Number(process.argv[1]),host:'localhost'},()=>s.close(()=>process.exit(1)));" "$1"
}

for offset in 0 1 2 3 4 5 6 7 8 9 10; do
    CANDIDATE=$((DESIRED_PORT + offset))
    if ! check_port $CANDIDATE; then
        export PORT=$CANDIDATE
        PORT_FOUND=1
        echo "✅ Puerto disponible: $CANDIDATE"

        # Actualizar .env con el puerto encontrado (solo si es escribible)
        if [ "$ENV_WRITABLE" = "1" ]; then
            sed -i "s/^PORT=.*/PORT=$CANDIDATE/" .env 2>/dev/null || true
        fi

        # ANTES se reescribían aquí APP_URL y ALLOWED_ORIGINS a http://localhost:<puerto>, lo que
        # pisaba la URL real del despliegue en cada arranque. Esos valores se respetan.

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

# 4. Auto-generar secrets si faltan
# Solo si no vienen como variable de entorno Y el .env no los tiene. Sin permiso de escritura se avisa
# (ANTES se imprimía "auto-generado" aunque no se hubiera podido escribir).
echo "🔑 Verificando secrets..."
gen_secret() {
    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
}
write_secret() {
    # $1 = nombre de la variable, $2 = valor. Devuelve 0 solo si quedó escrito en .env.
    if [ "$ENV_WRITABLE" = "1" ]; then
        if sed -i "s/^$1=.*/$1=$2/" .env 2>/dev/null && grep -q "^$1=$2\$" .env 2>/dev/null; then
            return 0
        fi
        echo "$1=$2" >> .env 2>/dev/null
        return $?
    fi
    return 1
}

for SECRET_NAME in JWT_SECRET ENCRYPTION_KEY DEPLOY_WEBHOOK_SECRET; do
    # Valor actual en el entorno (eval indirecto portable en sh)
    eval "SECRET_VALUE=\${$SECRET_NAME:-}"
    if [ ! -z "$SECRET_VALUE" ]; then
        echo "  ✅ $SECRET_NAME viene del entorno"
    elif grep -q "^$SECRET_NAME=.\{32,\}" .env 2>/dev/null; then
        echo "  ✅ $SECRET_NAME ya está en .env"
    elif write_secret "$SECRET_NAME" "$(gen_secret)"; then
        echo "  ✅ $SECRET_NAME auto-generado en .env"
    else
        echo "  ❌ $SECRET_NAME ausente y .env no escribible: defínelo como variable de entorno"
    fi
done

# 5. Verificar base de datos
echo "🗄️  Verificando base de datos..."
mkdir -p "$DATA_PATH/system" "$DATA_PATH/events" 2>/dev/null || true

# 6. Mostrar resumen
echo ""
echo "========================================================="
echo "🚀 CHECK PRO v$(node -e "console.log(require('./package.json').version)" 2>/dev/null || echo '?.?.?')"
echo "📍 Puerto: $PORT"
echo "📁 Datos: $DATA_PATH"
echo "========================================================="
echo ""

# 7. Iniciar aplicación
# v12.44.847: se arranca node directamente (npm necesita un usuario con entrada en /etc/passwd y
# un HOME; la app puede correr con un uid dedicado que no la tiene).
echo "🚀 Arrancando servidor Node.js en puerto $PORT..."
exec node server.js
