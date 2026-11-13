# REA — Análisis de Requisitos de Kahoot! (para la versión "Quiz en vivo" de Check)

**Fecha:** 2026-11-13
**Autor:** sesión de análisis interactiva (agente + Carlos)
**Cuenta de prueba:** carlosh7@gmail.com (plan gratuito "Kahoot! Go") — *la contraseña NO se
registra en este archivo por regla de seguridad; está en el chat de la sesión y conviene
cambiarla.*
**URL del kahoot creado:** "Prueba Check Pro" (borrador en la cuenta de prueba)

> ⚠️ **Aviso importante:** Kahoot exige verificar el email de la cuenta en un plazo de
> **7 días** desde el ingreso (aviso mostrado en la propia plataforma el 2026-11-13).
> Si no se verifica, la cuenta puede bloquearse. **Pendiente del dueño.**

---

## 1. Objetivo

Estudiar Kahoot! "en vivo" (creación de quizzes + partida en tiempo real anfitrión/jugadores)
para replicar la experiencia como un nuevo módulo de Check Pro, integrado con los eventos,
invitados y pantallas que ya tenemos.

## 2. Metodología y evidencia

Prueba interactiva real con el navegador (no lectura de documentación):

| # | Paso | Resultado | Evidencia |
|---|------|-----------|-----------|
| 1 | Ingreso en create.kahoot.it con la cuenta | ✅ | Panel cargó en español, plan "Kahoot! Go" |
| 2 | Explorar inicio: menú "Crear" | ✅ | 3 tipos de contenido (Kahoot / Historia / Curso) |
| 3 | Crear kahoot desde lienzo en blanco | ✅ | Editor cargado con pregunta 1 tipo Quiz |
| 4 | Catálogo de tipos de pregunta | ✅ | 14 tipos en 3 grupos; solo 3 libres (ver §5) |
| 5 | Pregunta 1 Quiz: "¿Cuál es la capital de Colombia?" con 4 opciones y Bogotá marcada correcta | ✅ | Texto de estado "Esta respuesta está marcada como correcta" |
| 6 | Pregunta 2 Verdadero/Falso: "La ruleta es una función de Check Pro" → Verdadero | ✅ | Opciones fijas Verdadero/Falso, marca correcta aplicada |
| 7 | Configuración del kahoot (título, visibilidad, idioma) | ✅ | "Prueba Check Pro", Privado, Español; autosave a borradores |
| 8 | Guardar en biblioteca | ✅ | Diálogo "Tu kahoot está listo" con 3 acciones |
| 9 | Presentar en vivo → selección de modo de juego | ✅ | 17 modos; Clásico por defecto; PIN generado |
| 10 | Lobby del anfitrión | ✅ | PIN visible, QR, bloquear sala, expulsar jugador |
| 11 | Jugador se une desde kahoot.it (PIN + apodo "Carlos") | ✅ | Apareció en el lobby del anfitrión (contador 1) |
| 12 | Reacciones jugador→anfitrión | ✅ | Pulgar arriba y sorpresa llegaron al lobby |
| 13 | **Anfitrión pulsa "Empezar" para pasar a la pregunta 1** | ❌ **bloqueado por el entorno** | Eventos de clic llegan al botón (espía capturó pointerdown/up+click `isTrusted:true`), sin errores JS, y el juego no avanza; reproducido en 3 sesiones (popup y pestaña normal) |
| 14 | Modo demostración (vista previa integrada) | ✅ | Muestra vista presentador + vista participante con temporizador y retroalimentación (+100 "Correcto") |

**Lectura del punto 13:** es una restricción del navegador de automatización usado en la
sesión (el juego de Kahoot no procesa el arranque bajo ese entorno). Un usuario real en su
navegador normal usa este flujo a diario; el comportamiento del producto está bien
documentado en §7-§9. El E2E completo de respuesta→marcador→podio se validará en la
implementación de Check, donde controlamos toda la pila (como ya se hizo con la ruleta:
24/24 pruebas Playwright).

## 3. Mapa del producto (superficies)

