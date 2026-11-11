# Crear sorteo (Ruleta)

> **Versión:** v12.44.821+ | **Módulo:** Ruleta

## ¿Para qué sirve?
Realizar sorteos entre los invitados de un evento usando una ruleta giratoria personalizable, con probabilidades ponderadas reales, modos clásico o con registro, QR, exportación CSV y estadísticas.

## Requisitos previos
- [ ] Evento creado
- [ ] Participantes cargados (invitados del evento o lista manual)

## Pasos

### 1. Crear la ruleta
1. Ve a **Configuración del Evento** > grupo **"✨ Experiencia"** > pestaña **"Sorteos"**
2. Haz clic en **"Nueva Ruleta"**
3. Ingresa un nombre (ej: "Sorteo Principal")

### 2. Elegir el modo
Sobre el editor hay dos tarjetas, igual que en las ruletas profesionales:
- **🎡 Ruleta Clásica** — los participantes (o tú) giran la ruleta anónimamente
- **📋 Ruleta con Registro** — los participantes dejan su nombre y email antes de girar

### 3. Configurar entradas
En la sección **"🎁 Entradas (N)"** del panel lateral (el número muestra cuántas entradas hay):
- **Fuente de datos**: escribir manualmente, invitados, asistentes (check-in), pre-registrados o encuesta
- **🔄 Importar**: trae las entradas desde la fuente seleccionada
- **📄 Importar .txt/.csv**: añade nombres desde un archivo de texto o CSV (una por línea)
- **O escribe manual**: agrega nombres uno por línea

Botones útiles:
- **🔤 Ordenar** — ordena alfabéticamente (los pesos van pegados a cada nombre)
- **🎲 Aleatorio** — mezcla la lista
- **🗑️ Limpiar** — vacía la lista

> **La ruleta SIEMPRE es simétrica**: todos los jugadores tienen exactamente la misma probabilidad y porciones idénticas. (Orden del dueño, 2026-11-11: sin pesos de probabilidad.)

### 4. Personalizar diseño
En la sección **"🎨 Diseño"** puedes cambiar:
- **Temas** — paletas de colores predefinidas
- **Logo** — imagen en el centro de la ruleta
- **Imagen de fondo** — foto de fondo de la página de juego
- **Colores** — fondo, segmentos, borde, puntero, texto
- **Tamaño de líneas** — grosor de las líneas divisorias

### 5. Configurar opciones
En **"⚙️ Opciones"**:
- Título y descripción visibles en la página de juego
- Texto del botón de giro personalizable
- Sonido al girar
- Confeti al ganar
- Auto-remover ganador (elimina al ganador de la lista después del sorteo)
- ✨ **Mejorar porciones** — separadores blancos entre segmentos (mejor legibilidad)
- Duración del giro (6s, 10s, 14s)

### 6. Guardar y compartir
- **💾 Guardar** — guarda la ruleta (queda en "💾 Mis Ruletas")
- **▶️ Comenzar** — abre la página de juego en una pestaña nueva
- **📱 QR** — genera un código QR del enlace público para imprimir o proyectar
- **📊 Exportar CSV** — descarga participantes (con sus pesos) y registros del formulario en CSV

Sobre el preview verás también las **estadísticas** de la ruleta: visitas, giros y registros.

## Ver también
- [Gestionar participantes](02-participantes.md)
- [Resultados y compartir](03-resultados.md)
