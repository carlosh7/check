# Cobertura Backend ↔ Frontend — Check Pro v12.44.789

Generado automáticamente por `scripts/coverage-api.js` · 2026-08-25

## Resumen
- **Endpoints backend:** 426
- **Con uso desde el frontend:** 407 (96%)
- **Sin UI conectada:** 19 (4%)

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
| networking | 7 | 7 | 0 | 100% |
| venues | 6 | 6 | 0 | 100% |
| api-keys | 6 | 6 | 0 | 100% |
| ecommerce | 6 | 5 | 1 | 83% |
| seat-layouts | 5 | 5 | 0 | 100% |
| deploy | 5 | 4 | 1 | 80% |
| album | 5 | 5 | 0 | 100% |
| export | 5 | 5 | 0 | 100% |
| health | 4 | 3 | 1 | 75% |
| sms | 4 | 3 | 1 | 75% |
| whatsapp | 4 | 3 | 1 | 75% |
| v1 | 4 | 0 | 4 | 0% |
| crm | 4 | 4 | 0 | 100% |
| pricing | 4 | 4 | 0 | 100% |
| event | 3 | 3 | 0 | 100% |
| kiosk | 3 | 3 | 0 | 100% |
| landing | 3 | 3 | 0 | 100% |
| bi | 3 | 3 | 0 | 100% |
| captcha | 2 | 0 | 2 | 0% |
| transactions | 2 | 2 | 0 | 100% |
| tenant | 2 | 0 | 2 | 0% |
| marketplace | 2 | 1 | 1 | 50% |
| raíz | 2 | 2 | 0 | 100% |
| login | 1 | 1 | 0 | 100% |
| logout | 1 | 0 | 1 | 0% |
| signup | 1 | 1 | 0 | 100% |
| password-reset-request | 1 | 1 | 0 | 100% |
| verify-reset-code | 1 | 0 | 1 | 0% |
| reset-password | 1 | 1 | 0 | 100% |
| app-version | 1 | 1 | 0 | 100% |
| portal | 1 | 1 | 0 | 100% |
| event-by-slug | 1 | 1 | 0 | 100% |
| unsubscribe | 1 | 0 | 1 | 0% |
| public-register | 1 | 1 | 0 | 100% |
| audit-logs | 1 | 1 | 0 | 100% |
| automation | 1 | 1 | 0 | 100% |
| chatbot | 1 | 1 | 0 | 100% |
| predict | 1 | 1 | 0 | 100% |
| recommendations | 1 | 1 | 0 | 100% |
| analytics | 1 | 1 | 0 | 100% |
| stats | 1 | 1 | 0 | 100% |
| db | 1 | 1 | 0 | 100% |
| reports | 1 | 1 | 0 | 100% |
| metrics | 1 | 0 | 1 | 0% |
| performance | 1 | 1 | 0 | 100% |
| system | 1 | 1 | 0 | 100% |

## Endpoints sin UI (por módulo)

### captcha
- `GET /api/captcha`
- `POST /api/captcha/verify`

### deploy
- `POST /api/deploy/webhook`

### ecommerce
- `POST /api/ecommerce/webhook/:connectionId`

### health
- `GET /api/health/full`

### logout
- `POST /api/logout`

### marketplace
- `POST /api/marketplace/list`

### metrics
- `GET /api/metrics`

### security
- `POST /api/security/ai/chat`

### sms
- `POST /api/sms/send-to-guest/:guestId`

### tenant
- `GET /api/tenant/:slug`
- `GET /api/tenant/:slug/event/:eventId`

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
