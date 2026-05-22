# Arquitectura: Live Editing de React Native desde UI Studio

> **Contexto:** UI Studio (web) necesita editar en vivo una app React Native, similar a como edita web via iframe + postMessage.
> **Problema:** RN no tiene DOM ni iframe. No hay `postMessage` que valga.
> **Solución:** WebSocket + React DevTools Protocol + Injector SDK + Metro HMR API.

---

## 1. Investigacion Previa

### 1.1 React Native DevTools (RNDT)

| Aspecto | Como funciona |
|---------|--------------|
| **Conexion** | WebSocket (CDP — Chrome DevTools Protocol) via Metro, puerto 8081 |
| **Inspector** | React DevTools integrado: arbol de componentes, props, state |
| **Seleccion** | Click "Select element" en DevTools → tap en dispositivo → highlight |
| **Edicion** | Props/state editables desde el panel derecho de React DevTools |
| **Extension** | `react-devtools-core` expone API para crear frontends custom |

El inspector de React Native **ya expone todo lo necesario** para leer el arbol de componentes. Lo que no expone de fabrica es:
- Capacidad de **insertar** componentes nuevos en la jerarquia
- Capacidad de **recibir comandos** desde un frontend externo (el DevTools actual solo "observa")
- Capacidad de **inyectar estilos en caliente** (esto lo hace Metro/Fast Refresh)

### 1.2 Metro Bundler — Hot Module Replacement

| Aspecto | Como funciona |
|---------|--------------|
| **HMR API** | WebSocket en puerto 8081, recibe `delta` updates (cambios incrementales al bundle) |
| **Fast Refresh** | Metro escucha cambios en filesystem y reemplaza modulos en vivo |
| **API programatica** | No hay API REST oficial para enviar cambios; Metro espera que el filesystem cambie |
| **Truco clave** | Se puede escribir al filesystem → Metro detecta → HMR se dispara automaticamente |

**Conclusion:** Si UI Studio puede **escribir archivos temporales** en el proyecto RN, Metro hara el resto. No necesitamos modificar Metro.

### 1.3 Flipper (Archivado Sep 2025)

| Aspecto | Detalle |
|---------|---------|
| **Estado** | Archivado por Meta. Ultima release con soporte RN: v0.239.0 |
| **Comunicacion** | Flipper SDK embebido en la app, se conecta via WebSocket al desktop Flipper |
| **Plugin system** | Se podian construir plugins custom (JS + native) |
| **Alternativa actual** | React Native DevTools (lo reemplazo) |

### 1.4 Expo Updates / CodePush

| Aspecto | Detalle |
|---------|---------|
| **Mecanismo** | Descarga JS bundle actualizado desde un servidor remoto |
| **Latencia** | No es "en vivo". Requiere descargar bundle, reemplazar, refrescar |
| **Uso en desarrollo** | No es adecuado. Es para produccion (fixes sin App Store). |
| **No sirve** para edicion en tiempo real |

### 1.5 Herramientas Existentes

| Herramienta | Como lo hace |
|-------------|-------------|
| **Draftbit** | No edita RN en vivo. Usa su propio modelo de componentes (Draftbit Component Model) y renderiza en preview. No OSS. |
| **Expo Snack** | Renderiza RN en browser via runtime custom (asigna componentes RN a web). No es "edicion en vivo de app real". |
| **React DevTools** | Solo inspeccion. No permite insertar componentes ni recibir comandos externos. |
| **Radon IDE (VS Code)** | Extiende VS Code con debugging RN. Usa CDP. No permite edicion visual. |

**Ninguna herramienta OSS existente permite lo que UI Studio necesita.** Hay que construirlo.

---

## 2. Arquitectura Propuesta: "Bridge RN"

