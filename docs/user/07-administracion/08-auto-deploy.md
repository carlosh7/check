# Auto-deploy con Webhooks

## ¿Qué es?

Endpoint que recibe avisos de GitHub cuando haces push al repositorio y
automáticamente redeploya la app en Portainer.

## ¿Para qué sirve?

Elimina el paso manual de ir a Portainer -> Redeploy cada vez que subes código.
Con cada `git push`, el deploy ocurre solo en segundos.

## ¿Cómo funciona?

1. GitHub envía un POST a `/api/deploy/webhook` con los datos del push
2. La app verifica la firma HMAC-SHA256 (solo eventos legítimos)
3. Si es push a `main`/`master`, llama al webhook de Portainer
4. Portainer redeploya el stack con el código nuevo
5. Todo queda registrado en `deploy_logs` para auditoría

## Configuración

1. Agrega al `.env`:
   - `DEPLOY_WEBHOOK_SECRET` - secreto compartido con GitHub
   - `PORTAINER_WEBHOOK_URL` - URL del webhook de Portainer (opcional)

2. En GitHub: Settings -> Webhooks -> Add webhook
   - URL: `https://check.app/api/deploy/webhook`
   - Content type: `application/json`
   - Secret: el mismo `DEPLOY_WEBHOOK_SECRET`
   - Events: "Push"

3. En Portainer: Stack -> Webhook -> Enable -> Copiar URL

## Ver logs

```bash
GET /api/deploy/logs?limit=50
```

Devuelve los últimos deploys registrados ordenados por fecha descendente.
