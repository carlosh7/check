# Migraciones de base de datos

> **Versión:** v12.44.693+ | **Módulo:** Sistema

## ¿Para qué sirve?
El sistema de migraciones permite actualizar la estructura de la base de datos de forma controlada y reproducible.

## Cómo funciona
- Las migraciones están en la carpeta `migrations/`
- Se ejecutan automáticamente al iniciar el servidor
- Cada migración solo se ejecuta una vez (queda registrada en la tabla `migrations`)
- Soporta archivos `.sql` (SQL directo) y `.js` (lógica programática)

## Crear una nueva migración
1. Crea un archivo en `migrations/` con el formato `XXX_descripcion.sql`
2. Escribe las sentencias SQL necesarias
3. Reinicia el servidor
4. La migración se ejecutará automáticamente

## Ver migraciones aplicadas
Desde consola:
```bash
node -e "const m=require('./src/utils/migrate');console.log('Aplicadas:',m.getApplied());console.log('Pendientes:',m.getPending());"
```

## Notas
- Las migraciones son idempotentes (usar `IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`)
- No eliminar migraciones ya aplicadas
- Las migraciones se ejecutan en orden alfabético