### Diagrama de Alto Nivel

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      UI STUDIO (Web - navegador)                        │
│                                                                         │
│  ┌────────────────────────────────────────┐                             │
│  │  Canvas Editor (arbol + propiedades)   │                             │
│  └──────────────┬─────────────────────────┘                             │
│                 │                                                        │
│         WebSocket (WSS)                                                 │
│                 │                                                        │
│                 ▼                                                        │
│  ┌────────────────────────────────────────┐                             │
│  │  Bridge Server (Node.js)               │                             │
│  │  - Canal bidiereccional WS             │                             │
│  │  - Traduce comandos de UI Studio       │                             │
│  │  - Escribe archivos temporales         │                             │
│  │  - Comunica con Metro + RNDT           │                             │
│  └──────────────┬─────────────────────────┘                             │
│                 │                                                        │
│          ┌──────┴──────┐                                               │
│          ▼              ▼                                                │
│  ┌────────────┐  ┌──────────────┐                                       │
│  │ Filesystem │  │  WebSocket   │                                       │
│  │ (proyecto  │  │  (directo)   │                                       │
│  │  RN temp)  │  │              │                                       │
│  └──────┬─────┘  └──────┬───────┘                                       │
│         │               │                                               │
└─────────┼───────────────┼───────────────────────────────────────────────┘
          │               │
          ▼               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   DISPOSITIVO / EMULADOR (App RN)                       │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  App RN con RNBridgeSDK inyectado                               │   │
│  │                                                                  │   │
│  │  ┌────────────┐  ┌──────────────────┐  ┌─────────────────────┐  │   │
│  │  │ Tree       │  │ Style/Prop       │  │ Component           │  │   │
│  │  │ Inspector  │  │ Mutator          │  │ Injector            │  │   │
│  │  └────────────┘  └──────────────────┘  └─────────────────────┘  │   │
│  │                                                                  │   │
│  │  ┌──────────────────────────────────────────────────────────┐   │   │
│  │  │ WebSocket Client (conecta al Bridge Server)              │   │   │
│  │  └──────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────┐                       │
│  │  Metro HMR Client                           │                       │
│  │  (recibe delta updates vía WS :8081)        │                       │
│  └─────────────────────────────────────────────┘                       │
└─────────────────────────────────────────────────────────────────────────┘
```

### Flujo Completo

```
[1] UI Studio selecciona elemento en canvas
    ↓ WebSocket
[2] Bridge Server → RNBridgeSDK: SELECT {fiberId: "abc123"}
    ↓
[3] App RN resalta elemento + envia props actuales
    ↓ WebSocket
[4] Bridge Server → UI Studio: COMPONENT_DATA {fiberId, props, style, children}
    ↓
[5] UI Studio muestra propiedades en panel derecho
    ↓
[6] Usuario cambia "backgroundColor" a "#ff0000"
    ↓ WebSocket
[7] Bridge Server → RNBridgeSDK: MUTATE {fiberId, prop: "style.backgroundColor", value: "#ff0000"}
    ↓
[8] RNBridgeSDK llama a setState directamente en el componente
    ↓
[9] App se re-renderea con nuevo color (cambio instantaneo, sin HMR)
    ↓
    O (alternativa para cambios estructurales):
    ↓
[7b] Bridge Server escribe archivo temporal en proyecto RN
    ↓
[8b] Metro detecta cambio en filesystem
    ↓
[9b] Metro envia delta update via HMR
    ↓
[10b] App recibe y aplica cambio (Fast Refresh)
```

---

## 3. Componentes a Construir

### 3.1 RNBridgeSDK (Libreria React Native)

Paquete npm: `@uistudio/rn-bridge-sdk`

```typescript
// Componentes internos que se inyectan en la app target

// 1. TreeInspector - Lee el arbol de fibras de React
//    Usa react-devtools-core internamente para obtener el arbol
//    Expone: getTree(), getComponentData(fiberId), selectComponent(fiberId)

// 2. StyleMutator - Modifica props/state de componentes en vivo
//    Funciona via setState forzado en las fibras de React
//    No necesita re-build, no necesita HMR
//    Expone: setProp(fiberId, key, value), setStyle(fiberId, styleObj)

// 3. ComponentInjector - Inserta nuevos componentes en la jerarquia
//    Usa React.createElement + setState del padre
//    Para componentes complejos, delega a HMR (escribe archivo)

// 4. WebSocketClient - Canal de comunicacion con Bridge Server
//    Reconexion automatica, heartbeat, cola de mensajes

