const swaggerJsdoc = require('swagger-jsdoc');
const fs = require('fs');
const path = require('path');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Check Pro API',
            version: require('../../package.json').version, // // v12.44.852 (auditoría 2026-11-25, I12): siempre la versión real de package.json
            description: 'API REST para el sistema de gestión de invitados y eventos Check Pro',
            contact: { name: 'Check Pro Support' }
        },
        servers: [
            { url: process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`, description: 'Servidor activo' }
        ],
        tags: [
            { name: 'Auth', description: 'Autenticación, registro y recuperación de contraseña' },
            { name: 'Events', description: 'CRUD de eventos y configuración' },
            { name: 'Guests', description: 'Invitados, check-in, categorías, badges' },
            { name: 'Public', description: 'Rutas públicas (registro, captcha, version)' },
            { name: 'Email', description: 'Cuentas SMTP/IMAP, mailing, campañas' },
            { name: 'Groups', description: 'Grupos/empresas' },
            { name: 'Surveys', description: 'Encuestas y sugerencias' },
            { name: 'Settings', description: 'Configuración global del sistema' },
            { name: 'Sessions', description: 'Sesiones y asientos' },
            { name: 'Webhooks', description: 'Webhooks para integraciones externas' },
            { name: 'Raffles', description: 'Ruletas y sorteos' },
            { name: 'Payments', description: 'Pagos Stripe/PayPal' },
            { name: 'Venues', description: 'Espacios físicos' },
            { name: 'Google', description: 'Integración Google Sheets' },
            { name: 'ImportExport', description: 'Importación y exportación de datos' },
            { name: 'Security', description: 'Seguridad IA, compliance, auditoría' }
        ],
        components: {
            securitySchemes: {
                BearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Token JWT obtenido de /api/login'
                }
            },
            schemas: {
                Error: {
                    type: 'object',
                    properties: { error: { type: 'string', example: 'Mensaje de error' } }
                },
                Success: {
                    type: 'object',
                    properties: { success: { type: 'boolean', example: true } }
                },
                PaginatedResponse: {
                    type: 'object',
                    properties: {
                        data: { type: 'array', items: {} },
                        pagination: {
                            type: 'object',
                            properties: {
                                page: { type: 'integer' },
                                limit: { type: 'integer' },
                                total: { type: 'integer' },
                                totalPages: { type: 'integer' }
                            }
                        }
                    }
                },
                Event: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        date: { type: 'string' },
                        location: { type: 'string' },
                        status: { type: 'string', enum: ['ACTIVE', 'DRAFT', 'COMPLETED'] }
                    }
                },
                Guest: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        event_id: { type: 'string' },
                        name: { type: 'string' },
                        email: { type: 'string' },
                        phone: { type: 'string' },
                        checked_in: { type: 'boolean' },
                        qr_token: { type: 'string' }
                    }
                },
                Webhook: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        url: { type: 'string' },
                        events: { type: 'array', items: { type: 'string' } },
                        status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] }
                    }
                }
            }
        },
        security: [{ BearerAuth: [] }]
    },
    apis: [
        './src/routes/*.routes.js',
        './src/docs/swagger.js'
    ]
};

const swaggerSpec = swaggerJsdoc(options);

// // v12.44.852 (auditoría 2026-11-25, I12): el spec manual se mezcla con el mapa COMPLETO generado por scripts/generate-openapi.js
// (557 endpoints en 367 paths). Los endpoints documentados a mano conservan prioridad: tienen
// esquemas, ejemplos y seguridad; los generados garantizan que NINGUNA ruta quede fuera del spec.
try {
    const generated = JSON.parse(fs.readFileSync(path.join(__dirname, 'openapi-generated.json'), 'utf8'));
    for (const [p, methods] of Object.entries(generated.paths || {})) {
        swaggerSpec.paths[p] = Object.assign({}, methods, swaggerSpec.paths[p]);
    }
} catch (e) {
    // si el archivo aún no se generó, el spec manual sigue funcionando solo
    console.warn('[swagger] openapi-generated.json no disponible:', e.message);
}

module.exports = { swaggerSpec };
