# Importar invitados

> **Versión:** v12.44.671+ | **Módulo:** Invitados

## ¿Para qué sirve?
Agregar invitados a un evento de forma masiva desde un archivo Excel (.xlsx), CSV o PDF.

## Requisitos previos
- [ ] Tener un evento creado
- [ ] Archivo con datos de los invitados (Excel o CSV con columnas: nombre, email, etc.)
- [ ] Rol **ADMIN**, **PRODUCTOR** u **ORGANIZER** del evento

## Pasos — Importación simple

### 1. Abrir importación
Ve a la **Configuración del Evento** > pestaña **"Invitados"** > botón **"Importar"**.

### 2. Arrastrar o seleccionar archivo
Arrastra tu archivo Excel al área punteada o haz clic para seleccionarlo.

### 3. Mapear columnas (si es necesario)
El sistema detecta automáticamente qué columna corresponde a cada campo (nombre, email, teléfono, etc.). Revisa el mapeo y ajústalo si es necesario.

### 4. Vista previa
Se muestran las primeras filas del archivo. Usa los botones ‹ › para navegar. Revisa que los datos se vean correctos.

### 5. Importar
Haz clic en **"Importar"**. El sistema:
- Crea los invitados nuevos
- **Actualiza los existentes** (detectados por email o teléfono)
- Muestra un resumen: X nuevos, Y actualizados

### 6. Verificar
Ve a la tabla de invitados del evento para ver los resultados.

## Detección de duplicados
El sistema detecta duplicados por:
- **Email** — coincidencia exacta
- **Teléfono** — coincidencia de dígitos
- **Nombre** — coincidencia parcial

Puedes elegir **"Ignorar duplicados"** (no importarlos) o dejarlo activo para que los actualice.

## Formatos soportados
| Formato | Extensión | Notas |
|---------|-----------|-------|
| Excel | .xlsx, .xls | Recomendado, soporta múltiples columnas |
| CSV | .csv | Columnas separadas por coma |
| PDF | .pdf | Solo extracción básica de texto |

## Solución de problemas
- **"No se encontró una hoja válida"** — asegúrate de que el Excel tenga una hoja llamada "Asistentes" o usa la primera hoja
- **"Error validando archivo"** — verifica que el archivo no esté corrupto y tenga encabezados en la primera fila
- **Duplicados inesperados** — revisa que los emails estén escritos correctamente en el archivo

## Ver también
- [Categorías](03-categorias.md)
- [Check-in](02-checkin.md)
- [Exportar invitados](04-exportar.md)