// 5. ElementHighlighter - Overlay visual del elemento seleccionado
//    Renderiza un View transparente con borde sobre el elemento seleccionado
```

**Modo de integracion:** El SDK se inyecta como un `Provider` en la app:

```tsx
// En la app target:
import { UIStudioProvider } from '@uistudio/rn-bridge-sdk';

function App() {
  return (
    <UIStudioProvider bridgeUrl="ws://192.168.2.17:9090">
      <YourApp />
    </UIStudioProvider>
  );
}
```

**Alternativa sin modificar codigo (modo debug):**
- Usar swizzling de Metro para inyectar el SDK en el bundle en tiempo de build
- El desarrollador solo agrega una entrada en metro.config.js

### 3.2 Bridge Server (Node.js)

```typescript
// Servidor WebSocket standalone que orquesta la comunicacion

// Funciones:
// 1. Mantener conexiones: UI Studio (1) + App RN (1+) + Metro (opcional)
// 2. Traducir comandos de UI Studio al protocolo del SDK
// 3. Escribir archivos temporales en el proyecto RN para HMR
// 4. Cachear el arbol de componentes para respuesta rapida
// 5. Gestionar estado de sesion de edicion
```

**Responsabilidades:**

| Comando UI Studio | Accion Bridge Server |
|------------------|---------------------|
| `select.element` | Envia SELECT al SDK, espera COMPONENT_DATA |
| `modify.style` | Si es simple → SDK.setStyle. Si es complejo → escribe archivo → HMR |
| `insert.component` | Escribe archivo temporal → HMR. Luego SDK refresca arbol. |
| `move.component` | Re-escribe archivo del padre → HMR |
| `delete.component` | Marca como null en archivo → HMR |
| `get.tree` | Re-solicita arbol al SDK |
| `get.component` | Re-solicita datos del componente al SDK |

### 3.3 UI Studio Web — Panel RN (Extension del canvas)

```typescript
// Extension del canvas de UI Studio para manejo de componentes RN

// Componentes React:
// - RNCanvasRenderer: Renderiza preview del arbol RN (como arbol, no como UI real)
// - RNPropsPanel: Panel de propiedades especificas de RN (StyleSheet, flexbox, etc.)
// - RNComponentPalette: Lista de componentes RN disponibles para insertar
// - RNDeviceFrame: Simula el frame del dispositivo alrededor del preview

