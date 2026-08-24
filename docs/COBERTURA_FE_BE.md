# Cobertura Backend ↔ Frontend — Check Pro v12.44.789

Generado automáticamente por `scripts/coverage-api.js` · 2026-08-24

## Resumen
- **Endpoints backend:** 426
- **Con uso desde el frontend:** 368 (86%)
- **Sin UI conectada:** 58 (14%)

> Nota: un endpoint "sin UI" no es necesariamente un error — hay endpoints
> para webhooks externos (Stripe/GitHub), API pública v1 (consumo externo),
> y flujos server-to-server. Se listan para revisión deliberada.

## Cobertura por módulo
| Módulo | Endpoints | Con UI | Sin UI | % |
|--------|-----------|--------|--------|---|
| events | 79 | 79 | 0 | 100% |
| guests | 37 | 37 | 0 | 100% |
| email | 35 | 35 | 0 | 100% |
| raffles | 21 | 21 | 0 | 100% |
| security | 16 | 15 | 1 | 94% |
| users | 13 | 13 | 0 | 100% |
| clients | 13 | 13 | 0 | 100% |
| compliance | 12 | 12 | 0 | 100% |
| webhooks | 11 | 11 | 0 | 100% |
| plugins | 10 | 10 | 0 | 100% |
| polls | 10 | 10 | 0 | 100% |
| sessions | 9 | 9 | 0 | 100% |
| certificates | 9 | 9 | 0 | 100% |
| groups | 8 | 8 | 0 | 100% |
| tenants | 8 | 8 | 0 | 100% |
| me | 7 | 7 | 0 | 100% |
| settings | 7 | 7 | 0 | 100% |
| leaderboard | 7 | 7 | 0 | 100% |
| networking | 7 | 0 | 7 | 0% |
| venues | 6 | 6 | 0 | 100% |
| api-keys | 6 | 0 | 6 | 0% |
| ecommerce | 6 | 5 | 1 | 83% |
| seat-layouts | 5 | 5 | 0 | 100% |
| deploy | 5 | 0 | 5 | 0% |
| album | 5 | 5 | 0 | 100% |
| export | 5 | 5 | 0 | 100% |
| health | 4 | 0 | 4 | 0% |
| sms | 4 | 3 | 1 | 75% |
| whatsapp | 4 | 3 | 1 | 75% |
| v1 | 4 | 0 | 4 | 0% |
| crm | 4 | 4 | 0 | 100% |
| pricing | 4 | 0 | 4 | 0% |
| event | 3 | 0 | 3 | 0% |
| kiosk | 3 | 0 | 3 | 0% |
| landing | 3 | 3 | 0 | 100% |
| bi | 3 | 2 | 1 | 67% |
| captcha | 2 | 0 | 2 | 0% |
| transactions | 2 | 0 | 2 | 0% |
| tenant | 2 | 0 | 2 | 0% |
| marketplace | 2 | 0 | 2 | 0% |
| raíz | 2 | 2 | 0 | 100% |
| login | 1 | 1 | 0 | 100% |
| logout | 1 | 0 | 1 | 0% |
| signup | 1 | 1 | 0 | 100% |
| password-reset-request | 1 | 1 | 0 | 100% |
| verify-reset-code | 1 | 0 | 1 | 0% |
| reset-password | 1 | 1 | 0 | 100% |
| app-version | 1 | 1 | 0 | 100% |
| portal | 1 | 0 | 1 | 0% |
| event-by-slug | 1 | 0 | 1 | 0% |
| unsubscribe | 1 | 0 | 1 | 0% |
| public-register | 1 | 1 | 0 | 100% |
| audit-logs | 1 | 1 | 0 | 100% |
| automation | 1 | 0 | 1 | 0% |
| chatbot | 1 | 1 | 0 | 100% |
| predict | 1 | 1 | 0 | 100% |
| recommendations | 1 | 1 | 0 | 100% |
| analytics | 1 | 1 | 0 | 100% |
| stats | 1 | 1 | 0 | 100% |
| db | 1 | 1 | 0 | 100% |
| reports | 1 | 1 | 0 | 100% |
| metrics | 1 | 0 | 1 | 0% |
| performance | 1 | 0 | 1 | 0% |
| system | 1 | 0 | 1 | 0% |

## Endpoints sin UI (por módulo)

### api-keys
- `GET /api/api-keys`
- `GET /api/api-keys/scopes`
- `POST /api/api-keys`
- `PATCH /api/api-keys/:id/toggle`
- `GET /api/api-keys/:id/stats`
- `DELETE /api/api-keys/:id`

### automation
- `GET /api/automation/options`

### bi
- `GET /api/bi/export/:format`

### captcha
- `GET /api/captcha`
- `POST /api/captcha/verify`

### deploy
- `POST /api/deploy/webhook`
- `GET /api/deploy/logs`
- `GET /api/deploy/encryption-status`
- `POST /api/deploy/migrate-encryption`
- `GET /api/deploy/rate-limit-status`

### ecommerce
- `POST /api/ecommerce/webhook/:connectionId`

### event
- `GET /api/event/:id`
- `GET /api/event/:id/ics`
- `GET /api/event/:id/qr`

### event-by-slug
- `GET /api/event-by-slug/:slug`

### health
- `GET /api/health`
- `GET /api/health/redis`
- `GET /api/health/full`
- `GET /api/health/system`

### kiosk
- `GET /api/kiosk/:eventId/search`
- `POST /api/kiosk/checkin`
- `GET /api/kiosk/:eventId/event`

### logout
- `POST /api/logout`

### marketplace
- `GET /api/marketplace/available`
- `POST /api/marketplace/list`

### metrics
- `GET /api/metrics`

### networking
- `POST /api/networking/connect`
- `GET /api/networking/:eventId/guest/:guestId`
- `GET /api/networking/:eventId/guest/:guestId/mutual`
- `GET /api/networking/:eventId/guest/:guestId/suggestions`
- `GET /api/networking/:eventId/guest/:guestId/score`
- `GET /api/networking/profile/:guestId`
- `GET /api/networking/:eventId/leaderboard`

### performance
- `GET /api/performance/logs`

### portal
- `GET /api/portal/:guestId`

### pricing
- `GET /api/pricing/tiers`
- `POST /api/pricing/tiers`
- `PUT /api/pricing/tiers/:id`
- `DELETE /api/pricing/tiers/:id`

### security
- `POST /api/security/ai/chat`

### sms
- `POST /api/sms/send-to-guest/:guestId`

### system
- `POST /api/system/backup`

### tenant
- `GET /api/tenant/:slug`
- `GET /api/tenant/:slug/event/:eventId`

### transactions
- `GET /api/transactions/:id`
- `GET /api/transactions/:id/receipt`

### unsubscribe
- `GET /api/unsubscribe/:token`

### v1
- `GET /api/v1/events`
- `GET /api/v1/events/:id`
- `GET /api/v1/events/:id/guests`
- `GET /api/v1/analytics`

### verify-reset-code
- `POST /api/verify-reset-code`

### whatsapp
- `POST /api/whatsapp/send-to-guest/:guestId`
