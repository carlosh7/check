# REA — Análisis de los 4 Juegos de Promociones de AppSorteos (para Check Pro)

**Fecha:** 2026-11-13
**Autor:** sesión de análisis interactiva (agente + Carlos)
**Cuenta de prueba:** carlosh7@gmail.com en app-sorteos.com (plan Free) — *la contraseña
NO se registra en este archivo por regla de seguridad.*
**Método:** exploración real del panel `dash.app-sorteos.com` → sección **Promociones**,
editores de cada juego (incluidas 2 promociones reales de Carlos: "RASPA Y GANA" y
"DFBRTS" Tragamonedas Activa) con capturas de pantalla.

---

## 1. Qué es "Promociones" en AppSorteos

Módulo de **juegos promocionales con captura de leads**: cada juego es una página pública
donde un visitante deja su email (formulario configurable), juega una vez y recibe un
premio/cupón/mensaje. El anfitrión obtiene los emails ("leads") y estadísticas de vistas.

**Los 4 juegos** (`dash.app-sorteos.com/promotions/wizard/...`):
1. **Ruleta de la Fortuna** (`fortune-wheel`)
2. **Raspa y Gana** (`scratch`)
3. **Trivia** (`trivia`)
4. **Tragamonedas** (`slot-machine`)

## 2. Estructura común a los 4 juegos (patrón de la plataforma)

### 2.1 Asistente de creación (wizard)
Cada juego arranca con 1–2 pasos de plantilla y luego cae en el mismo editor:
- Ruleta: **10 plantillas de color con nombre** (Magenta, Cielo, Medianoche, Lavanda,
  Grafito, Malva, Menta, Coral, Bosque, Hielo).
- Trivia: **3 tipos de trivia** (ver §5).

