/**
 * Zod Validation Schemas
 * Esquemas de validación para inputs de API
 */

const { z } = require('zod');

const emailSchema = z.string().email('Email inválido');
const passwordSchema = z.string().min(6, 'La contraseña debe tener al menos 6 caracteres');
const uuidSchema = z.string().min(1, 'ID requerido');

const schemas = {
    login: z.object({
        username: z.string().min(1, 'Email requerido'),
        password: z.string().min(1, 'Contraseña requerida')
    }),

    signup: z.object({
        username: emailSchema,
        password: passwordSchema,
        display_name: z.string().min(1, 'Nombre requerido').max(100),
        role: z.enum(['ADMIN', 'PRODUCTOR', 'LOGISTICO']).optional()
    }),

    createUser: z.object({
        username: emailSchema,
        password: passwordSchema,
        display_name: z.string().min(1, 'Nombre requerido').max(100),
        role: z.enum(['ADMIN', 'PRODUCTOR', 'LOGISTICO']),
        group_id: z.union([z.string(), z.number()]).optional()
    }),

    updateUser: z.object({
        display_name: z.string().max(100).optional(),
        role: z.enum(['ADMIN', 'PRODUCTOR', 'LOGISTICO']).optional(),
        group_id: z.union([z.string(), z.number(), z.null()]).optional(),
        status: z.enum(['APPROVED', 'PENDING', 'SUSPENDED']).optional()
    }),

    changePassword: z.object({
        currentPassword: z.string().min(1, 'Contraseña actual requerida'),
        newPassword: passwordSchema
    }),

    createEvent: z.object({
        name: z.string().min(1, 'Nombre requerido').max(200),
        date: z.string().optional(),
        location: z.string().max(500).optional(),
        description: z.string().max(2000).optional(),
        group_id: z.union([z.string(), z.number()]).optional()
    }),

    updateEvent: z.object({
        name: z.string().min(1).max(200).optional(),
        date: z.string().optional(),
        location: z.string().max(500).optional(),
        description: z.string().max(2000).optional(),
        status: z.enum(['ACTIVE', 'INACTIVE', 'COMPLETED']).optional()
    }),

    createGuest: z.object({
        name: z.string().min(1, 'Nombre requerido').max(200),
        email: z.string().email().optional().or(z.literal('')),
        phone: z.string().max(50).optional(),
        organization: z.string().max(200).optional(),
        gender: z.enum(['M', 'F', 'O']).optional(),
        position: z.string().max(200).optional(),
        dietary_notes: z.string().max(500).optional()
    }),

    broadcastEmail: z.object({
        event_id: z.union([z.string(), z.number()]),
        subject: z.string().min(1, 'Asunto requerido').max(500),
        body: z.string().min(1, 'Cuerpo requerido').max(50000)
    }),

    smtpConfig: z.object({
        smtp_host: z.string().max(200).optional(),
        smtp_port: z.number().int().min(1).max(65535).optional(),
        smtp_user: z.string().max(200).optional(),
        smtp_pass: z.string().optional(),
        smtp_secure: z.boolean().optional(),
        from_name: z.string().max(200).optional(),
        from_email: z.string().email().optional()
    }),

    queueControl: z.object({
        action: z.enum(['pause', 'resume', 'stop', 'clear']),
        event_id: z.union([z.string(), z.number()]).optional()
    }),

    idParam: z.object({
        id: z.union([z.string(), z.number()])
    }),

    eventIdParam: z.object({
        eventId: z.union([z.string(), z.number()])
    }),

    guestIdParam: z.object({
        guestId: z.union([z.string(), z.number()])
    }),

    pagination: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(500).default(50),
        search: z.string().max(200).optional()
    }),

    passwordResetRequest: z.object({
        username: emailSchema
    }),

    verifyResetCode: z.object({
        code: z.string().length(6, 'Código de 6 dígitos')
    }),

    resetPassword: z.object({
        code: z.string().length(6),
        new_password: passwordSchema
    }),

    createWebhook: z.object({
        event_id: z.union([z.string(), z.number(), z.null()]).optional(),
        name: z.string().min(1, 'Nombre requerido').max(200),
        url: z.string().url('URL inválida').max(500),
        secret: z.string().max(100).optional(),
        events: z.array(z.string()).min(1, 'Debe seleccionar al menos un evento'),
        headers: z.record(z.string()).optional(),
        status: z.enum(['ACTIVE', 'INACTIVE']).optional()
    }),

    updateWebhook: z.object({
        event_id: z.union([z.string(), z.number(), z.null()]).optional(),
        name: z.string().min(1).max(200).optional(),
        url: z.string().url('URL inválida').max(500).optional(),
        secret: z.string().max(100).optional(),
        events: z.array(z.string()).min(1).optional(),
        headers: z.record(z.string()).optional(),
        status: z.enum(['ACTIVE', 'INACTIVE']).optional()
    })
};

function validate(schema, data) {
    const result = schema.safeParse(data);
    if (!result.success) {
        const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
        return { valid: false, errors };
    }
    return { valid: true, data: result.data };
}

module.exports = { schemas, validate };
