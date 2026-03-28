# Guía para Clonar y Ejecutar con Docker

## Problema Resuelto
Anteriormente, al clonar el repositorio en Windows, el archivo `docker-entrypoint.sh` tenía terminadores de línea CRLF (Windows) que causaban el error:
```
exec ./docker-entrypoint.sh: no such file or directory
```

## Solución Implementada
Se agregó un archivo `.gitattributes` que fuerza terminadores LF (Unix) para:
- Todos los scripts bash (`*.sh`)
- Archivos de configuración
- Archivos de código fuente

## Cómo Clonar y Ejecutar Ahora

### 1. Clonar el repositorio
```bash
git clone https://github.com/carlosh7/check.git check
cd check
```

### 2. Ejecutar con Docker Compose
```bash
docker-compose up --build -d
```

### 3. Verificar que funciona
```bash
# Ver estado del contenedor
docker-compose ps

# Verificar salud del servidor
curl http://localhost:3000/api/health

# Ver logs
docker-compose logs -f
```

### 4. Acceder a la aplicación
- **URL:** http://localhost:3000
- **Usuario:** admin@check.com
- **Contraseña:** admin123

## Script de Prueba
Incluimos un script para verificar que el clon funciona automáticamente:
```bash
# Ejecutar script de prueba (Linux/macOS/WSL)
chmod +x test-docker-clone.sh
./test-docker-clone.sh
```

## Detalles Técnicos

### Archivo `.gitattributes`
El archivo `.gitattributes` contiene:
```gitattributes
# Scripts bash - siempre usar LF
*.sh text eol=lf

# Archivos de texto - usar LF
* text=auto

# Scripts de Windows - usar CRLF
*.bat text eol=crlf
*.cmd text eol=crlf
```

### ¿Por qué es importante?
- **Linux/Contenedores Docker:** Requieren terminadores LF
- **Windows:** Por defecto usa CRLF
- **Git con `.gitattributes`:** Convierte automáticamente según el sistema

## Solución de Problemas

### Si aún hay problemas con terminadores de línea:
```bash
# Convertir manualmente (si es necesario)
dos2unix docker-entrypoint.sh

# O usar sed
sed -i 's/\r$//' docker-entrypoint.sh
```

### Si Docker no inicia:
```bash
# Ver logs detallados
docker-compose logs -f

# Reconstruir completamente
docker-compose down
docker-compose up --build
```

## Validación
El sistema ahora está configurado para que:
1. Git mantenga terminadores LF en scripts bash
2. Docker funcione automáticamente después del clon
3. No se requieran conversiones manuales

**Versión actual:** 12.31.49
**Última actualización:** 28 de marzo de 2026