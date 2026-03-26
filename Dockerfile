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

# Instalar dependencias
RUN npm ci --only=production

# Copiar el resto de la aplicación
COPY . .

# Exponer el puerto
EXPOSE 3000

# Comando por defecto
CMD ["node", "server.js"]