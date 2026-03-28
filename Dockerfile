FROM node:20-slim

WORKDIR /usr/src/app

# Instalar dependencias del sistema necesarias para better-sqlite3
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copiar package.json y package-lock.json
COPY package*.json ./

# Copiar .env.example para automatización
COPY .env.example ./

# Instalar todas las dependencias (incluye devDependencies para build tools)
RUN npm install

# Crear carpeta data automáticamente
RUN if [ ! -d "data" ]; then mkdir data; fi

# Copiar el resto de la aplicación
COPY . .

# Exponer el puerto
EXPOSE 3000

# Comando por defecto - inicia el servidor
CMD ["npm", "start"]