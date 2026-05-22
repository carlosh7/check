# Catálogo de Componentes React Native — UI Studio

> **Propósito:** Definir el catálogo completo de componentes React Native que UI Studio debe soportar cuando el target de exportación es `react-native`.
>
> **Versión:** 1.0
> **Target mínimo:** React Native 0.76+
> **Tags:** `react-native`, `catalog`, `components`, `ui-studio`

---

## Índice

1. [Arquitectura del Catálogo RN](#1-arquitectura-del-catalogo-rn)
2. [Componentes RN que NO existen en Web](#2-componentes-rn-que-no-existen-en-web)
3. [Componentes Web que cambian en RN](#3-componentes-web-que-cambian-en-rn)
4. [Componentes Nativos Específicos](#4-componentes-nativos-específicos)
5. [Mapeo Componente Web → RN](#5-mapeo-componente-web--rn)
6. [Registry de Componentes RN en UI Studio](#6-registry-de-componentes-rn-en-ui-studio)
7. [Palette UI por Categoría](#7-palette-ui-por-categoría)
8. [Ejemplos de JSON → Código RN](#8-ejemplos-de-json--codigo-rn)

---

## 1. Arquitectura del Catálogo RN

### 1.1 Modelo de Target

Cada componente en UI Studio tiene un campo `targets` que define en qué plataformas está disponible:

```typescript
interface ComponentDefinition {
  id: string;
  name: string;
  description: string;
  category: ComponentCategory;
  targets: ('web' | 'react-native' | 'both')[];
}
```

### 1.2 Modos de Operación

| Modo | Comportamiento |
|------|---------------|
| **Solo web** | Visible solo en palette web |
| **Solo RN** | Visible solo en palette RN |
| **Ambos (mismo nombre)** | Mismo componente, distintas props/estilos al exportar |
| **Mapeo (web→RN)** | Componente web se transforma en su equivalente RN al cambiar target |

### 1.3 Estructura de Definición

```typescript
interface RNComponentDefinition {
  id: string;                    // Identificador único
  name: string;                  // Nombre visible en palette
  rnName: string;                // Nombre del componente en React Native
  importPath: string;            // Desde dónde se importa
  category: RNCategory;          // Categoría en la palette
  description: string;
  props: RNPropDefinition[];
  styleSupport: StyleSupport;
  webEquivalent?: string;
  childrenType: 'none' | 'text' | 'component' | 'multiple';
}
```

---

## 2. Componentes RN que NO existen en Web

### 2.1 SafeAreaView

```typescript
{
  id: 'rn-safe-area-view',
  name: 'SafeAreaView',
  rnName: 'SafeAreaView',
  importPath: 'react-native',
  category: 'layout',
  description: 'Renderiza contenido dentro del area segura del dispositivo (notch, home indicator)',
  props: [
    { name: 'edges', type: 'enum', values: ['top', 'bottom', 'left', 'right', 'all'], default: 'all' },
    { name: 'mode', type: 'enum', values: ['padding', 'margin'], default: 'padding' }
  ],
  styleSupport: { flexbox: true, padding: true, margin: true, backgroundColor: true },
  childrenType: 'multiple',
  webEquivalent: null
}
```

### 2.2 KeyboardAvoidingView

```typescript
{
  id: 'rn-keyboard-avoiding',
  name: 'KeyboardAvoidingView',
  rnName: 'KeyboardAvoidingView',
  importPath: 'react-native',
  category: 'layout',
  description: 'Mueve el contenido cuando el teclado aparece',
  props: [
    { name: 'behavior', type: 'enum', values: ['height', 'position', 'padding'], default: 'padding' },
    { name: 'keyboardVerticalOffset', type: 'number', default: 0 },
    { name: 'enabled', type: 'boolean', default: true }
  ],
  styleSupport: { flexbox: true, dimensions: true },
  childrenType: 'multiple',
  webEquivalent: null
}
```

### 2.3 StatusBar

```typescript
{
  id: 'rn-status-bar',
  name: 'StatusBar',
  rnName: 'StatusBar',
  importPath: 'react-native',
  category: 'layout',
  description: 'Controla la barra de estado del dispositivo',
  props: [
    { name: 'barStyle', type: 'enum', values: ['default', 'light-content', 'dark-content'], default: 'default' },
    { name: 'backgroundColor', type: 'color', default: '#000000' },
    { name: 'translucent', type: 'boolean', default: false },
    { name: 'hidden', type: 'boolean', default: false },
    { name: 'animated', type: 'boolean', default: false }
  ],
  styleSupport: null,
  childrenType: 'none',
  webEquivalent: null
}
```

### 2.4 FlatList

```typescript
{
  id: 'rn-flat-list',
  name: 'FlatList',
  rnName: 'FlatList',
  importPath: 'react-native',
  category: 'data-display',
  description: 'Lista virtualizada de alto rendimiento para datos planos',
  props: [
    { name: 'data', type: 'array', binding: true, required: true },
    { name: 'renderItem', type: 'slot', required: true },
    { name: 'keyExtractor', type: 'function', default: '(item, index) => index.toString()' },
    { name: 'numColumns', type: 'number', default: 1 },
    { name: 'horizontal', type: 'boolean', default: false },
    { name: 'onEndReached', type: 'event', params: ['info'] },
    { name: 'onEndReachedThreshold', type: 'number', default: 0.5 },
    { name: 'onRefresh', type: 'event' },
    { name: 'refreshing', type: 'boolean', default: false },
    { name: 'ListHeaderComponent', type: 'slot' },
    { name: 'ListFooterComponent', type: 'slot' },
    { name: 'ListEmptyComponent', type: 'slot' },
    { name: 'ItemSeparatorComponent', type: 'slot' },
    { name: 'initialNumToRender', type: 'number', default: 10 },
    { name: 'maxToRenderPerBatch', type: 'number', default: 10 },
    { name: 'windowSize', type: 'number', default: 21 },
    { name: 'removeClippedSubviews', type: 'boolean', default: true },
    { name: 'contentContainerStyle', type: 'style' }
  ],
  styleSupport: { dimensions: true, backgroundColor: true },
  childrenType: 'none',
  webEquivalent: 'Table'
}
```

### 2.5 SectionList

```typescript
{
  id: 'rn-section-list',
  name: 'SectionList',
  rnName: 'SectionList',
  importPath: 'react-native',
  category: 'data-display',
  description: 'Lista virtualizada con secciones agrupadas y encabezados',
  props: [
    { name: 'sections', type: 'array', binding: true, required: true },
    { name: 'renderItem', type: 'slot', required: true },
    { name: 'renderSectionHeader', type: 'slot' },
    { name: 'renderSectionFooter', type: 'slot' },
    { name: 'keyExtractor', type: 'function' },
    { name: 'stickySectionHeadersEnabled', type: 'boolean', default: true },
    { name: 'onEndReached', type: 'event' },
    { name: 'onRefresh', type: 'event' },
    { name: 'refreshing', type: 'boolean', default: false },
    { name: 'ListHeaderComponent', type: 'slot' },
    { name: 'ListFooterComponent', type: 'slot' },
    { name: 'ListEmptyComponent', type: 'slot' },
    { name: 'ItemSeparatorComponent', type: 'slot' },
    { name: 'SectionSeparatorComponent', type: 'slot' }
  ],
  styleSupport: { dimensions: true },
  childrenType: 'none',
  webEquivalent: 'Table'
}
```

### 2.6 VirtualizedList

```typescript
{
  id: 'rn-virtualized-list',
  name: 'VirtualizedList',
  rnName: 'VirtualizedList',
  importPath: 'react-native',
  category: 'data-display',
  description: 'Lista virtualizada base - low-level para listas personalizadas',
  props: [
    { name: 'data', type: 'array', binding: true, required: true },
    { name: 'renderItem', type: 'slot', required: true },
    { name: 'getItem', type: 'function' },
    { name: 'getItemCount', type: 'function' },
    { name: 'getItemLayout', type: 'function' },
    { name: 'maxToRenderPerBatch', type: 'number', default: 10 },
    { name: 'windowSize', type: 'number', default: 21 }
  ],
  styleSupport: { dimensions: true },
  childrenType: 'none',
  webEquivalent: null
}
```

### 2.7 TouchableOpacity

```typescript
{
  id: 'rn-touchable-opacity',
  name: 'TouchableOpacity',
  rnName: 'TouchableOpacity',
  importPath: 'react-native',
  category: 'interaction',
  description: 'Wrapper con feedback de opacidad al presionar. Equivalente RN al button',
  props: [
    { name: 'onPress', type: 'event', required: true },
    { name: 'onLongPress', type: 'event' },
    { name: 'activeOpacity', type: 'number', default: 0.2, range: [0, 1] },
    { name: 'disabled', type: 'boolean', default: false },
    { name: 'delayPressIn', type: 'number', default: 0 },
    { name: 'delayPressOut', type: 'number', default: 0 },
    { name: 'delayLongPress', type: 'number', default: 500 },
    { name: 'hitSlop', type: 'object', props: { top: 'number', bottom: 'number', left: 'number', right: 'number' } },
    { name: 'pressRetentionOffset', type: 'object' }
  ],
  styleSupport: { all: true },
  childrenType: 'multiple',
  webEquivalent: 'Button'
}
```

### 2.8 TouchableHighlight

```typescript
{
  id: 'rn-touchable-highlight',
  name: 'TouchableHighlight',
  rnName: 'TouchableHighlight',
  importPath: 'react-native',
  category: 'interaction',
  description: 'Wrapper con feedback de color de fondo al presionar',
  props: [
    { name: 'onPress', type: 'event', required: true },
    { name: 'underlayColor', type: 'color', default: 'rgba(0,0,0,0.1)' },
    { name: 'activeOpacity', type: 'number', default: 0.85 },
    { name: 'onShowUnderlay', type: 'event' },
    { name: 'onHideUnderlay', type: 'event' },
    { name: 'disabled', type: 'boolean', default: false },
    { name: 'hitSlop', type: 'object' }
  ],
  styleSupport: { all: true },
  childrenType: 'multiple',
  webEquivalent: 'Button'
}
```

### 2.9 Pressable

```typescript
{
  id: 'rn-pressable',
  name: 'Pressable',
  rnName: 'Pressable',
  importPath: 'react-native',
  category: 'interaction',
  description: 'Componente de presion avanzado con estados. Version RN moderna',
  props: [
    { name: 'onPress', type: 'event' },
    { name: 'onPressIn', type: 'event' },
    { name: 'onPressOut', type: 'event' },
    { name: 'onLongPress', type: 'event' },
    { name: 'disabled', type: 'boolean', default: false },
    { name: 'delayLongPress', type: 'number', default: 500 },
    { name: 'hitSlop', type: 'object' },
    { name: 'pressRetentionOffset', type: 'object' },
    { name: 'android_ripple', type: 'object', props: { color: 'color', borderless: 'boolean', radius: 'number' } },
    { name: 'style', type: 'function', description: '({ pressed, hovered }) => style' }
  ],
  styleSupport: { all: true },
  childrenType: 'multiple',
  webEquivalent: 'Button'
}
```

### 2.10 RefreshControl

```typescript
{
  id: 'rn-refresh-control',
  name: 'RefreshControl',
  rnName: 'RefreshControl',
  importPath: 'react-native',
  category: 'interaction',
  description: 'Pull-to-refresh para ScrollView y FlatList',
  props: [
    { name: 'refreshing', type: 'boolean', required: true },
    { name: 'onRefresh', type: 'event', required: true },
    { name: 'tintColor', type: 'color' },
    { name: 'title', type: 'string' },
    { name: 'titleColor', type: 'color' },
    { name: 'colors', type: 'array-of-color' },
    { name: 'progressBackgroundColor', type: 'color' },
    { name: 'size', type: 'enum', values: ['default', 'large'], default: 'default' }
  ],
  styleSupport: { dimensions: ['width', 'height'] },
  childrenType: 'none',
  webEquivalent: null
}
```

### 2.11 ActivityIndicator

```typescript
{
  id: 'rn-activity-indicator',
  name: 'ActivityIndicator',
  rnName: 'ActivityIndicator',
  importPath: 'react-native',
  category: 'feedback',
  description: 'Indicador de carga nativo (spinner nativo del SO)',
  props: [
    { name: 'animating', type: 'boolean', default: true },
    { name: 'color', type: 'color', default: '#999' },
    { name: 'size', type: 'enum', values: ['small', 'large'], default: 'small' },
    { name: 'hidesWhenStopped', type: 'boolean', default: true }
  ],
  styleSupport: { dimensions: ['width', 'height'], margin: true },
  childrenType: 'none',
  webEquivalent: null
}
```

### 2.12 Modal (nativo RN)

```typescript
{
  id: 'rn-modal',
  name: 'Modal',
  rnName: 'Modal',
  importPath: 'react-native',
  category: 'feedback',
  description: 'Modal nativo del SO (no un div con overlay como web)',
  props: [
    { name: 'visible', type: 'boolean', required: true },
    { name: 'animationType', type: 'enum', values: ['none', 'slide', 'fade'], default: 'none' },
    { name: 'transparent', type: 'boolean', default: false },
    { name: 'onShow', type: 'event' },
    { name: 'onDismiss', type: 'event' },
    { name: 'onRequestClose', type: 'event', required: true },
    { name: 'presentationStyle', type: 'enum', values: ['fullScreen', 'pageSheet', 'formSheet', 'overFullScreen'] },
    { name: 'supportedOrientations', type: 'array-of-enum', values: ['portrait', 'landscape'] },
    { name: 'statusBarTranslucent', type: 'boolean', default: false }
  ],
  styleSupport: null,
  childrenType: 'multiple',
  webEquivalent: 'Modal'
}
```

### 2.13 Switch

```typescript
{
  id: 'rn-switch',
  name: 'Switch',
  rnName: 'Switch',
  importPath: 'react-native',
  category: 'form',
  description: 'Toggle nativo del SO (iOS UISwitch / Android Switch)',
  props: [
    { name: 'value', type: 'boolean', binding: true, required: true },
    { name: 'onValueChange', type: 'event', params: ['value'], required: true },
    { name: 'disabled', type: 'boolean', default: false },
    { name: 'trackColor', type: 'object', props: { true: 'color', false: 'color' } },
    { name: 'thumbColor', type: 'color' },
    { name: 'ios_backgroundColor', type: 'color' }
  ],
  styleSupport: null,
  childrenType: 'none',
  webEquivalent: null
}
```

---

## 3. Componentes Web que cambian en RN

### 3.1 Text (diferencia critica)

```typescript
{
  id: 'rn-text',
  name: 'Text',
  rnName: 'Text',
  importPath: 'react-native',
  category: 'typography',
  description: 'Componente de texto. En RN no existe p/span/h1, todo es Text',
  webEquivalent: 'Text',
  props: [
    { name: 'children', type: 'string', required: true },
    { name: 'selectable', type: 'boolean', default: false },
    { name: 'numberOfLines', type: 'number', description: 'Maximo de lineas antes de truncar' },
    { name: 'ellipsizeMode', type: 'enum', values: ['head', 'middle', 'tail', 'clip'], default: 'tail' },
    { name: 'onPress', type: 'event' },
    { name: 'onLongPress', type: 'event' },
    { name: 'allowFontScaling', type: 'boolean', default: true },
    { name: 'adjustsFontSizeToFit', type: 'boolean', default: false },
    { name: 'minimumFontScale', type: 'number', range: [0, 1], default: 0.5 },
    { name: 'suppressHighlighting', type: 'boolean', default: false },
    { name: 'dataDetectorType', type: 'enum', values: ['phoneNumber', 'link', 'email', 'none'], default: 'none' }
  ],
  styleSupport: {
    fontFamily: true, fontSize: true, fontWeight: true,
    color: true, lineHeight: true, textAlign: true,
    textDecorationLine: true, textTransform: true,
    letterSpacing: true, fontStyle: true,
    textShadowColor: true, textShadowOffset: true, textShadowRadius: true,
    writingDirection: true
  },
  mapDifferences: {
    noTagSemantics: "Web usa p, span, h1-h6. RN solo Text. No hay diferencia semantica entre headings y body",
    nesting: "En RN, Text puede anidar otros Text (hereda estilos del padre)",
    styleInheritance: "Los estilos de Text NO se heredan a hijos RN (diferente a CSS)"
  }
}
```

### 3.2 Image

```typescript
{
  id: 'rn-image',
  name: 'Image',
  rnName: 'Image',
  importPath: 'react-native',
  category: 'media',
  description: 'Imagen nativa. No existe img, solo Image',
  webEquivalent: 'Image',
  props: [
    { name: 'source', type: 'object', required: true,
      variants: [
        { label: 'URI remota', value: { uri: 'https://...' } },
        { label: 'Require local', value: 'require("./image.png")' }
      ]
    },
    { name: 'resizeMode', type: 'enum', values: ['cover', 'contain', 'stretch', 'repeat', 'center'], default: 'cover' },
    { name: 'blurRadius', type: 'number', default: 0 },
    { name: 'fadeDuration', type: 'number', default: 300 },
    { name: 'loadingIndicatorSource', type: 'source' },
    { name: 'onLoad', type: 'event', params: ['event'] },
    { name: 'onLoadEnd', type: 'event' },
    { name: 'onLoadStart', type: 'event' },
    { name: 'onError', type: 'event', params: ['error'] },
    { name: 'progressiveRenderingEnabled', type: 'boolean', default: false },
    { name: 'defaultSource', type: 'source' },
    { name: 'tintColor', type: 'color' },
    { name: 'alt', type: 'string', description: 'Texto alternativo (accesibilidad)' }
  ],
  styleSupport: {
    dimensions: true, borderRadius: true,
    tintColor: true, overlayColor: true
  },
  mapDifferences: {
    noAltAttr: "En RN no hay alt nativo. Se usa accessibilityLabel",
    sourceSyntax: "Web: src='url'. RN: source={{ uri: 'url' }}",
    mustSize: "En RN Image DEBE tener width/height explicitos (no auto-sizing como web)"
  }
}
```

### 3.3 TextInput

```typescript
{
  id: 'rn-text-input',
  name: 'TextInput',
  rnName: 'TextInput',
  importPath: 'react-native',
  category: 'form',
  description: 'Campo de texto nativo. No existe input, solo TextInput',
  webEquivalent: 'Input',
  props: [
    { name: 'value', type: 'string', binding: true },
    { name: 'onChangeText', type: 'event', params: ['text'] },
    { name: 'placeholder', type: 'string' },
    { name: 'placeholderTextColor', type: 'color' },
    { name: 'keyboardType', type: 'enum', values: ['default', 'email-address', 'numeric', 'phone-pad', 'url', 'decimal-pad', 'web-search', 'number-pad'] },
    { name: 'returnKeyType', type: 'enum', values: ['done', 'go', 'next', 'search', 'send', 'none', 'default'] },
    { name: 'secureTextEntry', type: 'boolean', default: false },
    { name: 'multiline', type: 'boolean', default: false },
    { name: 'numberOfLines', type: 'number', default: 1 },
    { name: 'maxLength', type: 'number' },
    { name: 'editable', type: 'boolean', default: true },
    { name: 'autoCapitalize', type: 'enum', values: ['none', 'sentences', 'words', 'characters'] },
    { name: 'autoCorrect', type: 'boolean', default: true },
    { name: 'autoFocus', type: 'boolean', default: false },
    { name: 'blurOnSubmit', type: 'boolean', default: false },
    { name: 'clearButtonMode', type: 'enum', values: ['never', 'while-editing', 'unless-editing', 'always'] },
    { name: 'onFocus', type: 'event' },
    { name: 'onBlur', type: 'event' },
    { name: 'onSubmitEditing', type: 'event', params: ['text'] },
    { name: 'onKeyPress', type: 'event' },
    { name: 'onEndEditing', type: 'event' },
    { name: 'textContentType', type: 'enum', values: ['none', 'URL', 'emailAddress', 'password', 'username', 'telephoneNumber'] },
    { name: 'inputMode', type: 'enum', values: ['none', 'text', 'decimal', 'numeric', 'tel', 'search', 'email', 'url'] }
  ],
  styleSupport: {
    typography: true, borders: true, padding: true, margin: true,
    backgroundColor: true, textAlign: true,
    textAlignVertical: true, writingDirection: true,
    textDecorationLine: true
  },
  mapDifferences: {
    noTypeAttr: "En RN no existe type='email'/'number'. Se usa keyboardType",
    eventName: "Web: onChange. RN: onChangeText (recibe string directo)",
    noPattern: "No existe pattern/validacion nativa. Validar en onChangeText",
    stylingRoot: "TextInput acepta style directamente, no requiere wrapper"
  }
}
```

### 3.4 ScrollView

```typescript
{
  id: 'rn-scroll-view',
  name: 'ScrollView',
  rnName: 'ScrollView',
  importPath: 'react-native',
  category: 'layout',
  description: 'Contenedor con scroll nativo. En RN no existe overflow:scroll CSS',
  webEquivalent: 'Container',
  props: [
    { name: 'horizontal', type: 'boolean', default: false },
    { name: 'showsVerticalScrollIndicator', type: 'boolean', default: true },
    { name: 'showsHorizontalScrollIndicator', type: 'boolean', default: true },
    { name: 'pagingEnabled', type: 'boolean', default: false },
    { name: 'snapToInterval', type: 'number' },
    { name: 'snapToAlignment', type: 'enum', values: ['start', 'center', 'end'], default: 'start' },
    { name: 'contentContainerStyle', type: 'style' },
    { name: 'keyboardShouldPersistTaps', type: 'enum', values: ['never', 'always', 'handled'], default: 'never' },
    { name: 'onScroll', type: 'event', params: ['nativeEvent'] },
    { name: 'scrollEnabled', type: 'boolean', default: true },
    { name: 'nestedScrollEnabled', type: 'boolean', default: false },
    { name: 'refreshControl', type: 'slot', description: 'Componente RefreshControl' },
    { name: 'bounces', type: 'boolean', default: true },
    { name: 'overScrollMode', type: 'enum', values: ['auto', 'always', 'never'], default: 'auto' },
    { name: 'directionalLockEnabled', type: 'boolean', default: false }
  ],
  styleSupport: { flexbox: true, dimensions: true, padding: true },
  childrenType: 'multiple',
  mapDifferences: {
    componentNotCSS: "Web: overflow:scroll en CSS. RN: componente ScrollView obligatorio",
    flexDirection: "horizontal=true en RN = flexDirection:row + scroll horizontal",
    performance: "ScrollView renderiza TODO. FlatList es mejor para listas largas"
  }
}
```

### 3.5 Button (RN nativo)

```typescript
{
  id: 'rn-button',
  name: 'Button (Native)',
  rnName: 'Button',
  importPath: 'react-native',
  category: 'interaction',
  description: 'Boton nativo del sistema. MUY limitado en personalizacion',
  webEquivalent: 'Button',
  props: [
    { name: 'title', type: 'string', required: true },
    { name: 'onPress', type: 'event', required: true },
    { name: 'color', type: 'color', description: 'Color del texto (iOS) o background (Android)' },
    { name: 'disabled', type: 'boolean', default: false },
    { name: 'accessibilityLabel', type: 'string' }
  ],
  styleSupport: null,
  childrenType: 'none',
  mapDifferences: {
    noStyle: "Button nativo RN NO acepta style. Usar TouchableOpacity + Text para estilo propio",
    titleProp: "Web: children text. RN: prop title. Diferencia clave en JSON",
    crossPlatform: "Se ve distinto en iOS vs Android"
  }
}
```

---

## 4. Componentes Nativos Especificos

### 4.1 NavigationContainer

```typescript
{
  id: 'rn-nav-container',
  name: 'NavigationContainer',
  rnName: 'NavigationContainer',
  importPath: '@react-navigation/native',
  category: 'navigation',
  description: 'Wrapper raiz de navegacion. Debe envolver toda la app',
  dependencies: ['@react-navigation/native', 'react-native-screens', 'react-native-safe-area-context'],
  props: [
    { name: 'linking', type: 'object', description: 'Config de deep linking' },
    { name: 'onStateChange', type: 'event' },
    { name: 'initialState', type: 'object' },
    { name: 'fallback', type: 'component', description: 'Componente mostrado mientras carga' },
    { name: 'theme', type: 'object', props: { colors: 'object', dark: 'boolean' } },
    { name: 'independent', type: 'boolean', default: false }
  ],
  styleSupport: null,
  childrenType: 'multiple'
}
```

### 4.2 Stack.Navigator

```typescript
{
  id: 'rn-stack-navigator',
  name: 'Stack Navigator',
  rnName: 'createNativeStackNavigator()',
  importPath: '@react-navigation/native-stack',
  category: 'navigation',
  description: 'Navegacion tipo pila (stack). Transiciones nativas entre pantallas',
  dependencies: ['@react-navigation/native-stack'],
  props: [
    { name: 'initialRouteName', type: 'string' },
    { name: 'screenOptions', type: 'object', group: 'navigation-options' },
    { name: 'screens', type: 'array-of-screen', description: 'Array de pantallas del stack' }
  ],
  screenOptions: {
    headerShown: { type: 'boolean', default: true },
    headerTitle: { type: 'string' },
    headerBackTitle: { type: 'string' },
    headerStyle: { type: 'style' },
    headerTintColor: { type: 'color' },
    headerTitleStyle: { type: 'style' },
    headerTransparent: { type: 'boolean', default: false },
    headerLargeTitle: { type: 'boolean', default: false },
    animation: { type: 'enum', values: ['default', 'fade', 'flip', 'none', 'slide_from_bottom', 'slide_from_right', 'slide_from_left'] },
    gestureEnabled: { type: 'boolean', default: true },
    presentation: { type: 'enum', values: ['card', 'modal', 'transparentModal', 'formSheet'] },
    orientation: { type: 'enum', values: ['default', 'all', 'portrait', 'landscape'] }
  }
}
```

### 4.3 Tab.Navigator

```typescript
{
  id: 'rn-tab-navigator',
  name: 'Tab Navigator',
  rnName: 'createBottomTabNavigator()',
  importPath: '@react-navigation/bottom-tabs',
  category: 'navigation',
  description: 'Navegacion con pestanas inferiores estilo iOS/Android',
  dependencies: ['@react-navigation/bottom-tabs'],
  props: [
    { name: 'initialRouteName', type: 'string' },
    { name: 'screenOptions', type: 'object', group: 'tab-navigation-options' },
    { name: 'tabBarOptions', type: 'object', group: 'tab-bar-options' },
    { name: 'screens', type: 'array-of-tab-screen' }
  ],
  screenOptions: {
    headerShown: { type: 'boolean', default: true },
    tabBarIcon: { type: 'slot' },
    tabBarLabel: { type: 'string' },
    tabBarBadge: { type: 'number' },
    tabBarShowIcon: { type: 'boolean', default: true },
    tabBarShowLabel: { type: 'boolean', default: true },
    tabBarActiveTintColor: { type: 'color' },
    tabBarInactiveTintColor: { type: 'color' },
    tabBarActiveBackgroundColor: { type: 'color' },
    tabBarInactiveBackgroundColor: { type: 'color' },
    tabBarItemStyle: { type: 'style' },
    tabBarLabelStyle: { type: 'style' },
    tabBarIconStyle: { type: 'style' }
  }
}
```

### 4.4 Drawer.Navigator

```typescript
{
  id: 'rn-drawer-navigator',
  name: 'Drawer Navigator',
  rnName: 'createDrawerNavigator()',
  importPath: '@react-navigation/drawer',
  category: 'navigation',
  description: 'Navegacion con menu lateral tipo hamburguesa',
  dependencies: ['@react-navigation/drawer', 'react-native-gesture-handler', 'react-native-reanimated'],
  props: [
    { name: 'initialRouteName', type: 'string' },
    { name: 'screenOptions', type: 'object', group: 'drawer-options' },
    { name: 'drawerContent', type: 'slot' },
    { name: 'screens', type: 'array-of-screen' }
  ],
  screenOptions: {
    headerShown: { type: 'boolean', default: true },
    drawerIcon: { type: 'slot' },
    drawerLabel: { type: 'string' },
    drawerActiveTintColor: { type: 'color' },
    drawerInactiveTintColor: { type: 'color' },
    drawerActiveBackgroundColor: { type: 'color' },
    drawerInactiveBackgroundColor: { type: 'color' },
    drawerItemStyle: { type: 'style' },
    drawerLabelStyle: { type: 'style' },
    drawerType: { type: 'enum', values: ['front', 'back', 'slide', 'permanent'] },
    drawerPosition: { type: 'enum', values: ['left', 'right'] },
    swipeEnabled: { type: 'boolean', default: true },
    swipeEdgeWidth: { type: 'number' },
    swipeMinDistance: { type: 'number' }
  }
}
```

### 4.5 Gesture Handler: Swipeable

```typescript
{
  id: 'rn-swipeable',
  name: 'Swipeable',
  rnName: 'Swipeable',
  importPath: 'react-native-gesture-handler',
  category: 'gesture',
  description: 'Componente deslizable con acciones laterales (swipe to delete/reply)',
  dependencies: ['react-native-gesture-handler'],
  props: [
    { name: 'renderLeftActions', type: 'slot', params: ['progress', 'dragX'] },
    { name: 'renderRightActions', type: 'slot', params: ['progress', 'dragX'] },
    { name: 'onSwipeableOpen', type: 'event' },
    { name: 'onSwipeableClose', type: 'event' },
    { name: 'onSwipeableWillOpen', type: 'event' },
    { name: 'onSwipeableWillClose', type: 'event' },
    { name: 'overshootLeft', type: 'boolean', default: true },
    { name: 'overshootRight', type: 'boolean', default: true },
    { name: 'friction', type: 'number', default: 1 },
    { name: 'enabled', type: 'boolean', default: true }
  ],
  childrenType: 'multiple',
  webEquivalent: null
}
```

### 4.6 Gesture Handler: PinchGesture

```typescript
{
  id: 'rn-pinch-gesture',
  name: 'PinchGestureHandler',
  rnName: 'PinchGestureHandler',
  importPath: 'react-native-gesture-handler',
  category: 'gesture',
  description: 'Manejador de gesto de pellizco para zoom',
  dependencies: ['react-native-gesture-handler'],
  props: [
    { name: 'onGestureEvent', type: 'event', params: ['nativeEvent'] },
    { name: 'onHandlerStateChange', type: 'event', params: ['event'] },
    { name: 'minPointers', type: 'number', default: 2 },
    { name: 'maxPointers', type: 'number', default: 2 },
    { name: 'enabled', type: 'boolean', default: true },
    { name: 'simultaneousHandlers', type: 'ref' },
    { name: 'waitFor', type: 'ref' }
  ],
  childrenType: 'multiple',
  webEquivalent: null
}
```

### 4.7 PanResponder

```typescript
{
  id: 'rn-pan-responder',
  name: 'PanResponder',
  rnName: 'PanResponder',
  importPath: 'react-native',
  category: 'gesture',
  type: 'utility',
  description: 'Sistema de gestos tactiles low-level (arrastrar, soltar, gestos personalizados)',
  props: [
    { name: 'onStartShouldSetPanResponder', type: 'function', return: 'boolean' },
    { name: 'onMoveShouldSetPanResponder', type: 'function', return: 'boolean' },
    { name: 'onPanResponderGrant', type: 'event' },
    { name: 'onPanResponderMove', type: 'event', params: ['gestureState'] },
    { name: 'onPanResponderRelease', type: 'event' },
    { name: 'onPanResponderTerminate', type: 'event' },
    { name: 'onPanResponderTerminationRequest', type: 'function', return: 'boolean' }
  ],
  childrenType: 'none'
}
```

### 4.8 Animated (API core RN)

```typescript
{
  id: 'rn-animated-view',
  name: 'Animated.View',
  rnName: 'Animated.View',
  importPath: 'react-native',
  category: 'animation',
  description: 'View con soporte de animaciones via Animated API',
  props: [
    { name: 'animation', type: 'object', group: 'animation-config' },
    { name: 'useNativeDriver', type: 'boolean', default: true }
  ],
  childrenType: 'multiple',
  animationConfig: {
    type: { type: 'enum', values: ['timing', 'spring', 'decay'], default: 'timing' },
    duration: { type: 'number', default: 300 },
    delay: { type: 'number', default: 0 },
    easing: { type: 'enum', values: ['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out', 'bounce'] },
    loop: { type: 'boolean', default: false },
    property: { type: 'enum', values: ['opacity', 'translateX', 'translateY', 'scale', 'rotate', 'backgroundColor'] }
  }
}
```

### 4.9 Reanimated

```typescript
{
  id: 'rn-reanimated-view',
  name: 'Reanimated.View',
  rnName: 'Animated.View',
  importPath: 'react-native-reanimated',
  category: 'animation',
  description: 'View animable con Reanimated 3 (60fps en UI thread). Version moderna',
  dependencies: ['react-native-reanimated'],
  props: [
    { name: 'sharedValue', type: 'object' },
    { name: 'animatedStyle', type: 'style' },
    { name: 'entering', type: 'animation', description: 'Animacion de entrada' },
    { name: 'exiting', type: 'animation', description: 'Animacion de salida' },
    { name: 'layout', type: 'animation', description: 'Animacion de layout' }
  ],
  childrenType: 'multiple',
  webEquivalent: null
}
```

### 4.10 MapView

```typescript
{
  id: 'rn-map-view',
  name: 'MapView',
  rnName: 'MapView',
  importPath: 'react-native-maps',
  category: 'maps',
  description: 'Mapa nativo (Apple Maps en iOS, Google Maps en Android)',
  dependencies: ['react-native-maps'],
  props: [
    { name: 'region', type: 'object', required: true,
      props: {
        latitude: { type: 'number', required: true },
        longitude: { type: 'number', required: true },
        latitudeDelta: { type: 'number', default: 0.0922 },
        longitudeDelta: { type: 'number', default: 0.0421 }
      }
    },
    { name: 'initialRegion', type: 'object' },
    { name: 'mapType', type: 'enum', values: ['standard', 'satellite', 'hybrid', 'mutedStandard'], default: 'standard' },
    { name: 'showsUserLocation', type: 'boolean', default: false },
    { name: 'showsCompass', type: 'boolean', default: true },
    { name: 'zoomEnabled', type: 'boolean', default: true },
    { name: 'scrollEnabled', type: 'boolean', default: true },
    { name: 'rotateEnabled', type: 'boolean', default: true },
    { name: 'onPress', type: 'event', params: ['coordinate'] },
    { name: 'onLongPress', type: 'event', params: ['coordinate'] },
    { name: 'onRegionChangeComplete', type: 'event' },
    { name: 'markers', type: 'array-of-marker' }
  ],
  styleSupport: { dimensions: true, borderRadius: true },
  childrenType: 'multiple',
  webEquivalent: null
}
```

### 4.11 WebView

```typescript
{
  id: 'rn-webview',
  name: 'WebView',
  rnName: 'WebView',
  importPath: 'react-native-webview',
  category: 'web',
  description: 'Navegador web embebido dentro de la app RN',
  dependencies: ['react-native-webview'],
  props: [
    { name: 'source', type: 'object', required: true,
      variants: [
        { label: 'URL', value: { uri: 'https://...' } },
        { label: 'HTML', value: { html: '<html>...</html>' } }
      ]
    },
    { name: 'onLoadStart', type: 'event' },
    { name: 'onLoadEnd', type: 'event' },
    { name: 'onLoad', type: 'event' },
    { name: 'onError', type: 'event', params: ['syntheticEvent'] },
    { name: 'onNavigationStateChange', type: 'event', params: ['navState'] },
    { name: 'onMessage', type: 'event', params: ['message'] },
    { name: 'injectedJavaScript', type: 'string' },
    { name: 'allowsInlineMediaPlayback', type: 'boolean', default: false },
    { name: 'bounces', type: 'boolean', default: true },
    { name: 'scrollEnabled', type: 'boolean', default: true },
    { name: 'javaScriptEnabled', type: 'boolean', default: true },
    { name: 'domStorageEnabled', type: 'boolean', default: true },
    { name: 'startInLoadingState', type: 'boolean', default: false },
    { name: 'renderLoading', type: 'slot' },
    { name: 'renderError', type: 'slot', params: ['errorName', 'errorDescription'] }
  ],
  styleSupport: { dimensions: true, borderRadius: true },
  childrenType: 'none',
  webEquivalent: 'IFrame'
}
```

### 4.12 Device APIs

```typescript
// Utility components (hooks / imperatives):
const RNDeviceAPIs = [
  {
    id: 'rn-linking',
    name: 'Linking',
    rnName: 'Linking',
    importPath: 'react-native',
    category: 'device',
    type: 'utility',
    description: 'Abrir URLs externas (tel:, mailto:, https:)',
    props: [{ name: 'url', type: 'string', required: true }],
    childrenType: 'none'
  },
  {
    id: 'rn-share',
    name: 'Share',
    rnName: 'Share',
    importPath: 'react-native',
    category: 'device',
    type: 'utility',
    description: 'Compartir usando el share sheet nativo',
    props: [
      { name: 'message', type: 'string', required: true },
      { name: 'title', type: 'string' },
      { name: 'url', type: 'string' }
    ],
    childrenType: 'none'
  },
  {
    id: 'rn-vibration',
    name: 'Vibration',
    rnName: 'Vibration',
    importPath: 'react-native',
    category: 'device',
    type: 'utility',
    description: 'Controlar la vibracion del dispositivo',
    props: [
      { name: 'pattern', type: 'array-of-number' },
      { name: 'repeat', type: 'boolean', default: false },
      { name: 'duration', type: 'number', default: 400 }
    ],
    childrenType: 'none'
  }
];
```

---

## 5. Mapeo Componente Web → RN

### 5.1 Tabla de Mapeo Directo

| Componente Web | Componente RN | Tipo | Diferencias Clave |
|---------------|--------------|------|-------------------|
| **Button** | `TouchableOpacity` + `Text` | Estructural | Web: `<button>`. RN: wrapper + Text hijo. Button nativo es limitado |
| **Text** | `Text` | Directo | Web: `<p>`, `<span>`, `<h1>`. RN: solo `<Text>`. No hay semantica de heading |
| **Input** | `TextInput` | Nombre + Props | Web: `<input>`. RN: `<TextInput>`. onChangeText vs onChange. keyboardType vs type |
| **Image** | `Image` | Props | Web: `src="url"`. RN: `source={{uri: "url"}}`. Debe tener width/height explicitos |
| **Textarea** | `TextInput multiline` | Prop | Web: `<textarea>`. RN: TextInput con `multiline={true}` |
| **Select** | `Picker` o custom | Opcional | Web: `<select>`. RN: `@react-native-picker/picker` o Modal con FlatList |
| **Checkbox** | `Switch` o custom | Estructural | Web: `<input type="checkbox">`. RN: `Switch` nativo o TouchableOpacity con icono |
| **Radio** | Custom con TouchableOpacity | Estructural | Web: `<input type="radio">`. RN: no existe nativo. Se construye con estado + iconos |
| **Form** | `View` + TextInputs | Estructural | Web: `<form>`. RN: View contenedor. No hay evento submit nativo |
| **Modal** | `Modal` | Nombre | Web: div+overlay con CSS. RN: Modal nativo del SO. animationType en vez de CSS transitions |
| **Table** | `FlatList` | Arquitectura | Web: `<table>`. RN: FlatList con columnas. RN no tiene tabla nativa |
| **Container** | `View` | Directo | View de RN es el equivalente directo del `<div>` web |
| **ScrollView** | `ScrollView` | Componente | Web: `overflow:scroll`. RN: componente ScrollView obligatorio |
| **Spinner** | `ActivityIndicator` | Nombre | Web: CSS spinner o libreria. RN: ActivityIndicator nativo |
| **Divider** | `View style={borderBottom}` | Estructural | Web: `<hr>`. RN: View con borderBottom o height fijo |
| **IFrame** | `WebView` | Dependencia | Web: `<iframe>`. RN: react-native-webview. Mucho mas configurable |
| **Icon** | `Image` o vector icon | Dependencia | Web: `<i class="icon">`. RN: react-native-vector-icons o Image |
| **Slider** | `Slider` | Directo | Web: `<input type="range">`. RN: `@react-native-community/slider` |

### 5.2 Transformacion de Props

```json
// WEB (Input) → RN (TextInput)
// onChange  → onChangeText
// value     → value (igual)
// type="email" → keyboardType="email-address"
// type="password" → secureTextEntry={true}
// type="number" → keyboardType="numeric"
// pattern   → NO EXISTE en RN, validar en onChangeText
// maxLength → maxLength (igual)

// WEB (Image) → RN (Image)
// src="url" → source={{ uri: "url" }}
// alt="text" → accessibilityLabel="text"
// class/css → style (camelCase, sin unidades)
// width/height en CSS → width/height obligatorios en style
```

### 5.3 Mapeo de Estilos CSS → RN

| CSS Property | RN Style | Notas |
|-------------|----------|-------|
| `display: flex` | por defecto | RN usa flexbox por defecto |
| `flex-direction: row` | `flexDirection: 'row'` | camelCase, strings |
| `justify-content: center` | `justifyContent: 'center'` | camelCase |
| `align-items: center` | `alignItems: 'center'` | camelCase |
| `margin-top: 10px` | `marginTop: 10` | Sin unidades, solo numeros |
| `padding: 10px 20px` | `paddingHorizontal: 20, paddingVertical: 10` | No shorthand |
| `border: 1px solid #000` | `borderWidth: 1, borderColor: '#000'` | Desglosado |
| `width: 100%` | `width: '100%'` | Strings para % |
| `box-shadow: 0 2px...` | `shadowColor, shadowOffset, shadowOpacity, shadowRadius` | Props separadas |
| `background: #fff` | `backgroundColor: '#fff'` | No `background` shorthand |
| `font-size: 16px` | `fontSize: 16` | Sin unidades |
| `font-weight: bold` | `fontWeight: 'bold'` | Strings o numeros |
| `overflow: hidden` | `overflow: 'hidden'` | camelCase |
| `position: absolute` | `position: 'absolute'` | 'relative' por defecto |
| `cursor: pointer` | No equivalente | RN no tiene cursor |
| `:hover` | `Pressable` + estado | RN no tiene :hover nativo |

---

## 6. Registry de Componentes RN en UI Studio

### 6.1 Estructura del Registry

```typescript
interface RNComponentRegistry {
  platform: 'react-native';
  version: string;
  lastUpdated: string;
  categories: RNCategory[];
  components: Map<string, RNComponentDefinition>;
  dependencies: RNPackageDependency[];
  webToRNMap: Map<string, string>;
}

interface RNCategory {
  id: string;
  name: string;
  icon: string;
  order: number;
  color: string;
}

interface RNPackageDependency {
  package: string;
  version: string;
  isCore: boolean;
  optional: boolean;
  description: string;
}
```

### 6.2 Categorias de la Palette RN

```json
[
  { "id": "layout",      "name": "Layout",       "icon": "grid_view",     "order": 1,  "color": "#0ba5ec" },
  { "id": "typography",  "name": "Tipografia",   "icon": "text_fields",   "order": 2,  "color": "#a78bfa" },
  { "id": "form",        "name": "Formularios",   "icon": "edit_note",     "order": 3,  "color": "#34d399" },
  { "id": "interaction", "name": "Interaccion",   "icon": "touch_app",     "order": 4,  "color": "#fb923c" },
  { "id": "feedback",    "name": "Feedback",      "icon": "notifications", "order": 5,  "color": "#f472b6" },
  { "id": "navigation",  "name": "Navegacion",    "icon": "navigation",    "order": 6,  "color": "#818cf8" },
  { "id": "data-display","name": "Datos",         "icon": "table_chart",   "order": 7,  "color": "#fbbf24" },
  { "id": "animation",   "name": "Animaciones",   "icon": "animation",     "order": 8,  "color": "#e879f9" },
  { "id": "gesture",     "name": "Gestos",         "icon": "gesture",       "order": 9,  "color": "#6ee7b7" },
  { "id": "media",       "name": "Multimedia",     "icon": "image",         "order": 10, "color": "#60a5fa" },
  { "id": "maps",        "name": "Mapas",          "icon": "map",           "order": 11, "color": "#4ade80" },
  { "id": "device",      "name": "Dispositivo",    "icon": "phone_android", "order": 12, "color": "#f87171" },
  { "id": "web",         "name": "Web embebida",   "icon": "language",      "order": 13, "color": "#38bdf8" },
  { "id": "platform",    "name": "Plataforma",     "icon": "settings",      "order": 14, "color": "#9ca3af" }
]
```

### 6.3 Dependencias npm por Componente

| Componente | Dependencia | Version | Core |
|-----------|------------|---------|------|
| Todos (core RN) | `react-native` | `0.76.x` | Si |
| NavigationContainer | `@react-navigation/native` | `^6.x` | No |
| Stack.Navigator | `@react-navigation/native-stack` | `^6.x` | No |
| Tab.Navigator | `@react-navigation/bottom-tabs` | `^6.x` | No |
| Drawer.Navigator | `@react-navigation/drawer` | `^6.x` | No |
| Swipeable, PinchGesture | `react-native-gesture-handler` | `^2.x` | No |
| Reanimated.* | `react-native-reanimated` | `^3.x` | No |
| SafeAreaView | `react-native-safe-area-context` | `^4.x` | No* |
| MapView | `react-native-maps` | `^1.x` | No |
| WebView | `react-native-webview` | `^13.x` | No |
| Clipboard | `@react-native-clipboard/clipboard` | `^1.x` | No |
| Slider | `@react-native-community/slider` | `^4.x` | No |
| Picker | `@react-native-picker/picker` | `^2.x` | No |

### 6.4 Flujo de Registro en Palette

```
Usuario selecciona target "React Native"
    ↓
UI Studio filtra components: solo targets.includes('react-native')
    ↓
Agrupa por categoria RN
    ↓
Renderiza palette con iconos y colores RN
    ↓
Al arrastrar componente, se usa la definicion RN para:
  - Generar import path correcto
  - Mostrar props especificas RN en inspector
  - Generar codigo RN al exportar
```

### 6.5 Ejemplo de Registry Dinamico

```javascript
const rnRegistry = {
  platform: 'react-native',
  version: '1.0.0',
  categories: RN_CATEGORIES,
  components: [
    RN_SAFE_AREA_VIEW,
    RN_FLAT_LIST,
    RN_TOUCHABLE_OPACITY,
    RN_NAV_CONTAINER,
    RN_ACTIVITY_INDICATOR,
    RN_MODAL,
    RN_REFRESH_CONTROL,
    RN_SWIPEABLE,
    RN_MAP_VIEW,
    RN_WEBVIEW,
  ],
  webToRNMap: {
    'web-button': 'rn-touchable-opacity',
    'web-text': 'rn-text',
    'web-input': 'rn-text-input',
    'web-image': 'rn-image',
    'web-container': 'rn-view',
    'web-modal': 'rn-modal',
    'web-scroll': 'rn-scroll-view',
    'web-spinner': 'rn-activity-indicator',
    'web-table': 'rn-flat-list',
    'web-textarea': 'rn-text-input',
    'web-iframe': 'rn-webview',
  },
  dependencies: [
    { package: '@react-navigation/native', version: '^6.1.0', optional: false },
    { package: 'react-native-screens', version: '^3.29.0', optional: false },
    { package: 'react-native-safe-area-context', version: '^4.8.0', optional: false },
  ],
  exportConfig: {
    importStyle: 'named',
    useSemi: true,
    singleQuote: true,
    typescript: true,
    projectTemplate: {
      framework: 'react-native',
      initCommand: 'npx react-native init',
      entryPoint: 'App.tsx'
    }
  }
};
```

---

## 7. Palette UI por Categoria

### 7.1 Vista de Palette en UI Studio

```
+--- PALETTE -----------------------------+
| Buscar componentes...                   |
|                                          |
| -- Layout --                             |
| [View]  [SafeAreaView]  [ScrollView]    |
| [KeyboardAvoidingView]                   |
|                                          |
| -- Tipografia --                         |
| [Text]                                   |
|                                          |
| -- Formularios --                        |
| [TextInput]  [Switch]  [Picker]          |
|                                          |
| -- Interaccion --                        |
| [TouchableOpacity]  [TouchableHighlight] |
| [Pressable]  [Button Native]             |
|                                          |
| -- Feedback --                           |
| [ActivityIndicator]  [Modal]             |
| [RefreshControl]                         |
|                                          |
| -- Navegacion --                         |
| [NavContainer]  [Stack]  [Tab]  [Drawer] |
|                                          |
| -- Datos --                              |
| [FlatList]  [SectionList]               |
| [VirtualizedList]                        |
|                                          |
| -- Animaciones --                        |
| [Animated.View]  [Animated.Text]         |
| [Reanimated.View]  [LayoutAnimation]     |
|                                          |
| -- Gestos --                             |
| [Swipeable]  [PinchGesture]              |
| [PanResponder]                           |
|                                          |
| -- Multimedia --                         |
| [Image]  [Video]                         |
|                                          |
| -- Mapas --                              |
| [MapView]                                |
|                                          |
| -- Dispositivo --                        |
| [Linking]  [Share]  [Vibration]          |
| [Clipboard]  [CameraRoll]               |
|                                          |
| -- Web embebida --                       |
| [WebView]                                |
+------------------------------------------+
```

### 7.2 Indicadores Visuales

| Indicador | Significado |
|-----------|-------------|
| Azul | Componente exclusivo RN (no existe en web) |
| Verde | Componente que existe en web pero cambia en RN |
| Naranja | Componente que requiere dependencia externa |
| Icono rayo | Componente de navegacion (estructura app) |

---

## 8. Ejemplos de JSON → Codigo RN

### 8.1 Pantalla de Login

```json
{
  "component": "SafeAreaView",
  "props": { "edges": ["top", "bottom"] },
  "style": { "flex": 1, "backgroundColor": "#fff" },
  "children": [
    {
      "component": "KeyboardAvoidingView",
      "props": { "behavior": "padding" },
      "style": { "flex": 1, "justifyContent": "center", "paddingHorizontal": 24 },
      "children": [
        {
          "component": "Text",
          "props": { "style": { "fontSize": 32, "fontWeight": "bold", "textAlign": "center", "marginBottom": 48 } },
          "children": ["Bienvenido"]
        },
        {
          "component": "TextInput",
          "props": {
            "placeholder": "Email",
            "keyboardType": "email-address",
            "autoCapitalize": "none",
            "style": { "height": 48, "borderWidth": 1, "borderColor": "#ddd", "borderRadius": 8, "paddingHorizontal": 16, "marginBottom": 16 }
          }
        },
        {
          "component": "TextInput",
          "props": {
            "placeholder": "Contrasena",
            "secureTextEntry": true,
            "style": { "height": 48, "borderWidth": 1, "borderColor": "#ddd", "borderRadius": 8, "paddingHorizontal": 16, "marginBottom": 24 }
          }
        },
        {
          "component": "TouchableOpacity",
          "props": {
            "onPress": { "action": "navigate", "target": "Home" },
            "style": { "backgroundColor": "#0ba5ec", "paddingVertical": 14, "borderRadius": 8, "alignItems": "center" }
          },
          "children": [
            {
              "component": "Text",
              "props": { "style": { "color": "#fff", "fontSize": 16, "fontWeight": "600" } },
              "children": ["Iniciar Sesion"]
            }
          ]
        }
      ]
    }
  ]
}
```

### 8.2 Lista con Swipeable

```json
{
  "component": "FlatList",
  "props": {
    "data": { "binding": "guests", "source": "api" },
    "keyExtractor": "(item) => item.id.toString()",
    "contentContainerStyle": { "padding": 16 }
  },
  "renderItem": {
    "component": "Swipeable",
    "props": {
      "renderRightActions": [{
        "component": "TouchableOpacity",
        "props": {
          "style": { "backgroundColor": "#ef4444", "justifyContent": "center", "alignItems": "center", "width": 80 },
          "onPress": { "action": "delete", "target": "guest" }
        },
        "children": [{ "component": "Text", "props": { "style": { "color": "#fff" } }, "children": ["Eliminar"] }]
      }]
    },
    "children": [{
      "component": "View",
      "props": { "style": { "backgroundColor": "#fff", "padding": 16, "borderRadius": 12, "marginBottom": 8 } },
      "children": [
        { "component": "Text", "props": { "style": { "fontSize": 16, "fontWeight": "600" } }, "children": ["{item.name}"] },
        { "component": "Text", "props": { "style": { "fontSize": 14, "color": "#666", "marginTop": 4 } }, "children": ["{item.email}"] }
      ]
    }]
  }
}
```

### 8.3 Tab Navigation

```json
{
  "component": "NavigationContainer",
  "children": [{
    "component": "TabNavigator",
    "props": {
      "screenOptions": {
        "tabBarActiveTintColor": "#0ba5ec",
        "tabBarInactiveTintColor": "#999",
        "headerShown": false
      },
      "screens": [
        {
          "name": "Home",
          "component": { "ref": "screen-home" },
          "options": { "tabBarIcon": "home", "tabBarLabel": "Inicio" }
        },
        {
          "name": "Guests",
          "component": { "ref": "screen-guests" },
          "options": { "tabBarIcon": "people", "tabBarLabel": "Invitados" }
        },
        {
          "name": "Profile",
          "component": { "ref": "screen-profile" },
          "options": { "tabBarIcon": "person", "tabBarLabel": "Perfil" }
        }
      ]
    }
  }]
}
```

---

## Apendice A: Checklist de Implementacion

### A.1 Componentes Core RN (sin dependencias externas)
- [ ] SafeAreaView
- [ ] StatusBar
- [ ] KeyboardAvoidingView
- [ ] View (mapeo de div)
- [ ] Text
- [ ] TextInput
- [ ] Image
- [ ] ScrollView
- [ ] TouchableOpacity
- [ ] TouchableHighlight
- [ ] Pressable
- [ ] FlatList
- [ ] SectionList
- [ ] VirtualizedList
- [ ] ActivityIndicator
- [ ] Modal
- [ ] RefreshControl
- [ ] Button (nativo)
- [ ] Switch
- [ ] Linking
- [ ] Share
- [ ] Vibration
- [ ] PanResponder
- [ ] Animated.View
- [ ] Animated.Text
- [ ] Animated.Image
- [ ] LayoutAnimation
- [ ] Platform (utility)
- [ ] useWindowDimensions (hook)

### A.2 Con Dependencias Externas
- [ ] NavigationContainer (@react-navigation/native)
- [ ] StackNavigator (@react-navigation/native-stack)
- [ ] TabNavigator (@react-navigation/bottom-tabs)
- [ ] DrawerNavigator (@react-navigation/drawer)
- [ ] MapView + Marker (react-native-maps)
- [ ] WebView (react-native-webview)
- [ ] Swipeable (react-native-gesture-handler)
- [ ] PinchGestureHandler (react-native-gesture-handler)
- [ ] Reanimated.View (react-native-reanimated)
- [ ] CameraRoll (@react-native-camera-roll/camera-roll)
- [ ] Clipboard (@react-native-clipboard/clipboard)
- [ ] Picker (@react-native-picker/picker)
- [ ] Slider (@react-native-community/slider)

### A.3 Registry y Palette
- [ ] Sistema de targets (web / react-native / both)
- [ ] Filtro de palette por target
- [ ] Web to RN mapper (transformacion de JSON)
- [ ] RN style transformer (CSS a RN StyleSheet)
- [ ] Generador de imports RN
- [ ] RN dependency collector
- [ ] Template de proyecto RN inicial

---

> **Documento generado para UI Studio**
> *Version 1.0 — Catalog RN Components*
> *Ultima actualizacion: 20 de mayo de 2026*

