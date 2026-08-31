/**
 * Política de contraseñas (v12.44.802)
 *
 * Cierra el hallazgo P1-2 de la auditoría 2026-08: las credenciales sembradas
 * por defecto (admin@check.com/admin123 y admin@example.com/changeme123) quedaron
 * expuestas en el repo público. Desde esta versión:
 *  - Ninguna instalación crea un admin con credenciales conocidas (wizard de
 *    primer arranque en /api/setup).
 *  - Estas contraseñas expuestas quedan PROHIBIDAS como contraseña nueva en
 *    cualquier flujo (setup, signup, reset, cambio de contraseña, alta de usuario).
 *  - Toda contraseña nueva debe cumplir una fortaleza mínima.
 *
 * @module security/password-policy
 * @version 12.44.802
 */

const z = require('zod');

/**
 * Contraseñas quemadas: aparecieron públicamente en este repo (seeds antiguos
 * y .env.example). Nunca deben aceptarse como contraseña nueva.
 * @type {string[]}
 */
const EXPOSED_PASSWORDS = ['admin123', 'changeme123'];

/** Longitud mínima exigida a toda contraseña nueva */
const MIN_LENGTH = 10;

/**
 * Schema zod de fortaleza: longitud mínima + mayúscula + minúscula + número.
 * @type {z.ZodSchema}
 */
const strongPasswordSchema = z.string()
    .min(MIN_LENGTH, `La contraseña debe tener al menos ${MIN_LENGTH} caracteres`)
    .max(200, 'La contraseña no puede exceder 200 caracteres')
    .refine(pw => /[a-z]/.test(pw), 'Debe incluir al menos una letra minúscula')
    .refine(pw => /[A-Z]/.test(pw), 'Debe incluir al menos una letra mayúscula')
    .refine(pw => /[0-9]/.test(pw), 'Debe incluir al menos un número');

/**
 * ¿La contraseña está en la lista de contraseñas expuestas/conocidas?
 * @param {string} password
 * @returns {boolean}
 */
function isExposedPassword(password) {
    return EXPOSED_PASSWORDS.includes(String(password));
}

/**
 * Reglas de fortaleza en formato legible (para hints del frontend y mensajes).
 * @returns {string[]}
 */
function getPasswordRules() {
    return [
        `Mínimo ${MIN_LENGTH} caracteres`,
        'Al menos una letra mayúscula',
        'Al menos una letra minúscula',
        'Al menos un número'
    ];
}

/**
 * Validación completa de una contraseña NUEVA: fortaleza + lista de expuestas.
 * Usar en todo flujo que fije una contraseña (setup, signup, reset, cambio,
 * alta/edición de usuarios). El login NO usa esta función: una cuenta vieja
 * con contraseña hoy expuesta no se bloquea aquí, simplemente ya no puede
 * volverse a fijar esa contraseña.
 *
 * @param {string} password
 * @returns {{valid: boolean, errors: string[]}}
 */
function validatePasswordStrength(password) {
    const result = strongPasswordSchema.safeParse(String(password ?? ''));
    if (!result.success) {
        const issues = result.error.issues || [];
        return { valid: false, errors: issues.map(i => i.message) };
    }
    if (isExposedPassword(password)) {
        return { valid: false, errors: ['Esta contraseña es pública/conocida y no puede usarse. Elige una diferente.'] };
    }
    return { valid: true, errors: [] };
}

module.exports = {
    EXPOSED_PASSWORDS,
    MIN_LENGTH,
    strongPasswordSchema,
    isExposedPassword,
    getPasswordRules,
    validatePasswordStrength
};
