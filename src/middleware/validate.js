/**
 * Validación de entrada con express-validator
 */
const { body, param, query, validationResult } = require('express-validator');

function handleErrors(req, res, next) {
    var errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            error: 'Datos inválidos',
            details: errors.array().map(function(e) { return { field: e.path, message: e.msg }; })
        });
    }
    next();
}

// Validaciones comunes
var validators = {
    eventId: param('eventId').isString().trim().notEmpty().withMessage('eventId requerido'),
    guestId: param('guestId').isString().trim().notEmpty().withMessage('guestId requerido'),
    email: body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
    name: body('name').isString().trim().isLength({ min: 1, max: 200 }).withMessage('Nombre requerido (max 200)'),
    password: body('password').isString().isLength({ min: 6 }).withMessage('Contraseña mínimo 6 caracteres'),
    pagination: [
        query('limit').optional().isInt({ min: 1, max: 1000 }).toInt(),
        query('offset').optional().isInt({ min: 0 }).toInt(),
    ]
};

module.exports = { handleErrors, validators };