| Superficie | URL | Quién la usa | Para qué |
|------------|-----|--------------|----------|
| Panel de creación | create.kahoot.it | Anfitrión (logueado) | Biblioteca, editor, informes, grupos |
| Juego del anfitrión | play.kahoot.it | Anfitrión (pantalla grande/proyector) | Sala de espera, preguntas, marcador, podio |
| Vista del jugador | kahoot.it | Jugadores (sin cuenta) | Ingresar PIN, apodo, responder |
| Web corporativa | kahoot.com | Todos | Marketing, planes, ayuda |

Diseño clave: **el jugador NO necesita cuenta** — solo el PIN de 7 dígitos y un apodo.

## 4. Tipos de contenido (menú Crear)

1. **Kahoot** — quizzes cortos y encuestas (el que analizamos)
2. **Historia** — narrativa con bloques de construcción
3. **Curso** — colecciones de quizzes, videos y documentos

## 5. Tipos de pregunta (catálogo del editor — 14 tipos, 3 grupos)

**Prueba de conocimientos:**
| Tipo | Plan gratuito |
|------|---------------|
| Quiz (4 opciones, 1+ correctas) | ✅ Libre (por defecto) |
| Verdadero o falso | ✅ Libre |
| Respuesta corta (texto) | 💰 Premium |
| Control deslizante (adivinar número) | 💰 Premium |
| Respuesta con pin (marcar en imagen) | 💰 Premium |
| Puzzle (ordenar) | 💰 Premium |

**Recopilar opiniones:**
| Tipo | Plan gratuito |
|------|---------------|
| Encuesta (sin respuesta correcta) | 💰 Premium |
| Escala (Likert) | 💰 Premium |
| Escala NPS | 💰 Premium |
| Coloca el pin | 💰 Premium |
| Nube de palabras | 💰 Premium |
| Pregunta abierta | 💰 Premium |
| Lluvia de ideas (brainstorm) | 💰 Premium |

**Presentar información:**
| Tipo | Plan gratuito |
|------|---------------|
| Diapositiva (título/texto/media) | ✅ Libre |

**Conclusión para Check:** el corazón del producto gratuito es **Quiz + Verdadero/Falso**,
exactamente lo que necesitamos. El resto puede entrar después como extensiones.

## 6. Editor de kahoot (bloques)

- **Lista lateral de bloques**: cada pregunta es un bloque numerado con tipo y tiempo
  (badge "20"); se puede duplicar/eliminar; botón "Añadir" abre galería con pestañas
  **Añadir / Buscar / Generar (IA) / Importar**.
- **Formas de iniciar un kahoot**: De PDF a kahoot (IA) · Tema para un kahoot (IA,
  tema/URL/Wikipedia) · Lienzos en blanco · Importar diapositivas (Google Drive,
  OneDrive, Canva) · Plantillas.
- **Editor de pregunta Quiz**: título (texto), multimedia (imagen subida o búsqueda con
  sugerencias de Getty Images — los videos de YouTube fueron **retirados** en 2026),
  4 respuestas (más = premium) con interruptor correcta/incorrecta por respuesta
  (`aria-label="Activar respuesta N como correcta"`).
- **Panel Propiedades por pregunta**:
  - Tipo de pregunta (lista §5)
  - Límite de tiempo: 20 s por defecto (rango típico 5–120 s), botón "Aplicar a todas
    las preguntas"
  - Puntos: Estándar (por defecto) / Doble / Sin puntos
  - Opciones de respuesta: Selección simple / Selección múltiple
- **Autoguardado**: barra superior muestra "Guardado en: Tus borradores"; botón Guardar
  aparte para versionar.
- **Configuración del kahoot** (diálogo "Información del kahoot"):
  - Pestaña *Información básica*: Título (máx 76 car.), Descripción (500), Visibilidad
    (Privado/Público), Imagen de portada, Carpeta destino, Idioma (Español OK).
  - Pestaña *Juego en vivo*: video de espera (YouTube retirado), música de espera (se
    configura por sesión, no por kahoot).
- **Al guardar** aparece el diálogo "Tu kahoot está listo" con: Iniciar demostración ·
  **Presentar en vivo** · Compartir (colaboradores).

## 7. Anfitrión: selección de modo de juego

Al "Presentar en vivo" se abre `play.kahoot.it` con selector de **experiencia/modo**:

