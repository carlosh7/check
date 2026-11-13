# Promociones — Ruleta de la Fortuna

> **Versión:** v12.44.833+ | **Módulo:** Promociones

## ¿Para qué sirve?
Crear **juegos promocionales con captura de leads** (paridad AppSorteos): cada visitante
deja su email, gira la ruleta UNA vez y gana un premio, cupón o mensaje. Tú obtienes los
leads con exportación CSV — sin límites de vistas ni candados.

**Diferencia con la Ruleta de Sorteos** (pestaña "Sorteos"): la de Sorteos elige UN
ganador entre una lista de participantes; la Fortuna es un juego individual donde cada
persona gira y recibe lo que le toque por probabilidades.

## Cómo se usa

### 1. Crear la promoción
1. **Configuración del Evento** > grupo **"✨ Experiencia"** > pestaña **"Promociones"**
2. **"Nueva Ruleta de la Fortuna"** → nombre → se abre el editor

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
