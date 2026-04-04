// imageOptimizer.js - Compresión automática de imágenes
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

/**
 * Comprime y optimiza una imagen subida
 * @param {Buffer} inputBuffer - Buffer de la imagen original
 * @param {Object} options - Opciones de compresión
 * @returns {Promise<Buffer>} - Buffer de la imagen optimizada
 */
async function optimizeImage(inputBuffer, options = {}) {
    const {
        maxWidth = 1920,
        maxHeight = 1080,
        quality = 80,
        format = 'jpeg'
    } = options;

    try {
        let pipeline = sharp(inputBuffer);
        
        // Obtener metadatos de la imagen original
        const metadata = await pipeline.metadata();
        const originalSize = inputBuffer.length;
        
        // Redimensionar si es necesario (manteniendo proporción)
        if (metadata.width > maxWidth || metadata.height > maxHeight) {
            pipeline = pipeline.resize(maxWidth, maxHeight, {
                fit: 'inside',
                withoutEnlargement: true
            });
        }

        // Convertir y comprimir según formato
        let optimizedBuffer;
        if (format === 'webp') {
            optimizedBuffer = await pipeline
                .webp({ quality, effort: 6 })
                .toBuffer();
        } else if (format === 'png') {
            optimizedBuffer = await pipeline
                .png({ quality, compressionLevel: 9 })
                .toBuffer();
        } else {
            // JPEG por defecto (mejor compresión para fotos)
            optimizedBuffer = await pipeline
                .jpeg({ quality, mozjpeg: true })
                .toBuffer();
        }

        const optimizedSize = optimizedBuffer.length;
        const savings = ((1 - optimizedSize / originalSize) * 100).toFixed(1);

        console.log(`[IMAGE] Optimizada: ${(originalSize / 1024).toFixed(1)}KB → ${(optimizedSize / 1024).toFixed(1)}KB (${savings}% ahorro)`);

        return {
            buffer: optimizedBuffer,
            originalSize,
            optimizedSize,
            savings: parseFloat(savings),
            format: format === 'webp' ? 'webp' : format === 'png' ? 'png' : 'jpg'
        };
    } catch (error) {
        console.error('[IMAGE] Error al optimizar imagen:', error.message);
        // Si falla la optimización, devolver la imagen original
        return { buffer: inputBuffer, originalSize: inputBuffer.length, optimizedSize: inputBuffer.length, savings: 0, format: 'original' };
    }
}

/**
 * Middleware para optimizar imágenes subidas con Multer
 */
function imageUploadMiddleware(req, res, next) {
    if (!req.file) return next();
    
    // Solo procesar imágenes
    const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!imageTypes.includes(req.file.mimetype)) return next();
    
    // Ignorar GIFs animados (sharp no los soporta bien)
    if (req.file.mimetype === 'image/gif') return next();

    optimizeImage(req.file.buffer)
        .then(result => {
            req.file.buffer = result.buffer;
            req.file.size = result.optimizedSize;
            req.file.optimized = true;
            req.file.optimizationSavings = result.savings;
            req.file.outputFormat = result.format;
            next();
        })
        .catch(next);
}

module.exports = { optimizeImage, imageUploadMiddleware };
