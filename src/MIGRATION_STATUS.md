/**
 * MIGRACIÓN A MÓDULOS - Plan y Estado
 * 
 * Estado: EN PROGRESO (Fase 10.6.2 completada)
 * Fecha: 21/03/2026
 * 
 * ÚLTIMO CAMBIO:
 * - Fase 10.6.2: Email routes funcional con auth dual (x-user-id + Bearer)
 * - Corregidos imports de database en todos los módulos
 * - Auth middleware soporta ambos métodos de autenticación
 * 
 * ESTRUCTURA ACTUAL:
 * ------------------
 * src/
 * ├── routes/
 * │   ├── index.js          ✅ Creado
 * │   ├── auth.routes.js    ✅ Creado
 * │   ├── users.routes.js   ✅ Creado
 * │   ├── events.routes.js  ✅ Creado
 * │   ├── guests.routes.js  ✅ Creado
 * │   ├── email.routes.js    ✅ Creado (SMTP, IMAP, templates, queue)
 * │   ├── surveys.routes.js ✅ Creado
 * │   ├── groups.routes.js  ✅ Creado
 * │   └── settings.routes.js ✅ Creado
 * ├── middleware/
 * │   └── auth.js           ✅ Creado (auth dual)
 * └── utils/
 *     └── helpers.js        ✅ Creado
 * 
 * PROGRESO:
 * ---------
 * ✅ Estructura de carpetas
 * ✅ Helpers
 * ✅ Auth middleware (dual auth: x-user-id + Bearer)
 * ✅ Auth routes
 * ✅ Users routes
 * ✅ Events routes
 * ✅ Guests routes
 * ✅ Email routes (SMTP, IMAP, templates, queue)
 * ✅ Surveys routes
 * ✅ Groups routes
 * ✅ Settings routes
 * 
 * PRÓXIMOS PASOS:
 * -------------
 * 1. Activar registerRoutes() en server.js para usar módulos completos
 * 2. Eliminar código duplicado en server.js (rutas inline)
 * 3. Refactorizar handlers de Socket.io
 * 4. Simplificar server.js a entry point puro
 */

const MIGRATION_STATUS = {
    totalRoutes: 60,
    migrated: 45,
    pending: 15,
    percentage: 75,
    lastUpdate: '21/03/2026',
    completedPhases: ['10.0', '10.1', '10.2', '10.3', '10.4', '10.5', '10.6.1', '10.6.2'],
    nextPhase: '10.6.3'
};

module.exports = MIGRATION_STATUS;
