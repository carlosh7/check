# Promociones — los 4 juegos (paridad AppSorteos)

> **Versión:** v12.44.834+ | **Módulo:** Promociones

## ¿Para qué sirve?
Crear **juegos promocionales con captura de leads** (paridad AppSorteos): cada visitante
deja su email, juega una vez y gana un premio, cupón o mensaje. Tú obtienes los leads
con exportación CSV — sin límites de vistas ni candados (AppSorteos cobra por vistas,
campañas activas y bloquea las funciones avanzadas; aquí todo va incluido).

**Diferencia con la Ruleta de Sorteos** (pestaña "Sorteos"): la de Sorteos elige UN
ganador entre una lista de participantes; los juegos de Promociones son individuales:
cada persona juega y recibe lo que le toque por probabilidades.

## Los 4 juegos

| Juego | Mecánica | Icono en la lista |
|-------|----------|-------------------|
| **🎡 Ruleta de la Fortuna** | Gira una ruleta de premios y cae en una sección | Ruleta de la Fortuna |
| **🎫 Raspa y Gana** | Aparece una tarjeta con capa dorada que se **raspa** con el dedo/mouse; al descubrir >55% se revela el premio | Raspa y Gana |
| **🧠 Trivia** | Cuestionario de preguntas con puntuación, nota de aprobación y premio al aprobar | Trivia |
| **🎰 Tragamonedas** | Máquina de **3 rodillos con palanca**: jala y la combinación decide tu premio | Tragamonedas |

Todos comparten: formulario de registro configurable (email siempre + nombre/apellido/
teléfono/consentimiento opcionales), premios por tipo (Sin Premio/Premio/**Cupón**/
**Enlace**), probabilidades (Limitar chances %) y stock (Limitar cantidades), seguridad
(máx. participaciones por email, whitelist, límite por dispositivo), textos editables,
idiomas, comprobante PDF, compartir y jugar de nuevo.

## Específicas de cada juego

### 🎫 Raspa y Gana
- **Color de Raspadita** (la capa dorada) configurable y texto de la tarjeta
- El jugador raspa con el dedo o el mouse; al descubrir más de la mitad, el resto se
  revela solo

### 🧠 Trivia
- **3 tipos** al crear: Opciones Múltiples (hasta 4 respuestas), Sí/No, y Cuestionario
  (sin respuestas correctas, para reseñas)
- Preguntas una a una o **pegando un CSV** con el formato `pregunta;r1;r2;r3;r4;índice_correcto`
- **Límite de tiempo por pregunta** (10–120 s, con auto-avance), **nota de aprobación**
  (30–100%), retroalimentación (nada / la elegida / elegida + correcta), indicadores
  A-B-C-D o 1-2-3-4, mezclar preguntas/respuestas, música
- Página final con **[score]** (como "92%" o "10/13") y botón Reintentar
- **Premio al aprobar**: si configuras `premio al aprobar` (cupón/premio/enlace), solo
  quien alcance la nota lo recibe

### 🎰 Tragamonedas
- Cada premio tiene **su combinación de 3 símbolos** (ej. `7️⃣,7️⃣,7️⃣` para el premio mayor)
- **Estilo de máquina**: Redondeada / Semi-redondeada / Cuadrada + color del mueble
- La palanca se jala y los rodillos caen en la combinación (paradas escalonadas, una a
  una como en la máquina real)
- El comprobante PDF muestra la combinación con nombres legibles (el PDF no dibuja emojis)

## Cómo se usa

### 1. Crear la promoción
1. **Configuración del Evento** > grupo **"✨ Experiencia"** > pestaña **"Promociones"**
2. Elige el tipo con los botones (🎡 Fortuna / 🎫 Raspa / 🧠 Trivia / 🎰 Tragamonedas)
3. **"Nueva Promoción"** → nombre → se abre el editor

### 2. Configurar (paneles como AppSorteos)
- **⚙️ General**: nombre, idioma (7), textos editables (título, descripción, botón,
  ganador y perdedor), sonidos, compartir, comprobante, jugar de nuevo, duración
- **🎁 Premios**: la tabla de secciones de la ruleta — cada una con **Tipo**
  (Sin Premio / Premio / **Cupón** / **Enlace**), texto en la ruleta y **Valor**
  (código del cupón o URL). Opciones premium en AppSorteos, gratis aquí:
  **🎯 Limitar chances** (% de probabilidad por sección) y **📦 Limitar cantidades**
  (stock que se descuenta al ganarse)
- **🎨 Diseño**: 10 temas con nombre (Magenta, Cielo, Medianoche…), fondo, puntero,
  bordes, centro con logo, colores del formulario
- **🛡️ Seguridad**: participaciones máximas por email (1 por defecto), whitelist de
  emails permitidos, límite por navegador o IP
- **📝 Formulario**: pedir Nombre, Apellido, Teléfono y casilla de consentimiento
  (el email siempre se pide)

### 3. Publicar y compartir
1. **💾 Guardar** y **🚀 Publicar** — se abre la página de juego lista
2. Comparte el **enlace de juego** (o su QR desde el editor: vista previa → Compartir)
3. El enlace del **editor** también funciona sin clave para promociones publicadas
   (misma política que la ruleta)

### 4. Ver los leads
- Lista de la promoción → botón 📥 → **CSV** con email, nombre, premio y fecha
- También: editar, publicar/despublicar y eliminar desde la lista

## Preguntas frecuentes

**¿Cómo funcionan las probabilidades?** Con "Limitar chances" activado, cada sección
tiene un % de probabilidad; sin ello, todas salen con la misma frecuencia. Con
"Limitar cantidades", un premio con stock 0 deja de salir.

**¿Puede el mismo email jugar dos veces?** Solo si subes "Participaciones máximas por
email" (por defecto 1, como el original).

**¿El visitante ve los códigos de cupón de todas las secciones?** No — la página de
juego solo recibe los textos de las secciones; el valor/código llega únicamente al
ganador, desde el servidor.

**¿Qué pasa cuando un cupón se agota?** Si activaste "Limitar cantidades", la sección
deja de salir y la ruleta reparte entre las restantes.
