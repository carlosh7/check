# Instalación Rápida de Check Pro

## 🚀 Instalación en 2 Pasos

### Paso 1: Clonar el repositorio
```bash
git clone https://github.com/carlosh7/check.git
cd check
```

### Paso 2: Ejecutar configuración automática

#### Windows:
Haz doble clic en `setup.bat`

#### Linux/Mac:
```bash
node setup.js
```

## ✅ Qué hace el script automático

El script `setup.js` automatiza todo el proceso:

1. **Verifica Node.js** - Comprueba que esté instalado
2. **Crea archivo .env** - Usa `.env.example` como plantilla
3. **Instala dependencias** - Ejecuta `npm install`
4. **Crea directorios necesarios** - Incluyendo `data/`
5. **Inicializa base de datos** - Crea todas las tablas
6. **Crea usuario admin** - `admin@check.com` / `admin123`
7. **Inicia el servidor** - En puerto 3000 por defecto

## 🌐 Acceso a la aplicación

Una vez completada la instalación:

- **URL:** http://localhost:3000
- **Usuario:** admin@check.com
- **Contraseña:** admin123

## 🔧 Configuración personalizada

Si necesitas cambiar configuraciones:

1. Edita el archivo `.env`
2. Cambia puerto, JWT secret, etc.
3. Reinicia el servidor

## 🐛 Solución de problemas

### Si el script falla:
1. Verifica que Node.js esté instalado: `node --version`
2. Asegúrate de tener permisos de escritura
3. Ejecuta manualmente: `npm install && node server.js`

### Si la aplicación no carga eventos:
1. Detén el servidor (Ctrl+C)
2. Elimina `data/check_app.db`
3. Ejecuta `node setup.js` de nuevo

## 📞 Soporte

Para ayuda adicional:
- Revisa `README.md` para documentación completa
- Consulta la sección de solución de problemas
- Crea un issue en GitHub si persiste el problema