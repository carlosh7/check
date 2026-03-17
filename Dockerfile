FROM node:18-slim

# Crear directorio de la app
WORKDIR /usr/src/app

# Instalar dependencias
COPY package*.json ./
RUN npm install

# Copiar el resto del código
COPY . .

# Exponer el puerto de Express
EXPOSE 3000

CMD ["node", "server.js"]
