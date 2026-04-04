# Instalación con Docker - Check Pro

## 🐳 Instalación en 3 Pasos

### Paso 1: Clonar el repositorio
```bash
git clone https://github.com/carlosh7/check.git
cd check
```

### Paso 2: Construir y ejecutar con Docker Compose
```bash
docker-compose up --build
```

### Paso 3: Acceder a la aplicación
- **URL:** http://localhost:3000
- **Usuario:** admin@check.com
- **Contraseña:** admin123

## ✅ Qué hace automáticamente el contenedor Docker

Al iniciar el contenedor, el script `docker-entrypoint.sh` ejecuta:

1. **Instala dependencias** si no están instaladas
2. **Crea archivo .env** desde .env.example si no existe
3. **Crea directorio data** para la base de datos
4. **Inicializa la base de datos** con todas las tablas
5. **Crea usuario admin** por defecto
6. **Inicia el servidor** automáticamente

## 🔧 Comandos Docker útiles

### Iniciar en segundo plano:
```bash
docker-compose up -d --build
```

### Ver logs:
```bash
docker-compose logs -f
```

### Detener contenedor:
```bash
docker-compose down
```

### Reiniciar con cambios:
```bash
docker-compose down
docker-compose up --build
```

### Acceder al contenedor:
```bash
docker exec -it check-app bash
```

## 📁 Estructura de volúmenes

- `./data` → Base de datos SQLite (persistente)
- `./` → Código fuente (montado para desarrollo)
- `node_modules` → Volumen separado para dependencias

## 🐛 Solución de problemas con Docker

### Error "port already in use"
```bash
# Cambia el puerto en docker-compose.yml
ports:
  - "3001:3000"
```

### Error de permisos en Linux/Mac
```bash
# Da permisos al script de entrada
chmod +x docker-entrypoint.sh
```

### Error al construir la imagen
```bash
# Limpia cache de Docker
docker system prune -a
docker-compose build --no-cache
```

### La base de datos no persiste
Asegúrate de que el volumen `./data` esté mapeado correctamente en `docker-compose.yml`.

### Credenciales no funcionan
El contenedor crea automáticamente el usuario:
- **Email:** admin@check.com
- **Contraseña:** admin123

Si no funciona, reinicia el contenedor:
```bash
docker-compose down
docker-compose up --build
```

## 🚀 Despliegue en producción

Para producción, recomiendo:

1. **Usar variables de entorno reales** en `docker-compose.yml`
2. **Configurar un proxy inverso** (nginx, traefik)
3. **Usar base de datos PostgreSQL** en lugar de SQLite
4. **Configurar backups** de la base de datos

## 📞 Soporte

Si encuentras problemas:
1. Verifica que Docker y Docker Compose estén instalados
2. Revisa los logs: `docker-compose logs -f`
3. Asegúrate de tener permisos de escritura en el directorio
4. Si persiste, crea un issue en GitHub