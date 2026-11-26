FROM node:22-slim

WORKDIR /usr/src/app

# v12.44.847 (auditoría 2026-11-25, I2): la app corría como root. Usuario propio, sin shell ni contraseña (uid fijo para poder
# darle la propiedad del volumen de datos desde el host: chown -R 10001:10001 <datos>).
RUN groupadd -g 10001 checkapp && useradd -u 10001 -g checkapp -M -s /usr/sbin/nologin -d /usr/src/app checkapp

# Instalar dependencias del sistema necesarias para better-sqlite3 y sharp
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    libvips-dev \
    && rm -rf /var/lib/apt/lists/*

# Copiar package.json y package-lock.json
COPY package*.json ./

# Copiar .env.example para automatización
COPY .env.example ./

# Instalar dependencias.
# v12.44.847 (auditoría 2026-11-25, I7): antes era `npm install || echo ...`: si la instalación fallaba, la imagen se construía
# igual y el fallo aparecía al arrancar. Ahora la construcción falla si no se instalan.
RUN npm ci || npm install

# Verificar que las dependencias críticas estén instaladas
RUN node -e "try { require('better-sqlite3'); console.log('✅ better-sqlite3 OK'); } catch(e) { console.error('❌ better-sqlite3 MISSING'); process.exit(1); }"
RUN node -e "try { require('express'); console.log('✅ express OK'); } catch(e) { console.error('❌ express MISSING'); process.exit(1); }"

# Verificar dependencias opcionales (warning pero no bloquea)
RUN node -e "try { require('sharp'); console.log('✅ sharp OK'); } catch(e) { console.warn('⚠️ sharp no disponible'); }" || true
RUN node -e "try { require('web-push'); console.log('✅ web-push OK'); } catch(e) { console.warn('⚠️ web-push no disponible'); }" || true
RUN node -e "try { require('jspdf'); console.log('✅ jspdf OK'); } catch(e) { console.warn('⚠️ jspdf no disponible'); }" || true

# Crear carpeta data automáticamente
RUN if [ ! -d "data" ]; then mkdir -p data/system data/events data/uploads; fi
RUN chown -R 10001:10001 /usr/src/app/data

# Copiar script de entrada
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Copiar el resto de la aplicación (con el usuario de la app como dueño)
COPY --chown=10001:10001 . .

# Exponer puerto (variable de entorno)
ARG PORT=3000
EXPOSE $PORT

# Health check — verifica que la app responda cada 30s
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e "require('http').get('http://localhost:${PORT:-3000}/api/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# v12.44.847 (auditoría 2026-11-25, I2): el proceso de la app ya no es root
USER checkapp

# Usar script de entrada para inicialización automática
ENTRYPOINT ["./docker-entrypoint.sh"]
