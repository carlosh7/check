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
RUN npm install

# Forzar compilación de sharp (requiere libvips-dev ya instalado)
RUN npm rebuild sharp --build-from-source || echo "Sharp rebuild failed, using prebuilt"

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