// Adaptadores:
// - RNTreeAdapter: Convierte el arbol de fibras RN al formato interno de UI Studio
// - RNStyleAdapter: Traduce StyleSheet RN a CSS-like para el panel de props
```

---

## 4. Protocolo de Comunicacion

### 4.1 Formato General

Todos los mensajes via WebSocket en formato JSON:

```typescript
interface BridgeMessage {
  type: string;      // Tipo de mensaje
  id: string;        // ID unico para correlacion request/response
  payload: any;      // Datos del mensaje
  timestamp: number; // Timestamp
  source: 'studio' | 'bridge' | 'device';
}
```

### 4.2 Mensajes — Discovery

```
STUDIO → BRIDGE: {"type":"connect","payload":{"projectId":"abc123","mode":"edit"}}
BRIDGE → DEVICE: {"type":"handshake","payload":{"sessionId":"sess_001"}}
DEVICE → BRIDGE: {"type":"handshake_ack","payload":{"appName":"MiApp","rnVersion":"0.85"}}
BRIDGE → STUDIO: {"type":"connected","payload":{"sessionId":"sess_001","tree":{...}}}
```

### 4.3 Mensajes — Inspeccion

```
STUDIO → BRIDGE: {"type":"get_tree","id":"req_001","payload":{}}
BRIDGE → DEVICE: {"type":"get_tree","id":"req_001","payload":{}}
DEVICE → BRIDGE: {"type":"tree_data","id":"req_001","payload":{
  "root":{"fiberId":"root","name":"App","children":[{"fiberId":"f1","name":"View",...}]}
}}
BRIDGE → STUDIO: {"type":"tree_data","id":"req_001","payload":{...}}
```

```
STUDIO → BRIDGE: {"type":"select_element","id":"req_002","payload":{"fiberId":"f1"}}
BRIDGE → DEVICE: {"type":"select_element","id":"req_002","payload":{"fiberId":"f1"}}
DEVICE → BRIDGE: {"type":"element_selected","id":"req_002","payload":{
  "fiberId":"f1",
  "name":"View",
  "props":{"style":{"backgroundColor":"#fff","flex":1}},
  "state":{}
}}
BRIDGE → STUDIO: {"type":"element_selected","id":"req_002","payload":{...}}
```

### 4.4 Mensajes — Modificacion Simple (Props/Style)

```
STUDIO → BRIDGE: {"type":"modify_prop","id":"req_003","payload":{
  "fiberId":"f1",
  "path":"style.backgroundColor",
  "value":"#ff0000"
}}
BRIDGE → DEVICE: {"type":"modify_prop","id":"req_003","payload":{...}}
DEVICE → BRIDGE: {"type":"prop_modified","id":"req_003","payload":{
  "fiberId":"f1",
  "success":true,
  "newProps":{...}
}}
BRIDGE → STUDIO: {"type":"prop_modified","id":"req_003","payload":{...}}
```

### 4.5 Mensajes — Cambios Estructurales (vía HMR)

```
STUDIO → BRIDGE: {"type":"insert_component","id":"req_004","payload":{
  "parentFiberId":"f1",
  "componentName":"Button",
  "props":{"title":"Click me","onPress":{"type":"action","action":"alert","message":"Hola"}},
  "position":2  // indice entre hijos
}}
BRIDGE → DEVICE: {"type":"prepare_insert","id":"req_004","payload":{...}}
BRIDGE → FS: Escribe archivo temporal en src/generated/ui-studio/Button_abc123.tsx
METRO → HMR: Detecta cambio, envia delta update
DEVICE → BRIDGE: {"type":"component_inserted","id":"req_004","payload":{"newFiberId":"f_new"}}
BRIDGE → STUDIO: {"type":"component_inserted","id":"req_004","payload":{"newFiberId":"f_new"}}
```

### 4.6 Mensajes — Heartbeat

```
STUDIO → BRIDGE: {"type":"ping"}
BRIDGE → STUDIO: {"type":"pong","payload":{"connected":"device"}}
DEVICE → BRIDGE: {"type":"ping"}
BRIDGE → DEVICE: {"type":"pong"}
// Si no hay pong en 10s, se considera desconectado
```

---

## 5. Sistema de Archivos Temporales para HMR

### 5.1 Estructura

```
proyecto-rn/
├── src/
│   ├── app/                    # Codigo normal de la app
│   ├── generated/
│   │   └── ui-studio/          # Archivos generados por UI Studio
│   │       ├── index.ts        # Entry point que importa todo lo generado
│   │       ├── components/     # Componentes insertados por el usuario
│   │       │   ├── Button_abc.tsx
│   │       │   └── Card_def.tsx
│   │       └── patches/        # Modificaciones a componentes existentes
│   │           ├── Screen_home.tsx   # Version modificada de HomeScreen
│   │           └── styles.ts         # Estilos globales generados
│   │
│   └── bridge/
│       └── UIStudioGenerated.tsx # Componente que renderiza los cambios
```

### 5.2 Entry Point Generado

```tsx
// src/generated/ui-studio/index.ts
// Este archivo es sobrescrito cada vez que UI Studio hace cambios

export const generatedElements: Record<string, () => JSX.Element> = {
  'Button_abc': () => <Button title="Click me" onPress={() => Alert.alert('Hola')} />,
  'Card_def': () => <Card title="Mi tarjeta" />,
};

export const styleOverrides: Record<string, any> = {
  'Screen_home': {
    backgroundColor: '#ff0000',
    padding: 20,
  },
};
```

### 5.3 Bridge Component

```tsx
// src/bridge/UIStudioGenerated.tsx
// Se renderiza dentro de la app para aplicar cambios en vivo

import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';

interface GeneratedOverlayProps {
  bridgeUrl: string;
  children: React.ReactNode;
}

