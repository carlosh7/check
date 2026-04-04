# Infraestructura y Despliegue - Check Pro

> Guía completa para desplegar Check Pro en producción con alto rendimiento y estabilidad.

---

## 📊 Requisitos del Sistema

Para el volumen actual (**50 eventos/mes**, **200-1000 invitados** y **10 usuarios simultáneos**):

| Componente | Especificación Mínima | Recomendado |
| :--- | :--- | :--- |
| **CPU** | 2 vCPUs | 2-4 vCPUs (AMD EPYC / Intel Xeon) |
| **RAM** | 2 GB | **4 GB** |
| **Disco** | 20 GB SSD | **40-80 GB NVMe SSD** |
| **Red** | 100 Mbps | **1 Gbps / 2-4 TB transferencia** |
| **SO** | Ubuntu 20.04+ | **Ubuntu 22.04 o 24.04 LTS** |

> ⚠️ **CRÍTICO:** SQLite depende 100% de la velocidad del disco. **NVMe es obligatorio** para buen rendimiento con check-ins simultáneos.

---

## 🚀 Proveedores Recomendados

| Proveedor | Plan | CPU/RAM/Discos | Precio Aprox. | Ventaja |
| :--- | :--- | :--- | :--- | :--- |
| **Hetzner Cloud** | CPX21 | 2 CPU / 4GB / 40GB NVMe | ~5-6 €/mes | Mejor calidad/precio, hardware AMD EPYC |
| **DigitalOcean** | Basic Premium | 2 CPU / 4GB / 80GB NVMe | ~24 $/mes | Fácil uso, backups integrados |
| **Contabo** | Cloud VPS S | 4 CPU / 8GB / 50GB NVMe | ~6 €/mes | Mucha potencia por poco dinero |
| **AWS** | t3.small | 2 CPU / 2GB / EBS | ~15-20 $/mes | Solo si ya usas ecosistema AWS |

---

## 🏗️ Arquitectura de Despliegue

```
┌─────────────────────────────────────────────┐
│                 Internet                     │
└──────────────────┬──────────────────────────┘
                   │
              ┌────▼────┐
              │ Nginx   │ ← SSL (Let's Encrypt) + Gzip/Brotli
              │ :80/:443│    Reverse Proxy + Protección básica
              └────┬────┘
                   │
              ┌────▼────┐
              │ Docker  │
              │ Compose │
              └────┬────┘
                   │
        ┌──────────┴──────────┐
        │                     │
   ┌────▼────┐          ┌────▼────┐
   │ check-  │          │ watch-  │
   │   app   │          │ tower   │
   │ :3000   │          │ (auto-  │
   └────┬────┘          │ update) │
        │               └─────────┘
   ┌────▼────┐
   │ SQLite  │
   │  DB     │
   └─────────┘
```

### docker-compose.yml para Producción

```yaml
version: '3.8'

services:
  app:
    build: .
    restart: always
    volumes:
      - app_data:/usr/src/app/data
      - app_uploads:/usr/src/app/uploads
    environment:
      - NODE_ENV=production
      - PORT=3000
    networks:
      - internal

  nginx:
    image: nginx:alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    depends_on:
      - app
    networks:
      - internal

volumes:
  app_data:
  app_uploads:

networks:
  internal:
```

### nginx.conf Básico

```nginx
server {
    listen 80;
    server_name tudominio.com;

    location / {
        proxy_pass http://app:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 🛡️ Estrategia de Backups

### Backups Locales (Automáticos)
- El sistema crea backups cada **6 horas** en `data/backups/`
- Limpieza automática de backups mayores a **7 días**

### Backups Remotos (Recomendado)

**Opción 1: Rsync a otro servidor**
```bash
# Script cron (cada día a las 3am)
0 3 * * * rsync -avz /ruta/check/data/backups/ usuario@backup-server:/backups/check/
```

**Opción 2: AWS S3 / Backblaze B2 con rclone**
```bash
# Instalar rclone
curl https://rclone.org/install.sh | sudo bash

# Configurar remoto
rclone config

# Script de backup
#!/bin/bash
rclone copy /ruta/check/data/backups/ remoto:check-backups/ --min-age 1h
```

---

## 📈 Capacidad Estimada

| Métrica | Capacidad con VPS Recomendada |
|---------|-------------------------------|
| Eventos/mes | **500+** |
| Invitados por evento | **2,000+** |
| Usuarios simultáneos | **50+** |
| Check-ins por minuto | **200+** |
| Almacenamiento | **Hasta 50GB de datos** |

---

## ⚡ Optimizaciones de Rendimiento

### 1. SQLite ya está optimizado
- **WAL Mode**: Múltiples lectores + 1 escritor
- **Busy Timeout**: Espera 5 segundos antes de fallar
- **Cache 32MB**: Consultas frecuentes en memoria
- **Synchronous NORMAL**: Balance seguridad/velocidad

### 2. Nginx Compression
```nginx
gzip on;
gzip_types text/plain text/css application/json application/javascript text/xml;
gzip_min_length 1000;
```

### 3. Node.js Production
```bash
NODE_ENV=production
```

---

## 🔄 Actualizaciones

### Manual
```bash
cd /opt/check
git pull origin main
docker-compose up --build -d
```

### Automática (Watchtower)
```yaml
  watchtower:
    image: containrrr/watchtower
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    command: --interval 300 --cleanup
```

---

## 🚨 Cuándo Migrar a PostgreSQL

Solo considera migrar si:
1. ✅ Superas **50GB de datos** en SQLite
2. ✅ Necesitas **miles de escrituras por segundo** simultáneas
3. ✅ Quieres **múltiples servidores** de app compartiendo BD
4. ✅ Eventos masivos de **50,000+ personas** entrando en 10 minutos

Para tu volumen actual, **SQLite es la mejor opción**: más rápido en lectura, cero mantenimiento, un solo archivo.

---

*Documento creado: Abril 2026 | Versión del sistema: 12.44.60*
