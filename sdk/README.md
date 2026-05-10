# Check Pro SDK

SDK oficial para integrar tus sistemas con Check Pro.

## Instalación

```bash
npm install check-pro-sdk
```

## Uso básico

```javascript
const { CheckClient } = require('check-pro-sdk');

const client = new CheckClient({
    apiKey: 'ck_tu_api_key_aqui',
    baseUrl: 'https://check.app'
});

// Listar eventos
const events = await client.getEvents();
console.log(events.data);

// Obtener un evento
const event = await client.getEvent('event-id');
console.log(event.data);

// Listar invitados de un evento
const guests = await client.getEventGuests('event-id');
console.log(guests.data);
```

## API

### `new CheckClient(options)`

| Opción | Tipo | Default | Descripción |
|--------|------|---------|-------------|
| `apiKey` | string | **requerido** | API key generada en Check Pro |
| `baseUrl` | string | `'https://check.app'` | URL base del servidor |
| `timeout` | number | `15000` | Timeout en ms |

### Métodos

| Método | Retorno | Descripción |
|--------|---------|-------------|
| `getEvents()` | `{ data: Event[], total: number }` | Lista todos los eventos |
| `getEvent(id)` | `{ data: Event }` | Obtiene un evento por ID |
| `getEventGuests(eventId)` | `{ data: Guest[], total: number }` | Lista invitados de un evento |

## TypeScript

El SDK incluye tipos TypeScript:

```typescript
import { CheckClient, CheckEvent } from 'check-pro-sdk';

const client = new CheckClient({ apiKey: 'ck_...' });
const { data: events }: { data: CheckEvent[] } = await client.getEvents();
```

## Obtener una API Key

1. Inicia sesión en Check Pro como ADMIN
2. Ve a Configuración > API Keys
3. Crea una nueva key con permisos de lectura
4. Copia la key (empieza con `ck_`)
