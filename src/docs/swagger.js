/**
 * Configuración Swagger/OpenAPI
 * Documentación de la API Check Pro
 */

const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Check Pro API',
            version: '12.2.2',
            description: 'API REST para el sistema de gestión de invitados y eventos Check Pro',
            contact: {
                name: 'Check Pro Support'
            }
        },
        servers: [
            { url: 'http://localhost:3000', description: 'Servidor local' },
            { url: 'http://localhost:8080', description: 'Docker container' }
        ],
        tags: [
            { name: 'Auth', description: 'Autenticación y usuarios' },
            { name: 'Events', description: 'Gestión de eventos' },
            { name: 'Guests', description: 'Invitados y check-in' },
            { name: 'Email', description: 'Configuración y envío de emails' },
            { name: 'Groups', description: 'Grupos de trabajo' },
            { name: 'Surveys', description: 'Encuestas y sugerencias' },
            { name: 'Settings', description: 'Configuración general' },
            { name: 'Public', description: 'Rutas públicas' }
        ],
        components: {
            securitySchemes: {
                BearerAuth: {
                    type: 'apiKey',
                    in: 'header',
                    name: 'x-user-id',
                    description: 'User ID para autenticación'
                }
            },
            schemas: {
                Error: {
                    type: 'object',
                    properties: {
                        error: { type: 'string', example: 'Mensaje de error' }
                    }
                },
                Success: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: true }
                    }
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
                }
            }
        },
        security: [{ BearerAuth: [] }]
    },
    apis: ['./src/docs/api/*.yaml', './server.js']
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = { swaggerSpec };