export function UIStudioProvider({ bridgeUrl, children }: GeneratedOverlayProps) {
  const [injectedElements, setInjectedElements] = useState<React.ReactNode[]>([]);
  const [highlightedElement, setHighlightedElement] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Conectar al Bridge Server
    const ws = new WebSocket(bridgeUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      handleBridgeMessage(msg);
    };

    return () => ws.close();
  }, []);

  // Renderiza children + overlay de elementos inyectados/inyectables
  return (
    <View style={{ flex: 1 }}>
      {/* La app original */}
      {children}

      {/* Overlay para elementos inyectados por UI Studio */}
      {injectedElements.map((el, i) => (
        <View key={i} pointerEvents="box-none">
          {el}
        </View>
      ))}

      {/* Highlight del elemento seleccionado */}
      {highlightedElement && (
        <View style={styles.highlight}>
          {/* Border overlay */}
        </View>
      )}
    </View>
  );
}
```

---

## 6. Estrategia de Modificacion: Dos Modos

### Modo A: Mutacion Directa en Fibra (cambios simples)

- **Que cambia:** props, style, texto
- **Tecnica:** Usar `react-devtools-core` internamente para obtener la fibra, luego `setState` / `setProps` forzado
- **Ventaja:** Instantaneo, no necesita HMR
- **Desventaja:** No persiste al recargar la app. Solo vale para preview.
- **Implementacion:** El SDK usa `__REACT_DEVTOOLS_GLOBAL_HOOK__` y el arbol de fibras interno de React

### Modo B: Filesystem + HMR (cambios estructurales)

- **Que cambia:** insertar/eliminar/mover componentes, cambios complejos de layout
- **Tecnica:** Bridge Server escribe archivo → Metro detecta → HMR envia delta
- **Ventaja:** Cambios reales, persisten (si se guardan), usan infra existente
- **Desventaja:** ~200-500ms de latencia (depende del cambio)
- **Implementacion:** Bridge Server tiene acceso de escritura al proyecto RN (via SSH, volumen Docker, o agente local)

### Tabla de Decision

| Tipo de cambio | Modo |
|---------------|------|
| Cambiar color de fondo | A (directo) |
| Cambiar texto de un label | A (directo) |
| Cambiar padding/margin | A (directo) |
| Ocultar/mostrar elemento | A (directo) |
| Cambiar fuente | A (directo) |
| **Insertar nuevo componente** | **B (HMR)** |
| **Eliminar componente** | **B (HMR)** |
| **Reordenar hijos** | **B (HMR)** |
| **Cambiar estructura de navegacion** | **B (HMR)** |
| **Agregar handler complejo** | **B (HMR)** |

---

## 7. Preview en UI Studio (lo que ve el disenador)

### 7.1 Sin dispositivo real (modo diseno)

- UI Studio renderiza **su propio preview** del componente RN, usando un runtime liviano
- No muestra la app real, solo el componente que se esta editando
- Usa `react-native-web` o un renderer custom para mostrar RN components en el navegador

### 7.2 Con dispositivo real conectado (modo en vivo)

- UI Studio muestra un **stream** de la pantalla del dispositivo (via `react-native-view-shot` + WebSocket envio de frames, o ADB screencap en Android)
- El disenador ve el dispositivo real en el canvas
- Cada cambio se refleja instantaneamente en el dispositivo
- Alternativa: usar `expo-screen-capture` o similar

### 7.3 Arbol de componentes (siempre visible)

- UI Studio muestra el arbol de componentes RN (similar a React DevTools)
- El arbol se actualiza en tiempo real con cada cambio
- El disenador puede navegar el arbol, seleccionar elementos, ver props

---

## 8. Esquema de Implementacion

### Fase 1: Foundation (2-3 semanas)

**SDK basico (Inspector + WebSocket):**
- [ ] RNBridgeSDK: Provider base con WebSocket client
- [ ] TreeInspector: usar `react-devtools-core` para obtener arbol de fibras
- [ ] ElementHighlighter: overlay de seleccion
- [ ] Bridge Server basico: conexion WebSocket, heartbeat, reenvio de mensajes
- [ ] UI Studio: panel de arbol de componentes RN (solo lectura)

**Resultado:** UI Studio puede conectarse a una app RN y ver su arbol de componentes en tiempo real.

### Fase 2: Edicion Simple (2-3 semanas)

**Modo A (mutacion directa):**
- [ ] StyleMutator: modificar props/style via fibra de React
- [ ] Bridge Server: traduccion de comandos de edicion
- [ ] UI Studio: panel de propiedades editable (color, texto, tamaños)
- [ ] Preview: preview del componente seleccionado (sin dispositivo)

**Resultado:** UI Studio puede cambiar colores, textos, tamaños y verlos reflejados al instante.

### Fase 3: Edicion Estructural (3-4 semanas)

**Modo B (HMR):**
- [ ] Bridge Server: escritura de archivos temporales en proyecto RN
- [ ] Generador de codigo: traduce comandos visuales a JSX/TSX
- [ ] ComponentInjector en SDK: recibe cambios via HMR y los aplica
- [ ] UI Studio: palette de componentes RN para insertar
- [ ] UI Studio: drag & drop para reordenar/reubicar

**Resultado:** UI Studio puede insertar y eliminar componentes en la app RN en vivo.

### Fase 4: Preview en Vivo (2-3 semanas)

**Streaming de pantalla:**
- [ ] SDK: captura de pantalla periodica (`react-native-view-shot`)
- [ ] Bridge Server: recepcion y reenvio de frames como JPEG base64
- [ ] UI Studio: canvas con stream de pantalla del dispositivo
- [ ] Sincronizacion: click en canvas → seleccion en arbol → highlight en dispositivo

**Resultado:** UI Studio muestra la pantalla real del dispositivo y permite editar sobre ella.

---

## 9. Esfuerzo Estimado

| Componente | Tiempo | Complejidad | Dependencias |
|-----------|--------|-------------|-------------|
| RNBridgeSDK core (Provider + WS) | 1 semana | Media | React 18+, WebSocket |
| TreeInspector (arbol de fibras) | 1 semana | Alta | `react-devtools-core`, hook `__REACT_DEVTOOLS_GLOBAL_HOOK__` |
| ElementHighlighter | 3 dias | Media | React Native Animated API |
| Bridge Server basico (WS + routing) | 1 semana | Media | `ws`, Node.js |
| StyleMutator (modo A) | 1 semana | Alta | Manipulacion de fibras React internas |
| Panel de propiedades en UI Studio | 2 semanas | Alta | UI Studio internals, RN style mapping |
| Sistema de archivos temporales + HMR (modo B) | 2 semanas | Alta | Filesystem access, generacion de codigo JSX |
| Generador de codigo (UI Studio → JSX) | 2 semanas | Alta | Template engine, mapping visual → RN components |
| ComponentInjector (via HMR) | 1 semana | Media | Metro HMR protocol |
| Stream de pantalla | 1 semana | Media | `react-native-view-shot`, compresion JPEG |
| Integracion UI Studio canvas + stream | 2 semanas | Alta | Canvas sync, click mapping |
| Tests (SDK + Bridge + UI) | 1 semana | Media | Jest, detox (opcional) |
| Documentacion + ejemplos | 3 dias | Baja | README, ejemplo de app target |
| **Total** | **~16-18 semanas** | | **~4 meses para MVP completo** |

### Roadmap Sugerido

```
Sem 1-3:   Fase 1 (Foundation) — Solo inspeccion
Sem 4-6:   Fase 2 (Edicion simple) — Props/Style en vivo
Sem 7-10:  Fase 3 (Edicion estructural) — Insertar/eliminar componentes
Sem 11-13: Fase 4 (Preview en vivo) — Stream de pantalla
Sem 14-16: Pulido, tests, documentacion
```

---

## 10. Limitaciones Conocidas

### 10.1 Limitaciones Tecnicas

| Limitacion | Explicacion | Mitigacion |
|-----------|-------------|-----------|
| **Solo debug builds** | El SDK necesita `__REACT_DEVTOOLS_GLOBAL_HOOK__` que solo existe en debug | Es una herramienta de desarrollo, no de produccion |
| **Hermes limita CDP** | Hermes tiene soporte parcial de CDP. Algunas features del inspector no funcionan. | Requerir JSC (non-Hermes) para edicion completa, o esperar a que Hermes mejore |
| **Fibras internas de React** | Manipular el arbol de fibras directamente es frágil. Cambios en React pueden romperlo. | Usar el protocolo oficial de React DevTools cuando esté disponible. Pin a versiones de React. |
| **HMR no es instantaneo** | Escribir archivo + Metro detectar + delta update + app aplicar = ~200-500ms | Aceptable para edicion visual. No apto para animaciones en tiempo real. |
| **Re-renders completos** | Al insertar componentes via HMR, React re-renderiza todo el subtree. Apps grandes pueden tener lag | Usar React.memo, virtualización. Optimizar el generador de codigo. |
| **Sin soporte para Native Modules** | No se pueden insertar componentes nativos puros (MapView, Camera, etc.) que requieran compilacion | Solo componentes JS. Los nativos deben pre-existir en la app. |
| **Estado de la app** | Modificar un componente no preserva el estado interno de la app | El flujo de trabajo asume que el disenador esta ajustando UI, no navegando |

### 10.2 Limitaciones de UX

| Limitacion | Explicacion |
|-----------|-------------|
| **No es WYSIWYG perfecto** | El preview en UI Studio no es pixel-exacto con el dispositivo real (fuentes, sombras, nativos) |
| **Requiere dispositivo/emulador** | A diferencia del web (que se edita en el mismo navegador), RN requiere un dispositivo o emulador conectado |
| **Configuracion inicial** | El desarrollador debe instalar el SDK, configurar el Bridge Server, y conectar el dispositivo |
| **Solo una sesion de edicion** | No soporta edicion colaborativa multiple (un solo disenador a la vez por app) |
| **No persiste cambios por defecto** | Los cambios del Modo A (mutacion directa) se pierden al recargar la app | El disenador debe "guardar" explicitamente, lo cual escribe archivos (Modo B) |

### 10.3 Compatibilidad

| Plataforma | Soporte | Notas |
|-----------|---------|-------|
| iOS (JSC) | ✅ Completo | Inspector completo, sin limitaciones |
| iOS (Hermes) | 🟡 Parcial | CDP limitado, arbol de componentes funciona, debugging avanzado no |
| Android (JSC) | ✅ Completo | Igual que iOS JSC |
| Android (Hermes) | 🟡 Parcial | Igual que iOS Hermes |
| Expo (dev client) | ✅ Completo | Funciona con dev builds. Go tiene limitaciones. |
| Expo Go | 🟡 Limitado | Solo SDK nativos de Expo disponibles |
| React Native Web | ❌ No soportado | Usar iframe + postMessage (el método clasico) para web |

---

## 11. Protocolo Detallado (CDP extendido)

El Bridge Server puede implementar el **Chrome DevTools Protocol** extendido. Esto permite que cualquier frontend compatible con CDP (VS Code, Chrome DevTools, etc.) tambien pueda interactuar.

### Extensiones CDP Propuestas

```
// Dominio: UIStudio
// Extensiones al protocolo CDP

