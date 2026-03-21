/**
 * MIGRACIÓN A MÓDULOS - Plan y Estado
 * 
 * Estado: EN PROGRESO (Fase 10 de auditoría)
 * Fecha inicio: 21/03/2026
 * 
 * ESTRUCTURA OBJETIVO:
 * ------------------
 * src/
 * ├── routes/
 * │   ├── index.js          ✅ Creado
 * │   ├── auth.routes.js    ✅ Creado
 * │   ├── users.routes.js   ✅ Creado
 * │   ├── events.routes.js   ✅ Creado
 * │   ├── guests.routes.js  ⏳ Pendiente
 * │   ├── email.routes.js    ⏳ Pendiente
 * │   ├── surveys.routes.js  ⏳ Pendiente
 * │   └── admin.routes.js   ⏳ Pendiente
 * ├── middleware/
 * │   ├── index.js
 * │   ├── auth.js           ✅ Creado
 * │   └── rateLimit.js      ⏳ Pendiente
 * ├── services/
 * │   ├── email.service.js  ⏳ Pendiente
 * │   └── qr.service.js     ⏳ Pendiente
 * └── utils/
 *     ├── index.js
 *     └── helpers.js        ✅ Creado
 * 
 * server.js (refactorizado como entry point)
 * 
 * PROGRESO:
 * ---------
 * - Estructura de carpetas: ✅
 * - Helpers: ✅
 * - Auth middleware: ✅
 * - Auth routes: ✅
 * - Users routes: ✅
 * - Events routes: ✅
 * 
 * PENDIENTE:
 * ---------
 * - Guests routes
 * - Email routes (SMTP, templates, queue)
 * - Surveys routes
 * - Admin routes
 * - Groups routes
 * - Settings routes
 * - Import/Export routes
 * - Socket.io handlers
 * - Refactorizar server.js para usar módulos
 * 
 * NOTAS:
 * ------
 * Server.js actual tiene ~2000 líneas con mucha lógica mezclada.
 * La migración completa requiere:
 * 1. Extraer cada sección a su módulo correspondiente
 * 2. Mantener backward compatibility
 * 3. Testing exhaustivo después de cada cambio
 * 4. Posible ventana de mantenimiento
 */

const MIGRATION_STATUS = {
    totalRoutes: 60,
    migrated: 15,
    pending: 45,
    percentage: 25
};

module.exports = MIGRATION_STATUS;
