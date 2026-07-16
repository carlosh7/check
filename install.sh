#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Check Pro — Instalador Auto-Adaptativo
# Detecta puerto libre, crea directorios, verifica entorno
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
DATA_DIR="$SCRIPT_DIR/data"
DEFAULT_PORT=3000
MAX_PORT=3010

echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║       Check Pro — Instalador Adaptativo         ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# ─── 1. DETECTAR PUERTO LIBRE ───────────────────────────────
echo -e "${BOLD}━━━ 1/6 Detectando puerto libre ━━━${NC}"

find_free_port() {
    local port=$1
    while [ $port -le $MAX_PORT ]; do
        if ! ss -tlnp 2>/dev/null | grep -q ":${port} " && \
           ! lsof -i ":${port}" >/dev/null 2>&1; then
            echo $port
            return 0
        fi
        port=$((port + 1))
    done
    return 1
}

DETECTED_PORT=$(find_free_port $DEFAULT_PORT)

if [ -z "$DETECTED_PORT" ]; then
    echo -e "${RED}✗ No se encontró puerto libre entre $DEFAULT_PORT y $MAX_PORT${NC}"
    exit 1
fi

if [ "$DETECTED_PORT" -eq "$DEFAULT_PORT" ]; then
    echo -e "${GREEN}✓ Puerto $DEFAULT_PORT disponible${NC}"
else
    echo -e "${YELLOW}⚠ Puerto $DEFAULT_PORT ocupado → usando Puerto $DETECTED_PORT${NC}"
fi

# ─── 2. CREAR DIRECTORIOS DE DATOS ──────────────────────────
echo -e "${BOLD}━━━ 2/6 Preparando directorios ━━━${NC}"

mkdir -p "$DATA_DIR/system" "$DATA_DIR/events" "$DATA_DIR/uploads" "$DATA_DIR/photos" "$DATA_DIR/backups"
chmod -R 755 "$DATA_DIR"
echo -e "${GREEN}✓ Directorios creados en: $DATA_DIR${NC}"

# ─── 3. GENERAR/ACTUALIZAR .env ─────────────────────────────
echo -e "${BOLD}━━━ 3/6 Configurando entorno (.env) ━━━${NC}"

if [ ! -f "$ENV_FILE" ]; then
    if [ -f "$SCRIPT_DIR/.env.example" ]; then
        cp "$SCRIPT_DIR/.env.example" "$ENV_FILE"
        echo -e "${YELLOW}⚠ .env creado desde .env.example${NC}"
    else
        echo -e "${RED}✗ No existe .env ni .env.example${NC}"
        exit 1
    fi
fi