- **Filtros**: Todos · Participación · Competencia por equipos · Colaboración · Unplugged
- **17 modos observados**: Clásico (por defecto), Clásica: Unplugged, Mosaicos por equipos,
  Otoño, Clases, Teams, Exactitud, Confianza, Carrera de robots, Carrera de canicas,
  Pirámide perdida, Escuadrón de submarinos, Conquista cósmica, Reinos de colores,
  Cofre del tesoro, La torre más alta, Relax-arte.
- **Clásico** describe: "Hasta 10 participantes (plan gratis) · Competencia · Participación.
  Los participantes responden rápido y con precisión para asegurarse un lugar en el podio."
- Controles de la pantalla: volumen/silencio, opciones de juego, pantalla completa.

## 8. Anfitrión: lobby (sala de espera) — verificado

- **PIN de juego de 7 dígitos** (observados: 4936349, 6973020, 6557131 — se regenera por
  sesión, no es fijo por kahoot).
- Texto de invitación: "Únete en **www.kahoot.it** o con la app de Kahoot!".
- Botones: **Expandir código QR** (para unirse escaneando), **Bloquear juego** (cerrar
  ingreso), **Empezar**, expulsar participante (clic sobre su nombre).
- Contador de participantes en vivo y lista de apodos.
- Menú **Configuración** del juego (verificado, con estado libre/premium):

| Opción | Estado en plan gratis |
|--------|----------------------|
| Mostrar preguntas en los dispositivos (el jugador lee la pregunta en su pantalla) | ✅ |
| Personajes (jugador elige avatar) | ✅ |
| Temas visuales (Estándar libre; Spring/Moonlight/Halloween premium) | ✅/💰 |
| Idioma del juego | ✅ |
| Música de espera (Original + variantes) | ✅ |
| Aumentar el contraste (accesibilidad) | ✅ |
| Generador de apodos (evita nombres ofensivos) | ✅ |
| Acceso en 2 pasos (PIN + código extra) | ✅ |
| Reacciones (jugadores envían emojis al anfitrión) | ✅ |
| Orden de preguntas al azar | ✅ |
| Orden de respuestas al azar | ✅ |
| Reproducción automática | ✅ |
| Copiar enlace / Abrir / Escanear QR | ✅ |
| Tiempo ilimitado | 💰 bloqueado |
| Bloquear juego (antes de la sala) | 💰 bloqueado |
| Preguntas y respuestas (Q&A del público) | 💰 bloqueado |
| Moderación de Q&A | 💰 bloqueado |
| Permitir selección de equipos | 💰 bloqueado |
| Charla de equipo | 💰 bloqueado |

## 9. Jugador: flujo verificado (kahoot.it)

1. Pantalla mínima: **"Enter Game PIN"** (un campo + botón Join). Sin cuenta.
2. Pantalla **"Enter Nickname"** con aviso "Do not use your real name".
3. Pantalla **"You're in!"**: avatar asignado (conejo pirata 😄), apodo grande, puntos en 0,
   botón **React** con 6 reacciones (pulgar, aplauso, corazón, risa, pensar, sorpresa).
   Con "Personajes" activado el jugador podría editar su avatar.
4. *(No verificable en este entorno:)* al arrancar la partida el jugador ve la pregunta SOLO
   como rectángulos de color con iconos (triángulo/rombo/círculo/cuadrado) y responde
   tocando; la retroalimentación muestra ✅/❌ y los puntos ganados (en el modo demo se
   observó "+100 Correcto"); entre preguntas ve el marcador; al final, el **podio**.
   **Fórmula de puntos estándar de Kahoot** (conocimiento de producto, no verificado hoy):
   puntos = correcto × (hasta 1000) escalado por rapidez + bonus por racha.

## 10. Límites del plan gratuito observados

- Hasta **10 participantes** por partida (Kahoot!+ Bronze 50, Gold 200).
- Tipos de pregunta: solo Quiz, V/F y Diapositiva.
- IA de generación "Limitada".
- Q&A, equipos, tiempo ilimitado, etc. bloqueados (ver tabla §8).
- Aviso de verificación de email en 7 días.

## 11. Paralelo con lo que Check YA tiene

