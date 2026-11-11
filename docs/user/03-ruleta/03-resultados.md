# Resultados y compartir

> **Versión:** v12.44.821+ | **Módulo:** Ruleta

## ¿Para qué sirve?
Realizar el sorteo, ver los resultados y compartir la ruleta con los participantes.

## Realizar el sorteo
1. En el editor de la ruleta, haz clic en **"▶️ Comenzar"** (o directamente en **"🎡 GIRAR"** del preview)
2. La ruleta se abre en la página de juego
3. Haz clic en **"GIRAR"**, **sobre la propia ruleta** o con la **barra espaciadora**
4. Durante el giro:
   - Los nombres aparecen junto al puntero a medida que la rueda pasa
   - Suena un "tick" al cruzar cada segmento (si el sonido está activo)
   - La ruleta se agranda ligeramente
5. Al detenerse, se muestra el **ganador** con confeti (si está activado)

La probabilidad es **idéntica para todos** (ruleta siempre simétrica).

### Controles de la página de juego
- **⛶** pantalla completa
- **🏆** mostrar/ocultar el historial de ganadores de la sesión
- **↻** reiniciar al estado previo al primer giro (devuelve participantes, pesos y lista)
- **🔊/🔇** activar o silenciar el sonido

## Ver resultados
En el editor de la ruleta:
- El historial de ganadores aparece con el botón 🏆 bajo el preview
- Cada giro queda registrado en la base de datos (tabla de giros)

## Compartir la ruleta
1. Guarda la ruleta primero
2. **📱 QR** — genera un código QR del enlace público (ideal para proyectar o imprimir en el salón)
3. Copia el **link público** desde el modal del QR o ábrelo con **▶️ Comenzar**
4. Los participantes pueden girar desde su teléfono con ese enlace

## Estadísticas
Sobre el preview del editor verás: **👁️ visitas · 🔄 giros · 📋 registros**. En la página de juego, el encabezado muestra las mismas cifras.

## Exportar
**📊 Exportar CSV** descarga un archivo con:
- Los participantes (nombre, email, teléfono y fuente)
- Los registros del formulario (leads) capturados en el modo con registro

## Tipos de ruleta

### 🎡 Ruleta Clásica
Los participantes giran directamente, sin necesidad de registrarse.

### 📋 Ruleta con Registro
Los participantes deben completar un formulario (nombre, email) antes de girar. Cada registro queda guardado y aparece en las estadísticas y en el CSV. Se elige con las tarjetas de modo sobre el editor.

## Ver también
- [Crear sorteo](01-crear-sorteo.md)
- [Participantes](02-participantes.md)
