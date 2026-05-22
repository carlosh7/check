# UI Studio — Exportación y Publicación de Apps Móviles

> **Versión del diseño:** 1.0  
> **Proyecto:** UI Studio — Visual App Builder Universal  
> **Contexto:** UI Studio genera layouts universales (JSON). Este documento detalla cómo exportar esos layouts a apps móviles funcionales vía Capacitor y React Native.

---

## Tabla de Contenidos

1. [Arquitectura General](#1-arquitectura-general)
2. [Capacitor Export Pipeline](#2-capacitor-export-pipeline)
3. [React Native Export Pipeline](#3-react-native-export-pipeline)
4. [Mobile Publishing Workflow](#4-mobile-publishing-workflow)
5. [Live Edit para RN (Dev Mode)](#5-live-edit-para-rn-dev-mode)
6. [Template Projects](#6-template-projects)
7. [Esfuerzo Estimado por Componente](#7-esfuerzo-estimado-por-componente)

---

## 1. Arquitectura General

```
┌─────────────────────────────────────────────────────────────────────┐
│                        UI STUDIO (Editor)                           │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Canvas visual → JSON Universal (layouts, actions, data)     │  │
│  └───────────────────────┬───────────────────────────────────────┘  │
│                          │                                          │
│           ┌──────────────┴──────────────┐                            │
│           ▼                              ▼                           │
│  ┌──────────────────┐       ┌──────────────────────┐                 │
│  │  Capacitor Export │       │  React Native Export │                │
│  │  (SPA + WebView)  │       │  (JSX + StyleSheet)  │                │
│  └────────┬─────────┘       └──────────┬───────────┘                │
│           │                            │                             │
│           ▼                            ▼                             │
│  ┌──────────────────┐       ┌──────────────────────┐                 │
│  │  Capacitor CLI   │       │  RN CLI / Expo CLI   │                │
│  │  build + sync    │       │  bundle + run        │                │
│  └────────┬─────────┘       └──────────┬───────────┘                │
│           │                            │                             │
│           ▼                            ▼                             │
│  ┌──────────────────┐       ┌──────────────────────┐                 │
│  │  iOS / Android   │       │  iOS / Android       │                │
│  │  Native Binary   │       │  Native Binary       │                │
│  └──────────────────┘       └──────────────────────┘                │
└─────────────────────────────────────────────────────────────────────┘
```

### Decisión Estratégica

| Ruta | Cuándo usarla | Ventaja | Desventaja |
|------|---------------|---------|------------|
| **Capacitor** | App existente web que se quiere llevar a mobile rápido | Mínimo rewrite, máximo código compartido (web + mobile) | Rendimiento WebView, sin acceso a APIs nativas complejas sin plugins |
| **React Native** | App mobile-first con UX nativa | Rendimiento nativo, animaciones 60fps, gesture handling | Doblaje de código (UI en RN, web aparte) |

---

## 2. Capacitor Export Pipeline

### 2.1 Flujo de Trabajo

```
UI Studio App JSON
       │
       ▼
┌──────────────────────────┐
│  SPA Generator           │
│  (HTML + CSS + JS)       │
│  - Convierte JSON a DOM  │
│  - Inyecta runtime JS    │
│  - Genera router SPA     │
│  - Genera assets estáticos│
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│  Capacitor Wrapper       │
│  - Crea proyecto npm     │
│  - Copia www/            │
│  - Genera config         │
│  - Instala plugins       │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│  Capacitor CLI           │
│  npx cap sync            │
│  npx cap open ios        │
│  npx cap open android    │
└──────────────────────────┘
```

### 2.2 Archivos Generados

```
my-capacitor-app/
├── package.json
├── capacitor.config.json
├── tsconfig.json
├── www/
│   ├── index.html              ← SPA entry point
│   ├── assets/
│   │   ├── ui-studio-runtime.js ← Runtime que interpreta JSON
│   │   ├── ui-studio-styles.css ← Estilos generados
│   │   └── icons/               ← Iconos y splash screens
│   └── manifest.json            ← PWA manifest (fallback)
├── src/
│   ├── main.ts                  ← Punto de entrada Capacitor
│   ├── app.ts                   ← Inicialización runtime
│   └── plugins/
│       ├── camera-bridge.ts     ← Wrapper para @capacitor/camera
│       ├── push-bridge.ts       ← Wrapper para @capacitor/push-notifications
│       └── biometric-bridge.ts  ← Wrapper para @capacitor/biometric-auth
├── ios/
│   └── App/                     ← Proyecto Xcode (generado por cap sync)
├── android/
│   └── app/                     ← Proyecto Android (generado por cap sync)
└── resources/                   ← Iconos y splash (generados por cap resources)
```

**capacitor.config.json:**
```json
{
  "appId": "com.uistudio.myapp",
  "appName": "My App",
  "webDir": "www",
  "bundledWebRuntime": false,
  "server": {
    "androidScheme": "https",
    "iosScheme": "capacitor"
  },
  "plugins": {
    "SplashScreen": {
      "launchShowDuration": 2000
    },
    "PushNotifications": {
      "presentationOptions": ["badge", "sound", "alert"]
    }
  }
}
```

**package.json (generado):**
```json
{
  "name": "my-capacitor-app",
  "version": "1.0.0",
  "scripts": {
    "dev": "ui-studio serve",
    "build": "ui-studio build --format=capacitor",
    "sync": "npx cap sync",
    "open:ios": "npx cap open ios",
    "open:android": "npx cap open android",
    "build:ios": "npm run build && npx cap sync && npx cap run ios",
    "build:android": "npm run build && npx cap sync && npx cap run android"
  },
  "dependencies": {
    "@capacitor/core": "^7.0.0",
    "@capacitor/splash-screen": "^7.0.0",
    "@capacitor/status-bar": "^7.0.0",
    "@capacitor/camera": "^7.0.0",
    "@capacitor/push-notifications": "^7.0.0",
    "@capacitor/biometric-auth": "^7.0.0",
    "ui-studio-runtime": "^1.0.0"
  },
  "devDependencies": {
    "@capacitor/cli": "^7.0.0",
    "@capacitor/ios": "^7.0.0",
    "@capacitor/android": "^7.0.0"
  }
}
```

### 2.3 Integración de Plugins Nativos

UI Studio expone un sistema de **action bindings** que se mapean a Capacitor plugins:

```typescript
// www/assets/ui-studio-runtime.js

const nativeBridge = {
  async execute(action: UIAction): Promise<any> {
    switch (action.type) {
      case 'camera:capture':
        return Camera.getPhoto({
          quality: 90,
          resultType: CameraResultType.Uri
        });

      case 'camera:gallery':
        return Camera.pickImages({
          limit: action.payload?.maxImages || 1
        });

      case 'push:register':
        return PushNotifications.register();

      case 'push:schedule':
        return LocalNotifications.schedule({
          notifications: [action.payload]
        });

      case 'biometric:auth':
        return BiometricAuth.authenticate({
          reason: action.payload?.reason || 'Autenticación requerida'
        });

      default:
        // Fallback a fetch API
        return this.httpRequest(action);
    }
  },

  async httpRequest(action: UIAction): Promise<any> {
    return fetch(action.payload.url, {
      method: action.payload.method || 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: action.payload.body ? JSON.stringify(action.payload.body) : undefined
    }).then(r => r.json());
  }
};
```

### 2.4 Bridge WebView ↔ Código Nativo

Capacitor usa **Capacitor Bridge** (JS → Native) automáticamente:

```
WebView (UI Studio Runtime)
       │
       ├── Plugin.call('Camera', 'getPhoto', { quality: 90 })
       │         │
       │         ▼
       ├── Capacitor Bridge (JS)
       │         │
       │         ▼
       ├── WebView → Native Message (WKWebView / Android WebView)
       │         │
       │         ▼
       ├── Capacitor Native Plugin
       │         │
       │         ▼
       ├── Native API (AVFoundation / CameraX)
       │         │
       │         ▼
       └── Promise resolve → WebView
```

Para comunicación **Web → Native personalizada**, UI Studio genera:

```typescript
// src/plugins/custom-bridge.ts
import { registerPlugin } from '@capacitor/core';

export interface UIBridgePlugin {
  navigateTo(options: { screen: string; params: string }): Promise<void>;
  getDeviceInfo(): Promise<{ platform: string; version: string; isTablet: boolean }>;
}

const UIBridge = registerPlugin<UIBridgePlugin>('UIBridge', {
  web: () => import('./web').then(m => new m.UIBridgeWeb()),
});

export { UIBridge };
```

### 2.5 Comando CLI

```bash
# 1. Desde UI Studio generar el proyecto
ui-studio export --format=capacitor --out=./my-app

# 2. Navegar y sincronizar
cd my-app
npm install
npx cap sync

# 3. Abrir en Xcode / Android Studio
npx cap open ios
npx cap open android

# 4. O build directo
npx cap run ios --target="iPhone-15"
npx cap run android
```

**UI Studio también genera wrapper scripts:**

```bash
npm run dev          # Servir SPA local para pruebas web
npm run build        # Re-exportar SPA + sincronizar
npm run build:ios    # Build + sync + run iOS
```

---

## 3. React Native Export Pipeline

### 3.1 Flujo de Trabajo

```
UI Studio App JSON (Universal)
       │
       ▼
┌────────────────────────────────────┐
│  RN Code Generator                 │
│  (take universal JSON → JSX/TSX)  │
│                                    │
│  ┌──────────────────────────────┐  │
│  │  Layout Parser               │  │
│  │  (transforma nodos UI a RN)  │  │
│  └──────────┬───────────────────┘  │
│  ┌──────────┴───────────────────┐  │
│  │  Action Flow Compiler        │  │
│  │  (convierte action flows     │  │
│  │   a hooks + event handlers)  │  │
│  └──────────┬───────────────────┘  │
│  ┌──────────┴───────────────────┐  │
│  │  Navigation Generator       │  │
│  │  (genera React Navigation)  │  │
│  └──────────────────────────────┘  │
└──────────────────┬─────────────────┘
                   │
                   ▼
┌────────────────────────────────────┐
│  RN Project Scaffold               │
│  package.json + Metro config       │
│  TypeScript + ESLint + Prettier    │
└──────────────────┬─────────────────┘
                   │
                   ▼
┌────────────────────────────────────┐
│  npx react-native start            │
│  (Metro bundler)                   │
└────────────────────────────────────┘
```

### 3.2 Mapeo JSON Universal → JSX

```typescript
// Ejemplo de mapeo: JSON universal → RN components

// Input: JSON Universal de UI Studio
{
  "type": "screen",
  "name": "LoginScreen",
  "layout": "column",
  "padding": 24,
  "children": [
    {
      "type": "image",
      "source": "logo.png",
      "width": 120,
      "height": 120,
      "marginBottom": 32
    },
    {
      "type": "text",
      "value": "Iniciar Sesión",
      "variant": "h2",
      "align": "center",
      "marginBottom": 24
    },
    {
      "type": "input",
      "name": "email",
      "placeholder": "Correo electrónico",
      "keyboardType": "email",
      "marginBottom": 16
    },
    {
      "type": "input",
      "name": "password",
      "placeholder": "Contraseña",
      "secureText": true,
      "marginBottom": 24
    },
    {
      "type": "button",
      "label": "Ingresar",
      "variant": "primary",
      "action": {
        "type": "API_CALL",
        "method": "POST",
        "url": "/api/auth/login",
        "body": { "email": "{{form.email}}", "password": "{{form.password}}" },
        "onSuccess": { "type": "NAVIGATE", "screen": "Dashboard" },
        "onError": { "type": "SHOW_TOAST", "message": "{{response.error}}" }
      }
    }
  ]
}

// Output: RN Component generado
// screens/LoginScreen.tsx

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image,
  StyleSheet, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { apiClient } from '../services/api';

export function LoginScreen() {
  const navigation = useNavigation<any>();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleIngresar = async () => {
    setLoading(true);
    try {
      const response = await apiClient.post('/api/auth/login', form);
      navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Image
          source={require('../assets/logo.png')}
          style={styles.logo}
        />
        <Text style={styles.title}>Iniciar Sesión</Text>

        <TextInput
          style={styles.input}
          placeholder="Correo electrónico"
          keyboardType="email-address"
          autoCapitalize="none"
          value={form.email}
          onChangeText={v => setForm(p => ({ ...p, email: v }))}
        />

        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          secureTextEntry
          value={form.password}
          onChangeText={v => setForm(p => ({ ...p, password: v }))}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleIngresar}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  logo: { width: 120, height: 120, alignSelf: 'center', marginBottom: 32 },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center', marginBottom: 24, color: '#1a1a2e' },
  input: {
    borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 16,
    marginBottom: 16, backgroundColor: '#f8f9fa'
  },
  button: {
    backgroundColor: '#6c63ff', borderRadius: 12,
    paddingVertical: 16, alignItems: 'center'
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' }
});
```

### 3.3 Archivos Generados

```
my-rn-app/
├── package.json
├── tsconfig.json
├── babel.config.js
├── metro.config.js
├── index.js                           ← Entry point (AppRegistry)
├── App.tsx                            ← Root component (NavigationContainer)
├── app.json                           ← RN config (name, displayName)
│
├── src/
│   ├── screens/
│   │   ├── LoginScreen.tsx           ← Generado desde JSON
│   │   ├── DashboardScreen.tsx       ← Generado desde JSON
│   │   ├── ProfileScreen.tsx         ← Generado desde JSON
│   │   └── ...                       ← Una screen por JSON
│   │
│   ├── components/
│   │   ├── ui/                       ← Componentes del design system
│   │   │   ├── Button.tsx
│   │   │   ├── TextInput.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Image.tsx
│   │   │   ├── Icon.tsx
│   │   │   └── index.ts
│   │   ├── layout/                   ← Layout containers
│   │   │   ├── Row.tsx
│   │   │   ├── Column.tsx
│   │   │   ├── Scrollable.tsx
│   │   │   └── Container.tsx
│   │   └── shared/                   ← Componentes reutilizables
│   │       ├── Header.tsx
│   │       ├── Loading.tsx
│   │       └── Toast.tsx
│   │
│   ├── navigation/
│   │   ├── AppNavigator.tsx          ← React Navigation config
│   │   ├── TabNavigator.tsx          ← Bottom tab navigator
│   │   ├── StackNavigator.tsx        ← Stack screens
│   │   └── types.ts                  ← Navigation param types
│   │
│   ├── services/
│   │   ├── api.ts                    ← API client (axios/fetch)
│   │   ├── storage.ts                ← AsyncStorage wrapper
│   │   └── push.ts                   ← Push notification service
│   │
│   ├── hooks/
│   │   ├── useForm.ts               ← Form state management
│   │   ├── useApi.ts                ← API call hook
│   │   └── useAuth.ts               ← Auth state hook
│   │
│   ├── store/                        ← Estado global (opcional)
│   │   ├── AuthContext.tsx
│   │   └── AppState.tsx
│   │
│   ├── theme/
│   │   ├── colors.ts
│   │   ├── typography.ts
│   │   ├── spacing.ts
│   │   └── index.ts
│   │
│   └── utils/
│       ├── validators.ts
│       └── formatters.ts
│
├── assets/
│   ├── fonts/
│   ├── images/
│   └── icons/
│
├── __tests__/
│   ├── screens/
│   └── components/
│
├── android/                          ← Proyecto Android nativo
├── ios/                              ← Proyecto iOS nativo
└── .env                              ← Variables de entorno
```

### 3.4 Navegación (React Navigation)

UI Studio analiza el JSON universal y genera automáticamente la configuración de navegación:

```typescript
// src/navigation/AppNavigator.tsx
// GENERATED by UI Studio — DO NOT EDIT MANUALLY

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { RootStackParamList, TabParamList } from './types';

// Screens (generados desde JSON)
import { LoginScreen } from '../screens/LoginScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { ScanQRScreen } from '../screens/ScanQRScreen';
import { EventDetailScreen } from '../screens/EventDetailScreen';

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: { backgroundColor: '#fff', borderTopWidth: 0, elevation: 8 }
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ tabBarIcon: ({ color }) => <Icon name="home" color={color} /> }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarIcon: ({ color }) => <Icon name="person" color={color} /> }}
      />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Main" component={TabNavigator} />
        <Stack.Screen name="EventDetail" component={EventDetailScreen} />
        <Stack.Screen name="ScanQR" component={ScanQRScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// types.ts (generado)
export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  EventDetail: { eventId: string };
  ScanQR: undefined;
};

export type TabParamList = {
  Dashboard: undefined;
  Profile: undefined;
};
```

Reglas de generación de navegación:

| Patrón UI Studio | Generación RN |
|-----------------|---------------|
| `screen` root | `Stack.Screen` |
| `tabGroup` | `Tab.Navigator` |
| `modal` | `Stack.Group screenOptions={{ presentation: 'modal' }}` |
| `drawer` | `Drawer.Navigator` |
| Botón con `action: NAVIGATE` | `navigation.navigate('ScreenName')` |
| Botón con `action: NAVIGATE_BACK` | `navigation.goBack()` |
| Botón con `action: NAVIGATE_RESET` | `navigation.reset({ index: 0, routes: [{ name }] })` |

### 3.5 Mapeo Action Flows → RN

```typescript
// El generador convierte action flows del JSON en hooks:

// Ejemplo: action flow desde JSON
// {
//   "onMount": [
//     { "type": "API_CALL", "url": "/api/events", "assignTo": "events" },
//     { "type": "CONDITIONAL",
//       "if": "{{events.length === 0}}",
//       "then": [{ "type": "NAVIGATE", "screen": "CreateEvent" }]
//     }
//   ]
// }

// → Genera:

import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';

function useDashboardFlow() {
  const [events, setEvents] = useState<any[]>([]);
  const navigation = useNavigation<any>();

  useFocusEffect(
    useCallback(() => {
      api.get('/api/events')
        .then(res => {
          setEvents(res.data);
          if (res.data.length === 0) {
            navigation.navigate('CreateEvent');
          }
        })
        .catch(err => Toast.show('Error loading events'));
    }, [])
  );

  return { events };
}
```

### 3.6 Comando CLI

```bash
# Exportar proyecto RN desde UI Studio
ui-studio export --format=react-native --out=./my-rn-app

# Instalar dependencias
cd my-rn-app
npm install

# iOS (requiere Mac + Xcode)
npx pod-install          # Instalar CocoaPods
npx react-native run-ios

# Android
npx react-native run-android

# Bundle para release
npx react-native build-android --mode=release
npx react-native build-ios --mode=release --workspace=ios/MyApp.xcworkspace
```

**Scripts generados en package.json:**
```json
{
  "scripts": {
    "start": "react-native start",
    "ios": "react-native run-ios",
    "android": "react-native run-android",
    "build:ios": "react-native build-ios --mode=release",
    "build:android": "cd android && ./gradlew assembleRelease",
    "test": "jest",
    "lint": "eslint . --ext .ts,.tsx"
  }
}
```

---

## 4. Mobile Publishing Workflow

### 4.1 Visión General

```
┌─────────────────────────────────────────────────────────────────────┐
│               UI STUDIO — PUBLISHING PIPELINE                       │
└─────────────────────────────────────────────────────────────────────┘

Capacitor / RN Project
       │
       ▼
┌──────────────────────┐     ┌──────────────────────┐
│   Build iOS          │     │   Build Android      │
│                      │     │                      │
│   npx cap run ios    │     │   npx cap run android│
│   --release          │     │   --release          │
│                      │     │                      │
│   ┌──────────────┐   │     │  ┌──────────────┐    │
│   │ Archive .xc  │   │     │  │ ./gradlew    │    │
│   │ → .ipa       │   │     │  │ assembleRelease │  │
│   └──────┬───────┘   │     │  └──────┬───────┘    │
└──────────┼───────────┘     └─────────┼────────────┘
           │                           │
           ▼                           ▼
┌──────────────────────┐     ┌──────────────────────┐
│   App Store Connect  │     │   Google Play Console │
│                      │     │                      │
│   - Certificado      │     │   - App Signing      │
│   - Provisioning     │     │   - KeyStore          │
│   - TestFlight       │     │   - Internal Test    │
│   - Submit Review    │     │   - Production       │
└──────────────────────┘     └──────────────────────┘
```

### 4.2 iOS (Xcode)

#### Lo que UI Studio automatiza:

| Paso | ¿Automatizable? | Cómo |
|------|----------------|------|
| Generar proyecto Xcode | ✅ Automático | `npx cap sync` lo genera |
| Configurar Bundle ID | ✅ Automático | Desde `capacitor.config.json` → `appId` |
| Iconos y splash | ✅ Automático | `npx cap resources` o script `generate-icons.js` |
| Capabilities (Push, etc) | ✅ Automático | Configurable en `capacitor.config.json` |
| Versionado | ✅ Automático | Desde `package.json` → `version` + `buildNumber` |

#### Lo que requiere acción manual:

| Paso | Acción requerida | Frecuencia |
|------|-----------------|------------|
| **Apple Developer enrollment** ($99/yr) | Crear cuenta en developer.apple.com | Una vez |
| **Certificado de distribución** | Generar en Apple Developer portal | Anual |
| **Provisioning Profile** | Crear profile para App Store / AdHoc | Por app + anual |
| **App Store Connect record** | Crear app entry en App Store Connect | Por app (una vez) |
| **TestFlight** | Subir build, gestionar testers | Por versión |
| **App Review** | Responder preguntas de revisión | Por submission |

#### Comandos de build iOS:

```bash
# 1. UI Studio genera el proyecto
ui-studio export --format=capacitor --out=./my-app
cd my-app

# 2. Build web SPA
npm run build

# 3. Sincronizar con iOS
npx cap sync ios

# 4. Abrir en Xcode para release manual
npx cap open ios
# → En Xcode: Product → Archive → Distribute App

# 5. O build desde CLI (requiere Fastlane o xcodebuild)
xcodebuild -workspace ios/App.xcworkspace \
  -scheme App \
  -configuration Release \
  -archivePath builds/MyApp.xcarchive \
  archive

xcodebuild -exportArchive \
  -archivePath builds/MyApp.xcarchive \
  -exportPath builds/ \
  -exportOptionsPlist ExportOptions.plist
```

#### Fastlane config (recomendado, generado por UI Studio):

```ruby
# fastlane/Fastfile
default_platform(:ios)

platform :ios do
  desc "Build and upload to TestFlight"
  lane :beta do
    increment_build_number
    build_app(scheme: "App")
    upload_to_testflight
  end

  desc "Build and submit to App Store"
  lane :release do
    increment_build_number
    build_app(scheme: "App", configuration: "Release")
    upload_to_app_store(force: true)
  end
end
```

### 4.3 Android (Gradle)

#### Lo que UI Studio automatiza:

| Paso | ¿Automatizable? | Cómo |
|------|----------------|------|
| Generar proyecto Android | ✅ Automático | `npx cap sync` lo genera |
| Configurar applicationId | ✅ Automático | Desde `capacitor.config.json` |
| Iconos y splash | ✅ Automático | `npx cap resources` |
| Permisos (Camera, Push) | ✅ Automático | Configurable en `capacitor.config.json` |
| VersionCode / VersionName | ✅ Automático | Desde `package.json` |

#### Lo que requiere acción manual:

| Paso | Acción requerida | Frecuencia |
|------|-----------------|------------|
| **Google Play Developer** ($25) | Crear cuenta en play.google.com/console | Una vez |
| **App Signing Key** | Generar keystore con `keytool` o usar Google Play Signing | Una vez |
| **Google Play Console record** | Crear app listing, store listing, screenshots | Por app (una vez) |
| **Internal Test track** | Subir APK/AAB, agregar testers | Por versión |
| **Store Listing** | Descripción, screenshots, categoría, calificación | Por app + actualizaciones |

#### Comandos de build Android:

```bash
# 1. Build web SPA
npm run build

# 2. Sincronizar con Android
npx cap sync android

# 3. Build AAB (recomendado para Play Store)
cd android
./gradlew bundleRelease
# → android/app/build/outputs/bundle/release/app-release.aab

# 4. Build APK (para testing directo)
./gradlew assembleRelease
# → android/app/build/outputs/apk/release/app-release.apk

# 5. Sign APK/AAB con keystore (si no usas Play Signing)
jarsigner -verbose -sigalg SHA1withRSA \
  -digestalg SHA1 -keystore my-release-key.keystore \
  app-release.aab alias_name
```

#### Fastlane para Android:

```ruby
platform :android do
  desc "Build and upload to Google Play Internal Test"
  lane :beta do
    gradle(task: "bundleRelease")
    upload_to_play_store(
      track: 'internal',
      aab: 'android/app/build/outputs/bundle/release/app-release.aab'
    )
  end

  desc "Build and upload to Google Play Production"
  lane :release do
    gradle(task: "bundleRelease")
    upload_to_play_store(track: 'production')
  end
end
```

### 4.4 Code Signing

```
┌───────────────────┐         ┌───────────────────┐
│       iOS         │         │     Android       │
├───────────────────┤         ├───────────────────┤
│ Certificados:     │         │ Keystore:         │
│ - Development     │         │ - release.keystore│
│ - Distribution    │         │ - alias: myalias  │
│                   │         │ - validez: 25+ yrs│
│ Provisioning:     │         │                   │
│ - Development     │         │ Play Signing:     │
│ - AdHoc           │         │ (recomendado)     │
│ - App Store       │         │ Google maneja     │
│                   │         │ la key de firma   │
│ Herramientas:     │         │                   │
│ - Fastlane match  │         │ Store:            │
│   (git-backed)    │         │ upload-key.jks    │
│ - Xcode auto      │         │ (para subir)      │
└───────────────────┘         └───────────────────┘
```

**UI Studio genera helpers de code signing:**

```bash
# iOS: Fastlane match setup
fastlane match init
fastlane match development
fastlane match appstore

# Android: Generar keystore
keytool -genkey -v -keystore release.keystore \
  -alias uistudio -keyalg RSA -keysize 2048 \
  -validity 10000
```

### 4.5 Resumen: Automatizable vs Manual

| Área | UI Studio Automatiza | Acción Manual Requerida |
|------|---------------------|------------------------|
| **Código** | 100% del código de la app | — |
| **Proyecto nativo** | Scaffold completo (Xcode, Android) | — |
| **Configuración** | `capacitor.config.json`, `app.json`, build scripts | — |
| **Iconos/Splash** | Genera assets desde logo | Proveer logo inicial |
| **Versionado** | Incrementa versionCode/versionName | — |
| **Dependencias** | `package.json` completo | Aprobación de cambios |
| **Certificados iOS** | Fastlane match config | Apple Developer account ($99/yr) |
| **Provisioning iOS** | Fastlane match auto-gestión | Primer setup manual |
| **Build iOS** | CLI + Fastlane lanes | Xcode instalado, Mac |
| **Build Android** | Gradle tasks | Java/Android SDK instalado |
| **App Store Connect** | Fastlane upload | Crear app entry, screenshots |
| **Google Play Console** | Fastlane upload | Crear app listing, screenshots |
| **Distribución** | TestFlight upload | Invitar testers |
| **Revisión** | — | Responder App Store Review |
| **Mant. continuo** | Re-exportar desde UI Studio | Re-build + re-submit |

---

## 5. Live Edit para RN (Dev Mode)

### 5.1 Arquitectura

```
┌──────────────────────────┐          ┌──────────────────────────┐
│      UI STUDIO           │          │    DISPOSITIVO/EMULADOR  │
│                          │          │                          │
│  ┌────────────────────┐  │          │  ┌────────────────────┐  │
│  │  Canvas Editor     │  │          │  │  App RN con        │  │
│  │  (cambia JSON)     │  │          │  │  LiveReloadPlugin  │  │
│  └────────┬───────────┘  │          │  └────────▲───────────┘  │
│           │              │          │           │              │
│           ▼              │          │           │              │
│  ┌────────────────────┐  │          │           │              │
│  │  WebSocket Client  │──┼──────────┼───────────┘              │
│  │  (envía diffs JSON) │  │  WS     │                          │
│  └────────────────────┘  │  :9090  │                          │
│                          │          │                          │
│  ┌────────────────────┐  │          │  ┌────────────────────┐  │
│  │  Metro Bundler     │  │          │  │  Metro Bundler     │  │
│  │  (hot module)      │──┼──────────┼──┤  (reemplaza módulo)│  │
│  └────────────────────┘  │  HTTP    │  └────────────────────┘  │
│                          │  :8081   │                          │
└──────────────────────────┘          └──────────────────────────┘
```

### 5.2 Protocolo de Comunicación

```
UI Studio → App RN (WebSocket :9090)

Payload: {
  "type": "SCREEN_UPDATE",
  "screen": "DashboardScreen",
  "json": { ... }           ← JSON universal completo de la screen
}

Payload: {
  "type": "COMPONENT_UPDATE",
  "screen": "DashboardScreen",
  "path": "children[0].children[2]",
  "patch": {
    "style": { "backgroundColor": "#ff5722" },
    "props": { "label": "Nuevo texto" }
  }
}

Payload: {
  "type": "STYLE_UPDATE",
  "theme": "colors",
  "patch": {
    "primary": "#6c63ff",
    "secondary": "#ff6584"
  }
}

Payload: {
  "type": "ADD_COMPONENT",
  "screen": "DashboardScreen",
  "parentPath": "children[0]",
  "component": {
    "type": "button",
    "label": "Nuevo botón",
    "position": 2
  }
}

Payload: {
  "type": "REMOVE_COMPONENT",
  "screen": "DashboardScreen",
  "path": "children[0].children[1]"
}
```

### 5.3 LiveReload Plugin (App RN)

```typescript
// src/plugins/liveReload.ts
// Se activa solo en dev mode (__DEV__ = true)

import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

const WS_URL = __DEV__ ? 'ws://localhost:9090' : null;

interface LiveReloadOptions {
  onScreenUpdate: (screenName: string, json: any) => void;
  onThemeUpdate: (patch: any) => void;
}

export function useLiveReload({ onScreenUpdate, onThemeUpdate }: LiveReloadOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!WS_URL) return;

    const connect = () => {
      const ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        console.log('[UI Studio Live] Connected');
        setConnected(true);
        // Enviar handshake
        ws.send(JSON.stringify({
          type: 'HANDSHAKE',
          sessionId: AsyncStorage.getItem('devSessionId'),
          platform: Platform.OS
        }));
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'SCREEN_UPDATE':
            onScreenUpdate(msg.screen, msg.json);
            break;
          case 'STYLE_UPDATE':
            onThemeUpdate(msg.patch);
            break;
          case 'COMPONENT_UPDATE':
            // Aplicar patch en el runtime
            handleComponentPatch(msg.screen, msg.path, msg.patch);
            break;
        }
      };

      ws.onclose = () => {
        console.log('[UI Studio Live] Disconnected');
        setConnected(false);
        // Reconectar en 3s
        setTimeout(connect, 3000);
      };

      ws.onerror = () => ws.close();
      wsRef.current = ws;
    };

    AppState.addEventListener('change', (state) => {
      if (state === 'active' && !wsRef.current?.readyState) {
        connect();
      }
    });

    connect();
    return () => wsRef.current?.close();
  }, []);

  return { connected };
}
```

### 5.4 Runtime Reactivo (App RN)

```typescript
// src/runtime/ScreenRenderer.tsx
// Renderiza screens desde JSON en vivo

import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView } from 'react-native';
import { useLiveReload } from '../plugins/liveReload';
import { componentRegistry } from './componentRegistry';
import { styleResolver } from './styleResolver';
import { actionRunner } from './actionRunner';

interface ScreenRendererProps {
  screenName: string;
  initialJson: any;
}

export function ScreenRenderer({ screenName, initialJson }: ScreenRendererProps) {
  const [json, setJson] = useState(initialJson);
  const [theme, setTheme] = useState(defaultTheme);

  const handleScreenUpdate = useCallback((name: string, newJson: any) => {
    if (name === screenName) setJson(newJson);
  }, [screenName]);

  const handleThemeUpdate = useCallback((patch: any) => {
    setTheme(prev => deepMerge(prev, patch));
  }, []);

  const { connected } = useLiveReload({
    onScreenUpdate: handleScreenUpdate,
    onThemeUpdate: handleThemeUpdate
  });

  // Renderizar desde JSON universal
  const renderNode = (node: UINode, depth: number = 0): React.ReactNode => {
    const Component = componentRegistry[node.type];

    if (!Component) {
      return <View key={node.id} style={{ display: 'none' }} />;
    }

    const resolvedStyle = styleResolver.resolve(node.style, theme);
    const actions = actionRunner.bind(node.actions || []);

    return (
      <Component
        key={node.id}
        {...node.props}
        style={resolvedStyle}
        onAction={actions}
      >
        {node.children?.map(child => renderNode(child, depth + 1))}
      </Component>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      {connected && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>✨ Live</Text>
        </View>
      )}
      <ScrollView style={{ flex: 1 }}>
        {json.children?.map(child => renderNode(child))}
      </ScrollView>
    </View>
  );
}
```

### 5.5 Metro HMR Integration

Cuando solo cambian estilos o props (no estructura), UI Studio puede usar **Hot Module Replacement** de Metro directamente:

```
UI Studio genera cambio
       │
       ▼
Modifica .tsx file en disco
       │
       ▼
Metro detecta file change
       │
       ▼
HMR envía diff al device
       │
       ▼
Component re-renderiza
  (sin perder estado)
```

Esto se logra con el flag `--watch` en la exportación:

```bash
# UI Studio exporta en modo watch
ui-studio export --format=react-native --out=./my-rn-app --watch

# Esto mantiene un watcher de archivos que re-escribe screens/ al cambiar JSON
# + notifica a Metro via WebSocket para HMR inmediato
```

### 5.6 Indicador Visual de Conexión

UI Studio muestra un badge en el canvas cuando está conectado al device:

```
┌────────────────────────────────────┐
│  UI Studio Editor                  │
│                                    │
│  ┌──────────────────────────┐      │
│  │  Canvas                  │      │
│  │                          │      │
│  │  [Login Screen]          │      │
│  │                          │      │
│  │  ┌────────────────────┐  │      │
│  │  │  ✨ Live: iPhone15 │  │      │  ← Badge verde
│  │  └────────────────────┘  │      │
│  └──────────────────────────┘      │
└────────────────────────────────────┘
```

---

## 6. Template Projects

### 6.1 Templates Disponibles

```
ui-studio create --list

Templates disponibles:
  ┌────────────────────────┬──────────┬──────────────────────────┐
  │ Template               │ Formatos │ Descripción              │
  ├────────────────────────┼──────────┼──────────────────────────┤
  │ blank                  │ cap, rn  │ App vacía con una screen │
  │ tabs                   │ cap, rn  │ Bottom tab navigator     │
  │ auth-dashboard         │ cap, rn  │ Login + Dashboard + Profile│
  │ camera-qr              │ cap, rn  │ QR Scanner + Camera      │
  │ event-manager          │ cap, rn  │ Eventos + Invitados + QR │
  │ ecommerce              │ cap, rn  │ Productos + Carrito      │
  │ social-feed            │ rn only  │ Timeline + Posts + Likes │
  │ chat                  │ rn only  │ Messages + Contacts      │
  └────────────────────────┴──────────┴──────────────────────────┘
```

### 6.2 Estructura de Template

Cada template es un folder en `templates/` con esta estructura:

```
templates/
└── auth-dashboard/
    ├── capacitor/                  ← Template para Capacitor
    │   ├── package.json
    │   ├── capacitor.config.json
    │   └── www/
    │       └── index.html
    │
    ├── react-native/               ← Template para RN
    │   ├── package.json
    │   ├── index.js
    │   ├── App.tsx
    │   ├── src/
    │   │   ├── screens/            ← Screens pre-generadas
    │   │   │   ├── LoginScreen.json
    │   │   │   ├── DashboardScreen.json
    │   │   │   └── ProfileScreen.json
    │   │   ├── navigation/
    │   │   │   └── AppNavigator.tsx
    │   │   ├── services/
    │   │   │   └── api.ts
    │   │   └── theme/
    │   │       └── index.ts
    │   └── assets/
    │
    ├── preview.png                 ← Screenshot del template
    ├── description.md              ← Descripción del template
    └── meta.json                   ← Metadata del template
        {
          "id": "auth-dashboard",
          "name": "Auth + Dashboard",
          "description": "Login screen + dashboard with stats + profile page",
          "formats": ["capacitor", "react-native"],
          "screens": 3,
          "complexity": "medium",
          "features": ["auth", "navigation", "api"]
        }
```

### 6.3 Comando `ui-studio create`

```bash
# Uso básico
ui-studio create --type capacitor --name my-app --template auth-dashboard
ui-studio create --type react-native --name my-app --template blank

# Shorthand
ui-studio create -t rn -n my-app -T tabs

# Con opciones adicionales
ui-studio create --type react-native \
  --name event-manager \
  --template event-manager \
  --org com.mycompany \
  --theme dark \
  --include-push \
  --include-camera

# Interactivo (pregunta paso a paso)
ui-studio create --interactive
```

**Flujo interactivo:**
```
$ ui-studio create --interactive

? Select target platform:
  ❯ Capacitor (SPA + WebView)
    React Native (Native)

? Template:
  ❯ Blank
    Tabs
    Auth + Dashboard
    Camera + QR
    Event Manager
    E-commerce

? App name: My App
? App ID (bundle identifier): com.mycompany.myapp
? Output directory: ./my-app
? Include push notifications? Yes
? Include camera? No
? Theme: Dark
? Colors: Primary (#6c63ff), Secondary (#ff6584)

✓ Project created at ./my-app
✓ Dependencies installed (npm install)
✓ iOS project synced (npx cap sync)

Next steps:
  cd my-app
  npx cap run ios     # Run on iOS simulator
  npx cap run android # Run on Android emulator
```

### 6.4 Post-Creation Hooks

El scaffolding ejecuta hooks automáticos:

```typescript
// hooks/post-create.ts

async function postCreate(options: CreateOptions) {
  // 1. Reemplazar placeholders en todos los archivos
  await replacePlaceholders(options.outDir, {
    '{{APP_NAME}}': options.name,
    '{{APP_ID}}': options.appId,
    '{{THEME_PRIMARY}}': options.colors.primary,
    '{{THEME_SECONDARY}}': options.colors.secondary,
  });

  // 2. npm install
  if (options.runInstall) {
    execSync('npm install', { cwd: options.outDir });
  }

  // 3. Capacitor sync (si aplica)
  if (options.type === 'capacitor') {
    execSync('npx cap sync', { cwd: options.outDir });
  }

  // 4. Fastlane init (si se requiere)
  if (options.setupFastlane) {
    execSync('fastlane init', { cwd: options.outDir });
  }

  // 5. Inicializar git
  if (options.initGit) {
    execSync('git init && git add . && git commit -m "Initial commit"', {
      cwd: options.outDir
    });
  }
}
```

---

## 7. Esfuerzo Estimado por Componente

### 7.1 Tabla de Estimación

| # | Componente | Esfuerzo | Dependencias | Prioridad |
|---|-----------|----------|--------------|-----------|
| **1** | **Runtime universal (render JSON)** | XL (3-4 sem) | Ninguna | 🔴 P0 |
| | Parser que toma JSON y renderiza en web/RN | | | |
| **2** | **Component Registry** | L (2-3 sem) | Runtime | 🔴 P0 |
| | Mapeo de tipos UI Studio → componentes nativos (web + RN) | | | |
| **3** | **Capacitor SPA Generator** | M (1-2 sem) | Runtime | 🔴 P0 |
| | Genera www/ + capacitor.config.json desde JSON universal | | | |
| **4** | **RN Code Generator** | XL (3-4 sem) | Runtime, Component Registry | 🔴 P0 |
| | Genera screens/ + components/ + navigation/ desde JSON | | | |
| **5** | **Action Flow Compiler** | L (2-3 sem) | RN Generator | 🔴 P0 |
| | Convierte action flows JSON a hooks RN + event handlers | | | |
| **6** | **Navigation Generator** | M (1-2 sem) | RN Generator | 🟡 P1 |
| | Genera React Navigation config desde JSON structure | | | |
| **7** | **Capacitor Plugin Bridge** | M (1-2 sem) | Capacitor Generator | 🟡 P1 |
| | Wrappers para cámara, push, biometría, etc. | | | |
| **8** | **Template System** | L (2-3 sem) | CLI | 🟡 P1 |
| | Scaffolding, placeholders, hooks | | | |
| **9** | **Live Edit Protocol** | XL (3-4 sem) | RN Generator, Runtime | 🟡 P1 |
| | WebSocket server, Metro HMR, diff protocol | | | |
| **10** | **Publishing Helpers** | M (1-2 sem) | Templates | 🟢 P2 |
| | Fastlane configs, code signing helpers, CI scripts | | | |
| **11** | **Templates Content (5+ templates)** | L (2-3 sem) | Template System | 🟢 P2 |
| | Diseñar screens JSON para blank, tabs, auth, camera-qr, event | | | |
| **12** | **Build Scripts & CI/CD** | M (1-2 sem) | Templates | 🟢 P2 |
| | Scripts de build, test, deploy | | | |

### 7.2 Fases de Implementación

```
FASE 1 — Core (Sem 1-4, P0)
├── Runtime universal (JSON renderer)
├── Component Registry
├── Capacitor SPA Generator
└── RN Code Generator (básico)

FASE 2 — Acciones y Navegación (Sem 5-8, P0-P1)
├── Action Flow Compiler
├── Navigation Generator
├── Capacitor Plugin Bridge
└── Template System

FASE 3 — Developer Experience (Sem 9-12, P1)
├── Live Edit Protocol
├── CLI completo (create, export, serve)
└── Templates (5 templates mínimos)

FASE 4 — Publishing (Sem 13-14, P2)
├── Publishing Helpers (Fastlane, signing)
├── Build Scripts
└── Documentación + ejemplos

Total estimado: ~14 semanas (3.5 meses) con 1-2 desarrolladores full-time
```

### 7.3 Equipo Recomendado

| Rol | Cantidad | Fases |
|-----|----------|-------|
| Senior Frontend (React + RN) | 1 | F1, F2, F3 |
| Senior Fullstack (Node.js + CLI) | 1 | F1, F2, F3 |
| UI/UX Designer | 0.5 | F2, F4 (templates) |
| DevSecOps/QA | 0.5 | F3, F4 |

---

## Apéndices

### A. Comparativa de Formatos de Exportación

| Aspecto | Capacitor | React Native |
|---------|-----------|--------------|
| **Rendimiento** | WebView (70-100% web) | Nativo (100%) |
| **UX Nativa** | Limitada (WebView) | Completa (gestos, animaciones, transitions) |
| **Acceso APIs** | Plugin bridge (Capacitor) | Nativo directo |
| **Código compartido web/mobile** | 100% (misma SPA) | 0% (UI separada) |
| **Velocidad de exportación** | Rápida (copiar www/) | Lenta (generar código) |
| **Complejidad de generación** | Baja | Alta |
| **Tamaño de app** | 5-10 MB | 15-30 MB |
| **App Store Review** | Misma que nativa | Misma que nativa |
| **Offline** | Limitado (Service Worker) | Completo (AsyncStorage, SQLite) |

### B. Glosario

| Término | Definición |
|---------|-----------|
| **JSON Universal** | Formato intermedio de UI Studio que describe layouts, acciones, datos y navegación de forma agnóstica al target |
| **Runtime** | Biblioteca JS que interpreta el JSON universal y renderiza componentes reales en web o RN |
| **Component Registry** | Mapa de `{ tipo: string → Componente React/RN }` que usa el runtime para instanciar componentes |
| **Action Flow** | Secuencia de acciones (API calls, navegación, alerts) definida en JSON que describe el comportamiento de la app |
| **Live Edit** | Capacidad de UI Studio de enviar cambios en tiempo real al dispositivo via WebSocket, sin re-build |
| **Scaffold** | Proyecto generado con estructura completa de archivos, listo para compilar |
