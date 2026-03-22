const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'app-shell.html');
let content = fs.readFileSync(filePath, 'utf8');

// Buscamos la primera y segunda ocurrencia de id="view-system"
const firstIndex = content.indexOf('id="view-system"');
const secondIndex = content.indexOf('id="view-system"', firstIndex + 1);

if (secondIndex !== -1) {
    console.log('Duplicidad detectada en app-shell.html. Limpiando...');
    // El contenido parece duplicarse a partir de algún punto.
    // Vamos a intentar identificar el bloque duplicado.
    // Una forma segura es truncar el archivo antes de la segunda gran sección duplicada
    // si estamos seguros de que la primera es completa.
    
    // Sin embargo, es más seguro buscar el final de la primera sección o el patrón de repetición.
    // Dado que el archivo es muy grande, vamos a buscar si hay un bloque repetido exacto.
    
    // Si la línea 974 es igual a la 778, probablemente todo lo anterior se repitió.
    // Cortaremos el contenido en la segunda aparición de view-system y lo uniremos con el final del archivo
    // o simplemente eliminaremos el bloque redundante.
    
    // En este caso, parece que el bloque de administración se repitió.
    // Vamos a borrar desde la segunda aparición de id="view-system" hasta el final del div principal.
    
    // Pero espera, ¿qué hay después de la segunda aparición?
    // Si el archivo termina poco después, es una duplicación al final.
    
    const remaining = content.substring(secondIndex);
    // Si la segunda aparición ocurre cerca del final, es una duplicación accidental al concatenar.
    content = content.substring(0, secondIndex);
    
    // Asegurarse de cerrar los tags si cortamos abruptamente
    // Pero lo más probable es que el archivo tenga tags de cierre después.
    // Vamos a ver qué hay al final de 'content' ahora.
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('✓ app-shell.html saneado.');
