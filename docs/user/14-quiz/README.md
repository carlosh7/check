# Quiz en vivo (estilo Kahoot)

> **Versión:** v12.44.829+ | **Módulo:** Quiz en vivo

## ¿Para qué sirve?
Lanzar trivias y quizzes en vivo durante tu evento, estilo Kahoot: los jugadores entran
con un **PIN de 7 dígitos** desde su celular (sin cuenta ni instalación), responden
tocando botones de colores, ganan **puntos por acertar y por rapidez** (con bonus por
racha), y la pantalla grande muestra sala de espera, preguntas con temporizador,
marcador y **podio final con confeti**.

## Requisitos previos
- [ ] Evento creado
- [ ] (Opcional) Quiz publicado si vas a usar el enlace compartido sin clave

## Cómo se usa (5 minutos)

### 1. Crear el quiz
1. Ve a **Configuración del Evento** > grupo **"✨ Experiencia"** > pestaña **"Quiz"**
2. Clic en **"Nuevo Quiz"** y ponle nombre (ej: "Trivia de Cierre")
3. Se abre el editor en una pestaña nueva

### 2. Agregar preguntas
En **"📝 Preguntas"** tienes dos botones:
- **＋ Quiz** — pregunta con hasta 4 opciones (marca con ✔ la(s) correcta(s))
- **＋ V/F** — pregunta de Verdadero o Falso (opciones fijas)

Por pregunta puedes ajustar:
- **Tiempo** — 5 a 120 segundos (por defecto 20s)
- **Puntos** — Estándar (máx 1000), Doble (máx 2000) o Sin puntos
- **Aplicar a todas** — copia tiempo y puntos al resto de preguntas

### 3. Opciones y diseño
- **⚙️ Opciones**: mostrar la pregunta en el celular del jugador (por defecto apagado,
  como Kahoot clásico), sonidos, reacciones de jugadores, título y descripción en pantalla
- **🎨 Diseño**: 8 temas de colores, color de fondo, colores de las 4 respuestas

### 4. Comenzar la partida
1. Pulsa **💾 Guardar** (al Comenzar el quiz se publica solo, para que el enlace funcione)
2. Pulsa **▶️ Comenzar** → aparece la **sala de espera** con:
   - **PIN de 7 dígitos** grande
   - **QR** para que los jugadores escaneen y entren directo
3. Los jugadores entran en `<tu-evento>/quiz/<id>/play` (o escanean el QR), escriben su
   **apodo** y ya están en la sala (verás los apodos aparecer en vivo)
4. Pulsa **▶️ Empezar** para lanzar la primera pregunta

### 5. Conducir la partida
- Durante la pregunta: **temporizador circular**, conteo de respuestas en vivo por opción
  y botón **👁️ Revelar** (también se revela solo al agotarse el tiempo)
- **📊 Marcador** — top 10 con barras de puntos y rachas 🔥
- **➡️ Siguiente pregunta** — avanza; al terminar la última, **🏆 Podio** con confeti
- **📥 Resultados CSV** — descarga todas las respuestas (con BOM para Excel)
- **🔁 Nueva partida** — abre una sala nueva con PIN nuevo

## Cómo puntúa (paridad Kahoot)
- **Respuesta correcta** → hasta 1000 puntos (2000 en modo Doble) escalados por rapidez:
  responder al instante da casi el máximo; al filo del tiempo da la mitad
- **Racha** 🔥 — desde la segunda correcta consecutiva suma +100 de bonus por nivel
  (máximo +500)
- **Incorrecto o sin responder** → 0 puntos

## Enlace compartido (sin clave, como la ruleta)
La URL del quiz publicado (`/{evento}/quiz/{id}`) abre el editor y el control de la
partida **sin contraseña** — pensado para proyectar desde otro equipo. Puedes
publicar/despublicar con el botón 🌐 de la lista en la app. Toda acción queda auditada.

## Preguntas frecuentes

**¿Los jugadores necesitan instalar algo?** No. Solo el navegador del celular y el PIN.

**¿Se pueden trampar viendo la respuesta correcta?** No: mientras la pregunta está abierta,
el servidor **nunca envía** cuál es la correcta a los celulares; solo la revela al
revelar. La puntuación se calcula en el servidor con el reloj del servidor.

**¿Puedo unir jugadores a mitad de partida?** Sí — entran con 0 puntos y juegan desde la
siguiente pregunta.

**¿Qué pasa si se cae mi conexión durante la partida?** La partida vive en el servidor:
al recargar la página del quiz y pulsar ▶️ Comenzar se crea una sala nueva (el PIN
anterior deja de usarse). Los jugadores deben entrar con el PIN nuevo.

**¿Cómo vinculo jugadores con invitados del evento?** (Para reportes por invitado) — la
unión acepta opcionalmente el token QR del invitado (`guestToken`), que el portal del
asistente puede pasar automáticamente.

## Detalles técnicos rápidos
- Tablas: `quizzes`, `quiz_questions`, `quiz_sessions`, `quiz_players`,
  `quiz_responses`, `quiz_reactions` (BD maestra, con índices)
- Sincronización en vivo: **socket.io** (sala `quiz:{sessionId}`) con **reserva por
  sondeo** cada 1,2 s usando un número de versión — funciona incluso detrás de
  proxies que bloqueen websocket
- PIN único entre sesiones vivas de las últimas 24 horas
- Anti-trampa: correctas ocultas en estado público + ventana de respuesta
  tiempo límite + 1,5 s de gracia + una sola respuesta por jugador y pregunta
- Reacciones limitadas a 1 cada 3 s por jugador
- Pruebas: `tests/quiz.test.js` (32 pruebas)
