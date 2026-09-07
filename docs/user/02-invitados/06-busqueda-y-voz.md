# Búsqueda de asistentes (texto y voz)

Guía de usuario · actualizada en v12.44.816

## Dónde está

Cada listado del panel tiene su barra de búsqueda con el mismo diseño:
**Mis Eventos**, **Dashboard de asistentes** (por evento), **Configuración → Staff**,
**Usuarios**, **Clientes** y **Grupos**.

```
┌──────────────────────────────────────────────────┐
│ 🔍  Buscar asistente por nombre, email, teléfono… │ 🎤 ✕ │
└──────────────────────────────────────────────────┘
```

- **🔍 (izquierda):** indicador de búsqueda.
- **🎤 (derecha):** búsqueda por voz.
- **✕ (derecha):** limpia la búsqueda y los filtros de la vista y restaura la lista.

## Búsqueda por texto

1. Escribe en la barra: nombre, email, teléfono, organización, cargo, etc.
   (los campos dependen de la vista).
2. La tabla se filtra mientras escribes.
3. Con **✕** vuelves a ver la lista completa.

## Búsqueda por voz

1. Haz clic en el icono del micrófono 🎤.
2. Aparece el aviso **"Escuchando… Habla ahora"** y el micrófono se pone rojo con
   el icono de ondas mientras escucha.
3. Di el nombre que buscas (p. ej. "Ana López"). Verás lo reconocido en el aviso
   en tiempo real.
4. Al terminar, el texto queda en la barra y **la tabla se filtra automáticamente**
   — también en el Dashboard de asistentes (desde v12.44.816).
5. Para cancelar, vuelve a pulsar 🎤 o espera: si no detecta voz reintenta unas
   veces y te avisa.

### Requisitos de la voz

- **Navegador:** Chrome o Edge (Web Speech API). Firefox no lo soporta.
- **Conexión a internet:** el reconocimiento se procesa en el servicio del
  navegador; sin conexión muestra "Error de red".
- **Permiso de micrófono:** la primera vez el navegador pedirá permiso — pulsa
  "Permitir". Si lo bloqueaste, haz clic en el candado 🔒 de la barra de
  direcciones → Micrófono → Permitir → recarga la página.

## Notas

- El texto dictado se limpia de puntuación final que agrega Chrome.
- La búsqueda no distingue mayúsculas/minúsculas.
- Si el navegador no soporta voz, verás "No soportado — usa Chrome o Edge".
