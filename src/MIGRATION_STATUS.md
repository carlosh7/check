/**
 * MIGRACIÓN A MÓDULOS - Plan y Estado
 * 
 * Estado: CASI COMPLETA (Fase 10.6.3 completada)
 * Fecha: 21/03/2026
 * 
 * ÚLTIMO CAMBIO:
 * - Fase 10.6.3: Activado registerRoutes() - todas las rutas modulares funcionales
 * - Rutas modulares: auth, users, events, guests, email, groups, surveys, settings
 * - Rutas inline en server.js mantenidas para compatibilidad
 * 
 * ESTRUCTURA ACTUAL:
 * ------------------
 * src/
 * ├── routes/
 * │   ├── index.js          ✅ Registro centralizado de rutas
 * │   ├── auth.routes.js    ✅ Login, signup, password reset
 * │   ├── users.routes.js   ✅ CRUD usuarios
 * │   ├── events.routes.js  ✅ CRUD eventos
 * │   ├── guests.routes.js  ✅ Invitados, import/export
 * │   ├── email.routes.js    ✅ SMTP, IMAP, templates, queue
 * │   ├── surveys.routes.js ✅ Encuestas
 * │   ├── groups.routes.js  ✅ Grupos
 * │   └── settings.routes.js ✅ Configuraciones
 * ├── middleware/
 * │   └── auth.js           ✅ Auth dual (x-user-id + Bearer)
 * └── utils/
 *     └── helpers.js        ✅ getValidId, castId, getProducerGroups
 * 
 * PROGRESO:
 * ---------
 * ✅ Estructura de carpetas
 * ✅ Helpers
 * ✅ Auth middleware (dual auth)
 * ✅ Auth routes
 * ✅ Users routes
 * ✅ Events routes
 * ✅ Guests routes
 * ✅ Email routes
 * ✅ Surveys routes
 * ✅ Groups routes
 * ✅ Settings routes
 * ✅ registerRoutes() activo
 * 
 * RUTAS INLINE EN SERVER.JS (mantenidas):
 * ---------------------------------------
 * Las siguientes rutas permanecen en server.js por compatibilidad:
 * - /api/events/:eventId/users (asignación usuarios a evento)
 * - /api/events/:eventId/email-config (config por evento)
 * - /api/events/:eventId/email-templates (templates por evento)
 * - /api/events/:eventId/agenda (agenda del evento)
 * - /api/events/:eventId/suggestions (sugerencias)
 * - /api/events/:eventId/surveys (encuestas por evento)
 * - /api/events/:eventId/pre-registrations (pre-registros)
 * - /api/public-register (registro público)
 * - /api/stats/:eventId (estadísticas)
 * - /api/users/:id/role, /profile, /events, /group
 * 
 * PRÓXIMOS PASOS (OPCIONAL):
 * -----------------------
 * 1. Refactorizar rutas inline a sus módulos correspondientes
 * 2. Eliminar código duplicado en server.js
 * 3. Mover handlers de Socket.io a módulo dedicado
 * 4. Simplificar server.js a pure entry point
 */

const MIGRATION_STATUS = {
    totalRoutes: 60,
    modularRoutes: 35,
    inlineRoutes: 25,
    percentage: 58,
    lastUpdate: '21/03/2026',
    completedPhases: ['10.0', '10.1', '10.2', '10.3', '10.4', '10.5', '10.6.1', '10.6.2', '10.6.3'],
    status: 'FUNCIONAL - Rutas modulares activas'
};

module.exports = MIGRATION_STATUS;
