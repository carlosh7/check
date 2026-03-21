/**
 * MIGRACIÓN A MÓDULOS - Plan y Estado
 * 
 * Estado: CASI COMPLETA
 * Fecha: 21/03/2026
 * 
 * ÚLTIMO CAMBIO:
 * - Fase final: Migración completa de rutas inline a módulos
 * - server.js reducido de ~1780 a ~1590 líneas (-190 líneas)
 * - Rutas migradas: users/*, events/*/agenda, events/*/suggestions, events/*/surveys
 * 
 * ESTRUCTURA ACTUAL:
 * ------------------
 * src/
 * ├── routes/
 * │   ├── index.js          ✅ Registro centralizado
 * │   ├── auth.routes.js    ✅ Login, signup, password reset
 * │   ├── users.routes.js   ✅ CRUD + profile, password, status, role, events
 * │   ├── events.routes.js  ✅ CRUD + guests
 * │   ├── guests.routes.js  ✅ Import/export, checkin, stats
 * │   ├── email.routes.js   ✅ SMTP, IMAP, templates, queue
 * │   ├── surveys.routes.js ✅ Encuestas, sugerencias, agenda
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
 * ✅ Users routes (completo)
 * ✅ Events routes (completo)
 * ✅ Guests routes (completo)
 * ✅ Email routes
 * ✅ Surveys routes (completo)
 * ✅ Groups routes
 * ✅ Settings routes
 * ✅ registerRoutes() activo
 * ✅ Rutas inline migradas
 * 
 * RUTAS INLINE MANTENIDAS (lógica especial):
 * ----------------------------------------
 * - /api/users/:id/status - Envío de email de aprobación
 * - /api/password-reset-request - Token handling
 * - /api/password-reset-verify - Verificación de código
 * - /api/events/:eventId/email-config - Config por evento
 * - /api/events/:eventId/email-templates - Templates por evento
 * - /api/events/:eventId/users - Asignación usuarios
 * - /api/events/:eventId/pre-registrations - Pre-registros
 * - /api/public-register - Registro público
 * - /api/register - Registro antiguo
 * - Socket.io handlers
 */

const MIGRATION_STATUS = {
    totalRoutes: 60,
    modularRoutes: 45,
    inlineRoutes: 15,
    percentage: 75,
    serverLinesRemoved: 190,
    lastUpdate: '21/03/2026',
    completedPhases: ['10.0', '10.1', '10.2', '10.3', '10.4', '10.5', '10.6.1', '10.6.2', '10.6.3', '10.6.4'],
    status: 'FUNCIONAL - Refactorización completa de rutas'
};

module.exports = MIGRATION_STATUS;