| Kahoot | Check Pro actual |
|--------|------------------|
| Cuenta del anfitrión | Usuarios/roles de Check (admin/organizer) ✅ |
| Evento/presentación | Eventos con BD propia por evento ✅ |
| "Jugadores" | Invitados del evento (¡podemos unir por check-in o pre-registro!) ✅ |
| Vista proyector del anfitrión | Experiencia `#screencast` de la ruleta ✅ (fullscreen, confeti, audio WebAudio) |
| Vista móvil del jugador | Páginas públicas móviles (ruleta/registro/portal PWA) ✅ |
| PIN de partida | Nosotros ya generamos enlaces/QR por evento (QR self-hosted de ruleta) ✅ |
| Editor de preguntas | Aún NO existe (nuevo) |
| Motor de partida en vivo | Aún NO existe (nuevo) |
| Marcador/podio | Gamificación básica existe (C5-06), sin partidas en vivo |

**Arquitectura de sincronización en vivo**: Kahoot usa WebSockets. En Check el estándar
del proyecto es más simple (HTTP + SQLite sincrónica); para tiempo real proponemos
**SSE (Server-Sent Events)** o *polling corto* — decisión a confirmar en el plan técnico.

## 12. Alcance implementado "K1 — Quiz en vivo" (v12.44.829)

> El borrador de esta sección se implementó COMPLETO el 2026-11-13 (misma sesión).
> Detalle completo en `docs/ROADMAP.md` (Sesión 2026-11-13) y guía en `docs/user/14-quiz/`.

- **Backend**: `src/routes/quizzes.routes.js` + tablas `quizzes`,
  `quiz_questions`, `quiz_sessions`, `quiz_players`, `quiz_responses`,
  `quiz_reactions` (BD maestra, `schema.js` + `database-manager.js`).
- **Sincronización en vivo**: socket.io (sala `quiz:{sessionId}`, reutiliza el evento
  `join_event` de `src/socket`) + **reserva por sondeo** cada 1,2 s con número de
  versión — funciona incluso si el websocket no atraviesa los proxies.
- **Puntuación paridad Kahoot**: base 1000/2000/0 (estándar/doble/sin puntos) escalada
  por rapidez + racha (+100 por nivel desde la 2ª correcta, máx +500).
- **Anti-trampa**: el estado público jamás incluye la respuesta correcta mientras la
  pregunta está abierta; ventana de respuesta = tiempo límite + 1,5 s de gracia; una
  sola respuesta por jugador y pregunta; todo se puntúa en el servidor.
- **Pantallas**: editor standalone (Quiz/V-F/Opciones/Diseño+temas), anfitrión
  (lobby con PIN+QR → pregunta con temporizador y conteos → revelado con el más
  rápido → marcador → podio con confeti y sonidos WebAudio), jugador móvil
  (PIN+apodo → botones de color → retroalimentación → posición → podio).
- **Enlace compartido sin clave** para quizzes publicados (misma política que la
  ruleta; auditado).
- **Verificación**: `tests/quiz.test.js` 32/32 ✓ + suite completa 389 ✓ / 0 ✗;
  smoke test del servidor real con las páginas y la API del quiz servidas.
- **Pendiente tras deploy**: E2E con navegador real en producción (como la ruleta).

## 13. Notas de automatización (para futuras sesiones)

- El panel de Kahoot funciona bien automatizado **hasta el lobby**; el botón "Empezar"
  del lobby no procesa el arranque dentro del navegador de automatización (probado con
  3 salas distintas, popup y pestaña normal, espías de eventos con `isTrusted:true`,
  invocación directa del manejador de React, marcapasos de rAF). Causa probable:
  restricciones del entorno sobre el bucle de juego/canvas. No intentarlo de nuevo
  sin cambiar de entorno.
- Los selectores de tipo de pregunta del editor son `react-select` con input oculto
  (0×0): abrir con clic sobre el wrapper padre, no sobre el `[role=combobox]`.
- El interruptor de respuesta correcta: `button[aria-label="Activar respuesta N como
  correcta."]` o `data-functional-selector="question-answer__toggle-button"`.
- El botón de inicio del lobby: `[data-functional-selector="start-button"]`.
- Escribir en los campos de texto enriquecido con `document.execCommand("insertText")`
  tras clic en el campo.