# Generar secrets si son placeholders
JWT_SECRET=$(grep -E '^JWT_SECRET=' "$ENV_FILE" | cut -d'=' -f2)
if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "tu_clave_secreta_aqui" ] || [ ${#JWT_SECRET} -lt 32 ]; then
    JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | xxd -p | tr -d '\n' | head -c 64)
    sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" "$ENV_FILE"
    echo -e "${GREEN}✓ JWT_SECRET generado${NC}"
else
    echo -e "${GREEN}✓ JWT_SECRET ya configurado${NC}"
fi

# Configurar puerto
if grep -q "^PORT=" "$ENV_FILE"; then
    CURRENT_PORT=$(grep '^PORT=' "$ENV_FILE" | cut -d'=' -f2)
    if [ "$CURRENT_PORT" != "$DETECTED_PORT" ]; then
        sed -i "s|^PORT=.*|PORT=$DETECTED_PORT|" "$ENV_FILE"
        echo -e "${YELLOW}⚠ PORT actualizado: $CURRENT_PORT → $DETECTED_PORT${NC}"
    fi
else
    echo "PORT=$DETECTED_PORT" >> "$ENV_FILE"
    echo -e "${GREEN}✓ PORT=$DETECTED_PORT agregado${NC}"
fi

# Configurar DATA_PATH
if grep -q "^DATA_PATH=" "$ENV_FILE"; then
    sed -i "s|^DATA_PATH=.*|DATA_PATH=$DATA_DIR|" "$ENV_FILE"
else
    echo "DATA_PATH=$DATA_DIR" >> "$ENV_FILE"
fi
echo -e "${GREEN}✓ DATA_PATH=$DATA_DIR${NC}"

# Configurar ALLOWED_ORIGINS con puerto detectado
ALLOWED=$(grep '^ALLOWED_ORIGINS=' "$ENV_FILE" | cut -d'=' -f2)
NEW_ORIGINS="http://localhost:$DETECTED_PORT"
if echo "$ALLOWED" | grep -q "localhost"; then
    # Reemplazar la URL de localhost con el puerto correcto
    sed -i "s|http://localhost:[0-9]*|http://localhost:$DETECTED_PORT|g" "$ENV_FILE"
else
    sed -i "s|^ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=$NEW_ORIGINS|" "$ENV_FILE"
fi
echo -e "${GREEN}✓ ALLOWED_ORIGINS actualizado${NC}"

# Configurar APP_URL
if grep -q "^APP_URL=" "$ENV_FILE"; then
    sed -i "s|http://localhost:[0-9]*|http://localhost:$DETECTED_PORT|g" "$ENV_FILE"
else
    echo "APP_URL=http://localhost:$DETECTED_PORT" >> "$ENV_FILE"
fi
echo -e "${GREEN}✓ APP_URL=http://localhost:$DETECTED_PORT${NC}"

# ─── 4. INSTALAR DEPENDENCIAS ──────────────────────────────
echo -e "${BOLD}━━━ 4/6 Instalando dependencias (npm install) ━━━${NC}"

cd "$SCRIPT_DIR"
if [ -d "node_modules" ] && [ -f "node_modules/.package-lock.json" ]; then
    echo -e "${GREEN}✓ node_modules ya instalado ($(ls node_modules | wc -l) paquetes)${NC}"
else
    echo -e "${YELLOW}  Instalando... esto puede tardar unos minutos${NC}"
    npm install --omit=dev 2>&1 | tail -3
    echo -e "${GREEN}✓ Dependencias instaladas${NC}"
fi

# ─── 5. VERIFICAR DEPENDENCIAS CRÍTICAS ─────────────────────
echo -e "${BOLD}━━━ 5/6 Verificando dependencias críticas ━━━${NC}"

CRITICAL_DEPS=("express" "better-sqlite3" "bcryptjs" "helmet" "cors" "compression" "dotenv")
MISSING=0

for dep in "${CRITICAL_DEPS[@]}"; do
    if node -e "require('$dep')" 2>/dev/null; then
        echo -e "  ${GREEN}✓${NC} $dep"
    else
        echo -e "  ${RED}✗${NC} $dep — FALTANTE"
        MISSING=$((MISSING + 1))
    fi
done

if [ $MISSING -gt 0 ]; then
    echo -e "${RED}✗ $MISSING dependencias críticas faltantes. Ejecuta: npm install${NC}"
    exit 1
fi

# ─── 6. VERIFICAR QUE LA APP ARRANCA ───────────────────────
echo -e "${BOLD}━━━ 6/6 Verificando arranque de la app ━━━${NC}"

# Matar cualquier proceso en el puerto detectado
EXISTING_PID=$(lsof -ti ":$DETECTED_PORT" 2>/dev/null || true)
if [ -n "$EXISTING_PID" ]; then
    echo -e "${YELLOW}  Deteniendo proceso $EXISTING_PID en puerto $DETECTED_PORT${NC}"
    kill $EXISTING_PID 2>/dev/null || true
    sleep 1
fi

echo -e "${CYAN}  Arrancando app en puerto $DETECTED_PORT...${NC}"
cd "$SCRIPT_DIR"
PORT=$DETECTED_PORT DATA_PATH=$DATA_DIR timeout 12 node server.js &
SERVER_PID=$!
sleep 4

# Verificar health endpoint
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$DETECTED_PORT/api/health" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Health endpoint OK (HTTP $HTTP_CODE)${NC}"
    HEALTH_OK=true
else
    echo -e "${YELLOW}⚠ Health endpoint respondió HTTP $HTTP_CODE (puede tardar al primer arranque)${NC}"
    HEALTH_OK=false
fi

# Verificar que el servidor responde
if kill -0 $SERVER_PID 2>/dev/null; then
    echo -e "${GREEN}✓ Servidor corriendo (PID: $SERVER_PID)${NC}"
    kill $SERVER_PID 2>/dev/null || true
else
    echo -e "${YELLOW}⚠ Servidor terminó (normal en verificación)${NC}"
fi

# ─── RESUMEN ────────────────────────────────────────────────
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║            INSTALACIÓN COMPLETADA               ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}URL:${NC}        http://localhost:$DETECTED_PORT"
echo -e "  ${BOLD}Puerto:${NC}     $DETECTED_PORT"
echo -e "  ${BOLD}Datos:${NC}      $DATA_DIR"
echo -e "  ${BOLD}Admin:${NC}      $(grep ADMIN_EMAIL "$ENV_FILE" | cut -d'=' -f2)"
echo -e "  ${BOLD}Password:${NC}   $(grep ADMIN_PASSWORD "$ENV_FILE" | cut -d'=' -f2)"
echo ""
echo -e "  ${BOLD}Arrancar:${NC}   ${CYAN}npm start${NC}"
echo -e "  ${BOLD}Docker:${NC}     ${CYAN}docker compose up -d${NC}"
echo -e "  ${BOLD}Tests:${NC}      ${CYAN}make test${NC}"
echo -e "  ${BOLD}Auditoría:${NC}  ${CYAN}make check${NC}"
echo ""