### 2.2 Editor (pestañas superiores)
| Pestaña | Contenido |
|---------|-----------|
| **Resumen** (#stats) | estadísticas de vistas/participaciones |
| **Personalizar** (#design) | paneles acordeón (ver §2.3) |
| **Usuarios** (#results) | tabla de participantes/leads; estado vacío: "No hay registro de participaciones aún" + botón Compartir |
| **Compartir** (#share) | enlace público, vista previa `/promotions/preview/{código}` |
| **Integraciones** (#integrations) | conexiones externas |

Encabezado: nombre editable, badge de estado (Activa/Pausada), botón **Publicar**, ojo de
vista previa. Acciones por promoción en la lista: **Editar / Duplicar / Eliminar**.

### 2.3 Paneles acordeón de "Personalizar" (idénticos en los 4 juegos salvo diseño)

**General:**
- Nombre · Estado (Activa/Pausada) · **Idioma** (English, Español, Português, Français,
  Türkçe, Deutsch, 日本語)
- **Mostrar botón de jugar de nuevo**: Automático (por participaciones) / Nunca / Siempre
  / Solo cuando gana / Solo cuando pierde
- Checkboxes: Emitir Sonidos (✓ por defecto) · Reiniciar juego automáticamente ·
  **Descargar Comprobante** · Mostrar botones para compartir

**Premios:**
- Checkboxes premium: **Limitar chances** y **Limitar cantidades**
- Tabla de premios (hasta **30**; plan gratis menos): columnas **Tipo** (Sin Premio /
  Premio / **Cupón** / **Enlace**) · Texto en el juego · **Valor** (ej. código de cupón
  `SAVE20`)
- Plantilla por defecto trae ejemplos (Cupón "20% de descuento" SAVE20, Sin Premio
  "¡Sigue intentando!", etc.)

**Diseño** (común): Temas (10–11 paletas "Aa") · FONDO: Imagen de Fondo (1920×1080
recomendado) + **Transparencia** (slider) + Color de Fondo · FORMULARIO: Tipografía
(8 fuentes: Open Sans, Assistant, Arial, Lato, Montserrat, Roboto, Raleway, Poppins,
Noto Sans), Color de Texto, Botones & Enlaces, Estilo de Botón (Sólido/Contorno),
Bordes Redondeados (slider).

**Diseño específico por juego:**
- Ruleta → RULETA: Color de Segmentos, Color de Ruleta, Color de Puntero, Tipografía,
  Color de Texto (Auto), **Centro de Ruleta** (imagen), Grosor de Línea (slider)
- Raspa → RASPA Y GANA: **Color de Raspadita**, Tipografía
- Tragamonedas → TRAGAMONEDAS: Color de Tragamonedas, **Estilo** (Redondeada /
  Semi-redondeada / Cuadrada), Tipografía
- Trivia → Diseño y Colores dentro del propio formulario de configuración (Temas + Logo)

**Logos:** Imagen del juego (ruleta 200×200) · Logo (380×80) · **Eliminar marca de agua**
(premium).

**Textos** (7 campos editables con valores por defecto según el juego):
- Título · Descripción (viñetas) · Botón Comenzar ("Probar Suerte")
- Título Ganador ("Felicitaciones, ¡has ganado!") · Descripción Ganador ("Te
  contactaremos por email…")
- Título Perdedor ("¡Oh! Parece que has perdido") · Descripción Perdedor

**Formulario de Registro** (activable; email activo por defecto):
- Campos: Email ✓ · Nombre · Apellido · **Nombre Completo 🔒 · Teléfono 🔒 ·
  Campo Personalizado ×2 🔒** (los avanzados son premium)
- Casilla de verificación (consentimiento)

**Seguridad:**
- **Participaciones máximas** por email (spinbutton, 1 por defecto)
- **Emails permitidos** (whitelist, uno por línea)
- **Limitar por Dispositivos**: Desactivado / Navegador-IP / Sólo IP

**Emails** (premium 🔒): envío automático al ganar · Logo · Remitente · Responder a ·
Asunto ("🎁 ¡Aquí tienes tu premio!") · Primera Línea · Texto Principal · Previsualizar.

**Vista Previa** (en vivo, al lado del editor): selector **Formulario / Página Ganadores
/ Página Perdedores** + toggles escritorio/tablet/celular. Marca de agua "Creado con
AppSorteos" en la esquina inferior.

### 2.4 Límites del plan Free observados
- **Vistas totales: 0 / 100** (se renuevan cada mes) · **Promociones activas: 1 / 1**
- Modal de planes: Starter (2 campañas / 1.000 impresiones) · Creator (5 campañas /
  17.500 impresiones + limitar chances/cantidades + formulario avanzado)
- Bloqueados con candado: campos avanzados del formulario, limitar chances/cantidades,
  emails automáticos, quitar marca de agua

## 3. Juego 1 — Ruleta de la Fortuna

- Página pública: formulario (email) → **gira una vez** → resultado (premio/cupón/perder)
  → página de ganador (con el premio y, si es cupón, su código) o perdedor → botón de
  jugar de nuevo según configuración.
- Segmentos = la tabla de Premios (§2.3): cada segmento muestra el "Texto en Ruleta" y
  tiene Tipo y Valor. **La probabilidad de cada segmento la controla la plataforma**
  (limitar chances/cantidades es premium).
- Diseño visual observado: 8 segmentos alternando tonos del tema, puntero triangular
  arriba, centro con logo, formulario a la derecha del canvas.

## 4. Juego 2 — Raspa y Gana

- Página pública: formulario (email) → aparece **una tarjeta con zona dorada que se
  raspa** (con el dedo/ratón) revelando el premio → páginas de ganador/perdedor como la
  ruleta.
- Diseño específico: **Color de Raspadita** (el dorado de la zona), transparencia del
  fondo, tarjeta naranja sobre fondo morado en la plantilla de Carlos.
- Mismos premios (Tipo/Texto/Valor), mismos paneles y seguridad.

## 5. Juego 3 — Trivia

**3 tipos de trivia** (primer paso del wizard):
1. **Opciones Múltiples** — hasta 4 respuestas por pregunta, solo 1 correcta
2. **Sí / No** — 2 opciones (Sí/No, V/F u otras)
3. **Cuestionario** — opciones múltiples **sin respuestas correctas ni puntuación**
   (para reseñas/feedback de productos)

**Preguntas:**
- Editor modal "Nueva Pregunta": texto + imagen opcional + **4 respuestas con radio de
  correcta** (la 1ª marcada por defecto; los radios se habilitan al llenar los textos)
- **Cargar preguntas desde archivo CSV** (botón específico)
- Lista numerada de preguntas con edición/eliminación por fila

**Configuración del Cuestionario:**
- Reproducir música de fondo · Mezclar preguntas al inicio · Mezclar respuestas al inicio
- Mostrar número de preguntas (✓)
- **Retroalimentación de respuestas**: No mostrar nada / Solo la seleccionada /
  Seleccionada + correcta
- **Indicador de respuesta**: Sin indicador / Letras (A, B, C, D) / Números (1, 2, 3, 4)
- **Límite de tiempo por pregunta**: Sin límite / 10 / 15 / 20 / 30 / 45 / 60 / 90 / 120 s
- **Nota de aprobación**: Sin nota / 30% / 40% / 50% / 60% / 70% / 75% / 80% / 90% / 100%

**Página de Bienvenida:** Título ("Bienvenido al Quiz") · Descripción · Botón de Inicio
("Comenzar") · Formulario de Registro (opcional).

**Página de Finalización:** Mensaje final con **código corto `[score]`** para incrustar
la puntuación · Mostrar puntuación: No mostrar / **Porcentaje (92%)** / **Fracción
(10/13)** · Botón final: Sin botón / **Reintentar** / Redirección personalizada ·
Compartir.

**NOTA CLAVE:** esta Trivia es **individual y asíncrona** (cada visitante juega solo,
con leads) — diferente de nuestro "Quiz en vivo" (multi-jugador en tiempo real). Son
productos complementarios, no el mismo.

## 6. Juego 4 — Tragamonedas

- Página pública: formulario (email) → **máquina tragamonedas de 3 rodillos con palanca**
  (el usuario "jala la palanca") → los rodillos giran y combinan símbolos (frutas, 7
  rojo…) → premio/perder según combinación.
- Diseño específico: **Color de Tragamonedas** y **Estilo** (Redondeada / Semi-redondeada
  / Cuadrada); la máquina es un mueble amarillo/naranja con marquesina "¡Prueba tu
  suerte!" (promoción real DFBRTS de Carlos, Activa).
- Símbolos/rodillos: gestionados por la plataforma (plantilla); los premios vienen de la
  tabla de Premios común.

## 7. AUDITORÍA — nuestra Ruleta de Check vs. AppSorteos

### 7.1 Aclaración conceptual (importante)
Existen **DOS productos distintos** que se llaman "ruleta":
1. **Ruleta de Sorteo** (la que ya tenemos en Check, v12.44.821+): lista de
   participantes → se gira → sale UN GANADOR del sorteo. Referencia original:
   la ruleta de sorteo de AppSorteos. **Ya está a paridad** (orden del dueño:
   simetría garantizada, sin pesos; QR, CSV, enlace compartido sin clave, confeti,
   modo registro/leads opcional, temas, logos, fullscreen).
2. **Ruleta de la Fortuna promocional** (la de Promociones): cada VISITANTE gira con su
   email y gana un premio/cupón por segmento — juego de captura de leads.

### 7.2 Comparación detallada de la nuestra vs. la original de sorteo

| Aspecto | AppSorteos (original) | Check (v12.44.831) | Estado |
|---------|----------------------|--------------------|--------|
| Temas de color | 10 nombrados | 21 nombrados | ✅ superamos |
| Editor lateral con secciones | Sí (misma página) | Sí (misma página, sidebar) | ✅ paridad |
| Textos editables (título/desc/botón) | Sí | Sí | ✅ |
| Logo + imagen de fondo | Sí | Sí (galería de 6 logos integrados + subida) | ✅ |
| Sonido | Sí (checkbox) | Sí (ticks por segmento, WebAudio) | ✅ |
| Confeti al ganar | Sí | Sí (propio, sin CDN) | ✅ |
| Registro de participantes (leads) | En Promociones sí (email); en Sorteo por lista | Modo Registro con leads + fuente invitados/check-in/pre-registrados/encuesta | ✅ paridad |
| Enlace compartido editable sin clave | Sí (vistas limitadas por plan) | Sí, auditado, sin límite de vistas | ✅ superamos |
| QR + CSV | Sí | Sí (QR self-hosted, CSV con BOM) | ✅ |
| Girar por clic/espaciadora | Sí | Sí | ✅ |
| Reset estilo original | Sí | Sí (restaura pre-giro) | ✅ |
| Marca de agua "Powered by" | Sí (premium quitarla) | Sí "Powered by Check Pro" (sin candado) | ✅ |
| **Idiomas del juego** (7) | Sí | Solo español | ⚠️ pendiente (i18n general ya existe en Check — cablear) |
| **Jugar de nuevo** (5 modos) | Sí | Reset manual (↻) | ⚠️ diferido (ver plan) |
| **Descargar comprobante** | Sí (premium) | No | ⚠️ diferido |
| **Limitar chances / probabilidades por segmento** | Sí (premium) | NO por orden del dueño (simetría en la ruleta de SORTEO) | ℹ️ decisión del dueño vigente |
| Vista previa Ganadores/Perdedores | Sí | Muestra el ganador animado | ✅ equivalente |

**Conclusión de la auditoría:** la ruleta de SORTEO de Check está a paridad (o superior)
del original. Lo pendiente menor (idiomas del juego, jugar-de-nuevo, comprobante) son
mejoras pequeñas no bloqueantes. La **Ruleta de la Fortuna promocional NO existe en
Check** y es un módulo nuevo (ver plan §8).

## 8. Propuesta de módulos nuevos en Check (pre-plan, sujeto a tu visto)

Estilo de las fases anteriores (K=Kahoot ya hecho; proponemos P=Promociones):

- **P1 — Ruleta de la Fortuna (promocional)**: página pública con formulario de lead
  (email + campos configurables) → giro único por email (Seguridad: máx. participaciones,
  whitelist, límite por dispositivo) → premios por segmento (Sin Premio/Premio/Cupón/
  Enlace) con probabilidades configurables (aquí SÍ, porque no es sorteo entre personas)
  → páginas de ganador/perdedor editables → panel de leads con export CSV. Reutiliza el
  editor de la ruleta actual (temas, fondos, logos) añadiendo los paneles nuevos.
- **P2 — Raspa y Gana**: misma estructura de P1 con la mecánica de tarjeta dorada que se
  raspa (canvas con borrado por píxel) revelando el premio.
- **P3 — Trivia Promocional**: individual con leads; 3 tipos (multi/2 opciones/cuestionario
  sin puntaje); CSV de preguntas; límite de tiempo por pregunta; nota de aprobación;
  retroalimentación configurable; página final con `[score]` y reintentar.
- **P4 — Tragamonedas**: misma estructura con máquina de 3 rodillos + palanca y
  combinaciones de símbolos → premio.
- **Común a los 4**: panel "Promociones" en el SPA (lista, estado Activa/Pausada, leads,
  vistas), wizard de plantillas de color, Seguridad, Emails al ganar, badge "Powered by
  Check Pro", todo sin límites de plan (ventaja frente a AppSorteos).

**Orden sugerido:** P1 → P2 → P3 → P4 (P1 y P2 comparten 90% de la estructura; P3 reutiliza
el motor de preguntas del Quiz; P4 es el más gráfico).

## 9. Limitaciones de la sesión

- La pestaña "Integraciones" no se abrió en detalle (conexiones externas — no relevante
  para replicar mecánicas).
- Los precios exactos de los planes se observaron parcialmente en el modal (Starter ~2
  campañas/1.000 impresiones; Creator ~5/17.500 con las funciones premium).
- La vista pública real se observó vía "Vista Previa" del editor (iframe del juego) —
  equivalente a la página publicada.