uiStudio.getTree()         → tree
uiStudio.selectComponent(fiberId) → componentData
uiStudio.modifyProp(fiberId, path, value) → success
uiStudio.insertComponent(parentId, componentDef, position) → newFiberId
uiStudio.deleteComponent(fiberId) → success
uiStudio.moveComponent(fiberId, newParentId, position) → success
```

Esto significa que **cualquier herramienta que hable CDP** podria usarse como frontend de edicion.

---

## 12. Conclusión

**Si, es factible construir un sistema de edicion en vivo para React Native desde un UI Studio web.** No existe una solucion OSS hoy que lo haga, pero los bloques de construccion existen:

1. **Inspector:** `react-devtools-core` + WebSocket
2. **Mutacion:** Manipulacion directa de fibras React (modo A)
3. **Cambios estructurales:** Filesystem + Metro HMR (modo B)
4. **Protocolo:** CDP extendido + WebSocket
5. **Preview:** Stream de pantalla o `react-native-web`

El esfuerzo estimado es de **~4 meses para un MVP completo** con un equipo de 1-2 desarrolladores familiarizados con React Native internals.

### Referencias

- React DevTools Protocol: `react-devtools-core` package
- CDP (Chrome DevTools Protocol): `chromium-devtools-protocol` specs
- Metro HMR: `metro` package source code
- Flipper SDK (archivado): `facebook/flipper` — referencia de arquitectura plugin
- Expo Modules API: `expo` modules system
- React Fiber architecture: `react` package internals
