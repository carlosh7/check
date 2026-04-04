FROM node:20-slim

WORKDIR /usr/src/app

# Instalar dependencias del sistema necesarias para better-sqlite3 y sharp
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    libvips-dev \
    && rm -rf /var/lib/apt/lists/*

# Copiar package.json y package-lock.jsonpar
COPY package*.json ./

# Copiar .env.example para automatización
COPY .env.example ./

# Instalar todas las dependencias (incluye devDependencies para build tools)
RUN npm install || echo "⚠️ Some optional deps may have failed"

# Verificar que las dependencias críticas estén instaladas
RUN node -e "try { require('better-sqlite3'); console.log('✅ better-sqlite3 OK'); } catch(e) { console.error('❌ better-sqlite3 MISSING'); process.exit(1); }"
RUN node -e "try { require('express'); console.log('✅ express OK'); } catch(e) { console.error('❌ express MISSING'); process.exit(1); }"

# Verificar dependencias opcionales (warning pero no bloquea)
RUN node -e "try { require('sharp'); console.log('✅ sharp OK'); } catch(e) { console.warn('⚠️ sharp no disponible'); }" || true
RUN node -e "try { require('web-push'); console.log('✅ web-push OK'); } catch(e) { console.warn('⚠️ web-push no disponible'); }" || true
RUN node -e "try { require('jspdf'); console.log('✅ jspdf OK'); } catch(e) { console.warn('⚠️ jspdf no disponible'); }" || true

# Crear carpeta data automáticamente
RUN if [ ! -d "data" ]; then mkdir data; fi

# Copiar script de entrada
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Copiar el resto de la aplicación
COPY . .

# Exponer el puerto
EXPOSE 3000

# Usar script de entrada para inicialización automática
ENTRYPOINT ["./docker-entrypoint.sh"]