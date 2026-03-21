/**
 * JWT Utilities
 * Generación y verificación de tokens JWT
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'check-pro-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function generateToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return null;
    }
}

function decodeToken(token) {
    return jwt.decode(token);
}

module.exports = { generateToken, verifyToken, decodeToken, JWT_SECRET };
