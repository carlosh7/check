// Entorno de pruebas del limitador de peticiones.
// En producción NADIE queda exento por defecto: el contenedor recibe todas las peticiones desde la
// puerta de enlace de Docker (una IP privada), así que una exención "automática" de redes privadas
// apagaría el limitador para todo el mundo. En la suite de tests las peticiones salen de 127.0.0.1
// (supertest), así que aquí se exime explícitamente esa dirección.
process.env.RATE_LIMIT_EXEMPT_CIDRS = process.env.RATE_LIMIT_EXEMPT_CIDRS || '127.0.0.1/32,::1/128';
