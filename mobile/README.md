# Check Pro Mobile (React Native)

## Setup inicial

```bash
npx react-native@latest init CheckProMobile --template react-native-template-typescript
cd CheckProMobile
npm install @react-navigation/native @react-navigation/stack
npm install react-native-screens react-native-safe-area-context
npm install axios react-native-qrcode-scanner react-native-webview
```

## Estructura

```
mobile/
├── src/
│   ├── api/           # API client (apunta a check.app)
│   ├── screens/       # Pantallas: Login, Events, Guests, Calendar
│   ├── components/    # Componentes reutilizables
│   ├── navigation/    # Stack navigator
│   └── utils/         # Helpers
├── App.tsx
└── package.json
```

## API Client

```typescript
// src/api/client.ts
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://check.app/api',
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const getEvents = () => api.get('/events');
export const getEventGuests = (id: string) => api.get(`/events/${id}/attendance`);
export const getCalendar = (year: number, month: number) =>
  api.get(`/events/calendar/data?year=${year}&month=${month}`);
```

## Home Screen

```typescript
// src/screens/HomeScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList } from 'react-native';
import { getEvents } from '../api/client';

export default function HomeScreen({ navigation }) {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    getEvents().then((res) => setEvents(res.data));
  }, []);

  return (
    <View>
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Text onPress={() => navigation.navigate('Guests', { id: item.id })}>
            {item.name} - {item.date}
          </Text>
        )}
      />
    </View>
  );
}
```

## Compilar

```bash
# iOS
npx react-native run-ios

# Android
npx react-native run-android
```

La app apunta a `https://check.app` por defecto. Para desarrollo local usar `http://192.168.2.17:3000`.
