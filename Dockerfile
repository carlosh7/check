FROM node:20

# Instalar dependencias del sistema necesarias para compilar módulos nativos
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Crear directorio de la app
WORKDIR /usr/src/app

# Instalar dependencias
COPY package*.json ./
# Forzamos la reconstrucción de módulos nativos para el entorno Linux del contenedor
RUN npm install --build-from-source

# Copiar el resto del código
COPY . .

# Exponer el puerto de Express
EXPOSE 3000

CMD ["node", "server.js"]
