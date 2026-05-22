# UI Studio — Investigación de Conectores, APIs y Servicios

> **Propósito:** Determinar qué servicios/tecnologías debe soportar UI Studio para ser un visual app builder universal.
> **Contexto:** UI Studio genera layouts universales (JSON) y exporta a web, React Native, Capacitor.
> **Inspiración:** n8n (conectores), Supabase (backend), Appsmith (widgets), Retool (integraciones).

---

## Tabla de Contenidos

1. [Authentication Providers](#1-authentication-providers)
2. [Backend-as-a-Service](#2-backend-as-a-service)
3. [Database Connectors](#3-database-connectors)
4. [Hosting & Deployment](#4-hosting--deployment)
5. [Payment Processors](#5-payment-processors)
6. [Communication / Email](#6-communication--email)
7. [AI / LLM Providers](#7-ai--llm-providers)
8. [File Storage / CDN](#8-file-storage--cdn)
9. [Version Control / Git](#9-version-control--git)
10. [Monitoring & Analytics](#10-monitoring--analytics)
11. [MCP Servers](#11-mcp-servers-model-context-protocol)
12. [CI/CD](#12-cicd)
13. [Tabla Resumen: Nivel de Soporte Planeado](#13-tabla-resumen-nivel-de-soporte-planeado)
14. [Prioridades de Implementación](#14-prioridades-de-implementación)

---

## 1. Authentication Providers

### Auth0
- **API type:** REST + SDK (auth0.js, @auth0/auth0-react)
- **Auth method:** OAuth 2.0 / OIDC, API Key (Management API)
- **SDK JS/TS:** ✅ @auth0/auth0-spa-js, auth0.js, @auth0/nextjs-auth0
- **Management API:** CRUD usuarios, roles, aplicaciones
- **Auth API:** Login, logout, signup, MFA, password reset
- **UI Studio connector:** Nativo si usamos Auth0 como identity provider. HTTP Action alcanza para Management API.

### Clerk
- **API type:** REST + SDK (@clerk/nextjs, @clerk/clerk-react)
- **Auth method:** API Key (backend), JWT (frontend)
- **SDK JS/TS:** ✅ Clerk React, Clerk Next.js, Clerk Node
- **Endpoints:** Sign-up, sign-in, user management, orgs, sessions
- **Webhooks:** User created/updated/deleted, session events
- **UI Studio connector:** Nativo recomendado (tiene embeddable components como `<SignIn />` que UI Studio podría renderizar en canvas)

### Supabase Auth
- **API type:** REST (GoTrue API) + SDK (@supabase/supabase-js)
- **Auth method:** API Key (anon key + service role key), JWT
- **SDK JS/TS:** ✅ @supabase/supabase-js
- **Endpoints:** signUp, signIn, signOut, resetPassword, MFA, OAuth providers
- **UI Studio connector:** Nativo (viene incluido si usamos Supabase como BaaS)

### Firebase Auth
- **API type:** REST + SDK (firebase/auth)
- **Auth method:** API Key, JWT
- **SDK JS/TS:** ✅ firebase (auth module)
- **Endpoints:** createUserWithEmailAndPassword, signInWithEmailAndPassword, Google/Apple/GitHub OAuth
- **UI Studio connector:** Nativo (Firebase es ecosistema completo)

### NextAuth.js (Auth.js)
- **API type:** SDK (@auth/core, next-auth)
- **Auth method:** OAuth, JWT, Database sessions
- **SDK JS/TS:** ✅ next-auth, @auth/core
- **Providers:** 80+ OAuth providers integrados
- **UI Studio connector:** HTTP Action genérico (es un wrapper que se configura en el backend de la app generada)

### Lucia Auth
- **API type:** SDK (lucia-auth)
- **Auth method:** Database sessions + OAuth
- **SDK JS/TS:** ✅ lucia, @lucia-auth/oauth
- **Particularidad:** Framework-agnostic, database-agnostic
- **UI Studio connector:** HTTP Action genérico (es librería, no servicio, no tiene API externa)

**Conclusión autenticación:** UI Studio necesita un **nodo Auth nativo** que abstraiga: signUp, signIn, signOut, forgotPassword, OAuth. Luego cada provider concreto se configura con HTTP Action o plugin nativo si tiene API de management.

---

## 2. Backend-as-a-Service

### Supabase
- **API type:** REST (PostgREST) + GraphQL (pg_graphql) + Realtime (WebSocket) + Storage API
- **Auth method:** API Key (anon + service_role), JWT (RLS)
- **SDK JS/TS:** ✅ @supabase/supabase-js (unificado: DB, Auth, Storage, Realtime, Edge Functions)
- **Documentación:** ⭐ Excelente (supabase.com/docs)
- **Endpoints clave:**
  - REST: `https://<ref>.supabase.co/rest/v1/<table>` (CRUD automático desde schema)
  - GraphQL: `https://<ref>.supabase.co/graphql/v1`
  - Realtime: WebSocket para cambios en vivo
  - Storage: `https://<ref>.supabase.co/storage/v1`
  - Edge Functions: Deno deploy via CLI
  - Auth: GoTrue API
- **Row Level Security (RLS):** Políticas Postgres directamente en la API
- **UI Studio connector:** ⭐ **Nativo PRIORIDAD #1** — DB reflectada automática, auth integrado, realtime.

### Firebase
- **API type:** REST + SDK (firebase-admin, firebase)
- **Auth method:** API Key, OAuth, Service Account (admin)
- **SDK JS/TS:** ✅ firebase, firebase-admin
- **Servicios:** Firestore (NoSQL), Realtime DB, Auth, Storage, Functions, Messaging
- **Firestore API:** REST `https://firestore.googleapis.com/v1/projects/<project>/databases/(default)/documents/<collection>`
- **UI Studio connector:** Nativo (Firebase tiene SDK maduro, pero Firestore es NoSQL con query limitada vs Supabase)

### PocketBase
- **API type:** REST + WebSocket (Realtime)
- **Auth method:** JWT, OAuth2
- **SDK JS/TS:** ✅ pocketbase js-sdk (oficial)
- **Particularidad:** Open source, self-hosted, SQLite embebido (como Check Pro), admin UI embebida
- **API:** `http://<host>/api/collections/<collection>/records` — CRUD automático
- **UI Studio connector:** Nativo (arquitectura similar a Supabase pero SQLite, ideal para apps chicas/medianas)

### Appwrite
- **API type:** REST + SDK (@appwrite/js-sdk)
- **Auth method:** API Key, JWT
- **SDK JS/TS:** ✅ appwrite (js-sdk), appwrite-node
- **Servicios:** Auth, Databases, Storage, Functions, Messaging, GraphQL (parcial)
- **UI Studio connector:** Nativo (tiene funciones serverless integradas, buena DX)

### Nhost
- **API type:** GraphQL (Hasura) + REST
- **Auth method:** JWT, API Key
- **SDK JS/TS:** ✅ @nhost/nhost-js, @nhost/react
- **Stack:** Hasura GraphQL + Auth + Storage + Functions
- **UI Studio connector:** Nativo (GraphQL-first, Hasura da APIs automáticas desde Postgres)

### Convex
- **API type:** SDK (@convex-dev/react, convex) — RPC-style
- **Auth method:** JWT, OAuth
- **SDK JS/TS:** ✅ convex (framework full-stack)
- **Particularidad:** No es REST/GraphQL, es functions-driven. Escribes queries/mutations en TypeScript y se exponen automáticamente
- **UI Studio connector:** HTTP Action genérico (arquitectura muy distinta)

**Conclusión BaaS:** Supabase es el estándar de facto. UI Studio debería tener **conector nativo Supabase** como prioridad #1. PocketBase como #2 por simplicidad. Firebase por demanda de mercado.

---

## 3. Database Connectors

### PostgreSQL
- **API type:** Native protocol (via pg, postgres.js), REST (PostgREST), GraphQL (Hasura, pg_graphql)
- **Auth method:** User/password, SSL cert, JWT (via RLS)
- **SDK JS/TS:** ✅ pg, postgres.js, knex, drizzle-orm, prisma
- **Conexión directa:** `postgresql://user:pass@host:5432/db`
- **Serverless:** Neon, Supabase, Aiven, AWS RDS Proxy
- **UI Studio connector:** Nativo (conectar UI Studio DB browser + queries + CRUD generator)

### MySQL / MariaDB
- **API type:** Native protocol (via mysql2, mariadb)
- **Auth method:** User/password, SSL
- **SDK JS/TS:** ✅ mysql2, mariadb, knex, drizzle-orm
- **Conexión directa:** `mysql://user:pass@host:3306/db`
- **Serverless:** PlanetScale (MySQL-compatible)
- **UI Studio connector:** Nativo (similar a PG pero menos features de API automática)

### SQLite
- **API type:** Native (better-sqlite3, sql.js), Turso (libsql, HTTP)
- **Auth method:** File-based, Turso: JWT
- **SDK JS/TS:** ✅ better-sqlite3, sql.js, @libsql/client (Turso)
- **Turso (SQLite distribuido):** API HTTP `https://<db>.turso.io/v1`
- **UI Studio connector:** Nativo (SQLite es ideal para apps chicas, PocketBase ya lo usa)

### MongoDB
- **API type:** Native protocol (via mongodb driver), REST (Atlas Data API)
- **Auth method:** User/password, SCRAM, X.509, Atlas API Key
- **SDK JS/TS:** ✅ mongodb, mongoose, prisma
- **Atlas Data API:** REST `https://data.mongodb-api.com/app/<app>/endpoint/data/v1`
- **UI Studio connector:** Nativo (MongoDB es #2 en popularidad después de Postgres)

### Redis
- **API type:** Native protocol (via ioredis, node-redis), REST (RedisInsight API, Upstash)
- **Auth method:** Password, TLS, Upstash: Bearer token
- **SDK JS/TS:** ✅ ioredis, @redis/client, @upstash/redis
- **Upstash (Serverless Redis):** REST API `https://<region>.upstash.io`
- **UI Studio connector:** HTTP Action genérico (se usa más como cache/queue que como DB primaria)

### DynamoDB
- **API type:** REST (AWS SDK), PartiQL
- **Auth method:** AWS IAM (Access Key + Secret), Cognito
- **SDK JS/TS:** ✅ @aws-sdk/client-dynamodb, @aws-sdk/lib-dynamodb
- **UI Studio connector:** HTTP Action genérico (requiere SDK AWS complejo, mejor usar nodo REST)

### Firestore
- **API type:** REST + gRPC + SDK (firebase)
- **Auth method:** API Key, Service Account (admin), Firebase Auth
- **SDK JS/TS:** ✅ firebase/firestore, @google-cloud/firestore
- **API REST:** `https://firestore.googleapis.com/v1/projects/<project>/databases/(default)/documents`
- **UI Studio connector:** Nativo si Firebase es conector principal

**Conclusión DB:** UI Studio necesita conector **PG nativo** (más demanda) y **MySQL nativo**. El resto puede ser HTTP Action genérico. SQLite viene incluido si usamos PocketBase.

---

## 4. Hosting & Deployment

### Vercel
- **API type:** REST + CLI (@vercel/sdk)
- **Auth method:** Bearer token (Vercel Access Token)
- **SDK JS/TS:** ✅ @vercel/sdk (npm)
- **Endpoints clave:**
  - `POST /v9/projects` — crear proyecto
  - `POST /v13/deployments` — hacer deploy (file-token o git)
  - `GET /v9/projects/<id>/domains` — dominios custom
- **Auto-deploy:** GitHub/GitLab/Bitbucket integration
- **UI Studio connector:** Nativo (es el deploy target #1 para apps web generadas)

### Netlify
- **API type:** REST + CLI (netlify-cli)
- **Auth method:** Bearer token (Personal Access Token)
- **SDK JS/TS:** ✅ netlify (npm package)
- **Endpoints:**
  - `POST /api/v1/sites` — crear site
  - `POST /api/v1/deploys` — deploy (zip upload)
  - `POST /api/v1/forms` — forms handling
- **UI Studio connector:** Nativo (deploy target #2, especialmente para apps con forms/functions)

### Railway
- **API type:** REST + GraphQL + CLI
- **Auth method:** Bearer token (Railway API Key)
- **SDK JS/TS:** No oficial, CLI + API directa
- **Endpoints:** Create project, deploy, env vars, domains
- **UI Studio connector:** HTTP Action genérico (API menos madura que Vercel/Netlify)

### Render
- **API type:** REST
- **Auth method:** API Key
- **SDK JS/TS:** No oficial (API directa)
- **Endpoints:** `POST /v1/services`, deploy from Git
- **UI Studio connector:** HTTP Action genérico

### Fly.io
- **API type:** REST + CLI (flyctl + WireGuard)
- **Auth method:** API Token (Fly API Token)
- **SDK JS/TS:** No oficial
- **Endpoints:** Machine management, apps, volumes, certs
- **UI Studio connector:** HTTP Action genérico (infra muy específica)

### AWS (Amplify / Elastic Beanstalk / ECS)
- **API type:** REST + SDK (@aws-sdk/client-amplify, @aws-sdk/client-ecs)
- **Auth method:** AWS IAM (Access Key + Secret), Cognito
- **SDK JS/TS:** ✅ @aws-sdk/client-amplify, aws-cdk
- **Amplify:** Build + deploy hosting
- **UI Studio connector:** HTTP Action genérico (SDK AWS es muy grande, no tiene sentido nativo)

### Cloudflare Pages
- **API type:** REST + Wrangler CLI
- **Auth method:** API Token (Cloudflare API Token)
- **SDK JS/TS:** ✅ wrangler (CLI), @cloudflare/pages-api (no oficial)
- **Endpoints:** `POST /client/v4/accounts/<id>/pages/projects`
- **UI Studio connector:** Nativo (crecimiento enorme, workers + pages, ideal para apps edge)

**Conclusión hosting:** Vercel y Netlify son targets #1. Cloudflare Pages sube rápido. El resto con HTTP Action.

---

## 5. Payment Processors

### Stripe
- **API type:** REST + SDK (@stripe/stripe-js, stripe-node)
- **Auth method:** Secret Key (sk_live/sk_test) + Publishable Key (pk_live/pk_test)
- **SDK JS/TS:** ✅ stripe (node), @stripe/stripe-js (frontend)
- **Endpoints clave:**
  - `POST /v1/checkout/sessions` — sesión de checkout
  - `POST /v1/payment_intents` — pago directo
  - `POST /v1/subscriptions` — suscripciones
  - `POST /v1/webhook_endpoints` — webhooks
  - `GET /v1/products` / `GET /v1/prices` — catálogo
  - `POST /v1/invoices` — facturación
- **Webhooks:** checkout.session.completed, invoice.paid, customer.subscription.updated
- **UI Studio connector:** ⭐ **Nativo PRIORIDAD #1** — Stripe es el estándar. Necesita nodo Checkout + nodo Subscriptions + nodo Webhook receiver.

### PayPal
- **API type:** REST + SDK (@paypal/checkout-server-sdk)
- **Auth method:** OAuth 2.0 (Client ID + Secret → Bearer token)
- **SDK JS/TS:** ✅ @paypal/checkout-server-sdk, @paypal/react-paypal-js
- **Endpoints:**
  - `POST /v2/checkout/orders` — crear orden
  - `POST /v2/checkout/orders/<id>/capture` — capturar pago
  - `POST /v1/billing/subscriptions` — suscripciones
- **UI Studio connector:** Nativo (complemento a Stripe, menos features)

### Lemon Squeezy
- **API type:** REST + SDK (lemonsqueezy.js)
- **Auth method:** API Key (Bearer)
- **SDK JS/TS:** ✅ @lemonsqueezy/lemonsqueezy.js (oficial)
- **Endpoints:**
  - Checkout, subscriptions, customers, stores, products, variants
  - Webhooks: order_created, subscription_*
- **Particularidad:** Ideal para SaaS, tax handling incluido, affiliate system
- **UI Studio connector:** Nativo (creciendo rápido en espacio indie/SaaS)

### Paddle
- **API type:** REST + SDK (@paddle/paddle-js, paddle-node)
- **Auth method:** API Key (Vendor Auth Code) + Public Key (verificación)
- **SDK JS/TS:** ✅ @paddle/paddle-js, paddle-sdk (node)
- **Endpoints:** Checkout, subscriptions, products, prices, transactions, webhooks
- **UI Studio connector:** Nativo (bueno para mercado global, tax compliance incluido)

**Conclusión pagos:** Stripe es obligatorio nativo. Paddle y Lemon Squeezy para SaaS global. PayPal por demanda.

---

## 6. Communication / Email

### SendGrid (Twilio SendGrid)
- **API type:** REST + SDK (@sendgrid/mail)
- **Auth method:** API Key
- **SDK JS/TS:** ✅ @sendgrid/mail, @sendgrid/client
- **Endpoints:**
  - `POST /v3/mail/send` — enviar email
  - `GET /v3/templates` — templates dinámicos
  - `GET /v3/lists` — contact lists
  - `POST /v3/contactdb/recipients` — gestión contactos
- **UI Studio connector:** Nativo (email transaccional más usado)

### Resend
- **API type:** REST + SDK (resend)
- **Auth method:** API Key
- **SDK JS/TS:** ✅ resend (npm)
- **Endpoints:**
  - `POST /emails` — enviar email
  - `GET /audiences` — gestión audiences
  - React Email compatible (JSX → HTML)
- **UI Studio connector:** Nativo (moderno, DX excelente, React Email integration)

### Mailgun
- **API type:** REST + SDK (mailgun.js)
- **Auth method:** API Key
- **SDK JS/TS:** ✅ mailgun.js
- **Endpoints:** `POST /v3/<domain>/messages`, tracking, validation
- **UI Studio connector:** HTTP Action genérico

### Postmark
- **API type:** REST + SDK (postmark)
- **Auth method:** Server Token (API Key)
- **SDK JS/TS:** ✅ postmark (npm)
- **Endpoints:** `POST /email`, `POST /email/batch`, `POST /message-streams`
- **UI Studio connector:** HTTP Action genérico (excelente deliverability pero menos usado que SendGrid)

### Twilio (SMS/Voice)
- **API type:** REST + SDK (twilio)
- **Auth method:** Account SID + Auth Token
- **SDK JS/TS:** ✅ twilio (npm)
- **Endpoints:**
  - `POST /2010-04-01/Accounts/<sid>/Messages.json` — enviar SMS
  - `POST /2010-04-01/Accounts/<sid>/Calls.json` — llamadas
  - Verify API, Conversations API
- **UI Studio connector:** Nativo (SMS es canal de comunicación crítico)

### Slack Webhooks
- **API type:** REST (Webhook URL)
- **Auth method:** Webhook URL (token in URL)
- **SDK JS/TS:** No necesita (fetch directo a URL)
- **Endpoints:** `POST <webhook_url>` — JSON con mensaje
  - `{ text: "message" }` — simple
  - `{ blocks: [...] }` — rich layout
- **UI Studio connector:** HTTP Action genérico (es solo un POST)

### Discord Webhooks
- **API type:** REST (Webhook URL)
- **Auth method:** Webhook URL
- **SDK JS/TS:** discord.js (opcional)
- **Endpoints:** `POST <webhook_url>` — JSON
  - `{ content: "message" }`
  - `{ embeds: [...] }` — rich embeds
- **UI Studio connector:** HTTP Action genérico (es solo un POST)

**Conclusión comunicación:** Resend y SendGrid como nativos para email. Twilio para SMS. Webhooks Slack/Discord son HTTP Action simple.

---

## 7. AI / LLM Providers

### OpenAI
- **API type:** REST + SDK (openai)
- **Auth method:** API Key (Bearer), Organization ID (opcional)
- **SDK JS/TS:** ✅ openai (npm) — v4 con streaming, tool calls
- **Endpoints:**
  - `POST /v1/chat/completions` — chat (messages array)
  - `POST /v1/embeddings` — vector embeddings
  - `POST /v1/images/generations` — DALL-E
  - `POST /v1/audio/transcriptions` — Whisper
  - `POST /v1/assistants` — Assistants API (threads, runs, tools)
- **Formato mensajes:** `[{ role: "system"|"user"|"assistant"|"tool", content: "..." }]`
- **Streaming:** SSE (Server-Sent Events), `stream: true`
- **UI Studio connector:** ⭐ **Nativo #1** — Nodo Chat + Nodo Embeddings + Nodo Vision

### Anthropic (Claude)
- **API type:** REST + SDK (@anthropic-ai/sdk)
- **Auth method:** API Key (x-api-key header)
- **SDK JS/TS:** ✅ @anthropic-ai/sdk
- **Endpoints:**
  - `POST /v1/messages` — chat (system + messages array)
  - `POST /v1/complete` — legacy text completion
- **Formato:** Diferente de OpenAI: `{ system: "...", messages: [{ role: "user"|"assistant", content: "..." }] }`
- **Streaming:** SSE
- **UI Studio connector:** Nativo (formato distinto a OpenAI, necesita adapter)

### Google Gemini
- **API type:** REST + SDK (@google/generative-ai)
- **Auth method:** API Key
- **SDK JS/TS:** ✅ @google/generative-ai
- **Endpoints:**
  - `POST /v1beta/models/gemini-pro:generateContent`
  - `POST /v1beta/models/gemini-pro-vision:generateContent`
- **Formato:** `{ contents: [{ role: "user"|"model", parts: [{ text: "..." }] }] }`
- **UI Studio connector:** Nativo (formato Google)

### Mistral AI
- **API type:** REST + SDK (@mistralai/mistralai)
- **Auth method:** API Key
- **SDK JS/TS:** ✅ @mistralai/mistralai
- **Endpoints:**
  - `POST /v1/chat/completions` — **formato OpenAI-compatible!**
  - `POST /v1/embeddings`
  - `POST /v1/fim/completions` — fill-in-the-middle
- **UI Studio connector:** HTTP Action genérico (formato = OpenAI, mismo nodo)

### Ollama (Local)
- **API type:** REST
- **Auth method:** None (localhost) o API Key (remote)
- **SDK JS/TS:** No oficial (fetch directo)
- **Endpoints:**
  - `POST /api/chat` — `{ model: "llama3", messages: [...] }`
  - `POST /api/generate` — `{ model: "llama3", prompt: "..." }`
  - `GET /api/tags` — listar modelos instalados
- **Formato:** Similar a OpenAI
- **UI Studio connector:** HTTP Action genérico (OpenAI-compatible de facto)

### Groq
- **API type:** REST
- **Auth method:** API Key
- **SDK JS/TS:** No oficial (OpenAI-compatible)
- **Endpoints:** `POST /openai/v1/chat/completions` — **OpenAI API compatible**
- **UI Studio connector:** HTTP Action genérico (mismo formato OpenAI)

### Together AI
- **API type:** REST + SDK (@together-ai/node-sdk)
- **Auth method:** API Key
- **SDK JS/TS:** ✅ @together-ai/node-sdk
- **Endpoints:** `POST /v1/chat/completions` — **OpenAI API compatible**
- **UI Studio connector:** HTTP Action genérico (mismo formato OpenAI)

**Conclusión AI:** El mercado converge a formato **OpenAI API** (Mistral, Groq, Together, Ollama, Perplexity, Fireworks, OpenRouter, DeepSeek todos lo usan). Anthropic y Gemini usan formatos distintos. UI Studio necesita:
- 1 nodo **Chat LLM** que soporte múltiples providers via adapter
- Estrategia: **OpenAI como formato base**, Anthropic y Gemini como adapters separados
- Nodo **Chat + Streaming** es crítico

---

## 8. File Storage / CDN

### AWS S3
- **API type:** REST + SDK (@aws-sdk/client-s3)
- **Auth method:** AWS IAM (Access Key + Secret), Presigned URLs
- **SDK JS/TS:** ✅ @aws-sdk/client-s3, aws-sdk
- **Endpoints:**
  - `PUT /<bucket>/<key>` — upload
  - `GET /<bucket>/<key>` — download
  - `POST /<bucket>` — presigned POST
  - `GET /<bucket>?list-type=2` — list objects
- **UI Studio connector:** Nativo (S3 es estándar de almacenamiento cloud)

### Cloudflare R2
- **API type:** REST (S3-compatible) + SDK
- **Auth method:** S3-compatible (Access Key + Secret) + API Token
- **SDK JS/TS:** ✅ @aws-sdk/client-s3 (S3-compatible, mismo SDK!)
- **Particularidad:** Zero egress fees, S3-compatible API
- **UI Studio connector:** Nativo (S3-compatible, casi mismo código que AWS S3)

### Google Cloud Storage
- **API type:** REST + SDK (@google-cloud/storage)
- **Auth method:** Service Account (JWT), API Key, OAuth
- **SDK JS/TS:** ✅ @google-cloud/storage
- **Endpoints:**
  - `POST /upload/storage/v1/b/<bucket>/o` — upload
  - `GET /storage/v1/b/<bucket>/o/<object>` — download
- **UI Studio connector:** Nativo (similar a S3 pero API distinta)

### UploadThing
- **API type:** REST + SDK (uploadthing)
- **Auth method:** API Key
- **SDK JS/TS:** ✅ uploadthing (npm)
- **Endpoints:** Upload via presigned URL (serverless-ready)
- **UI Studio connector:** HTTP Action genérico (es wrapper sobre S3)

### Vercel Blob
- **API type:** REST + SDK (@vercel/blob)
- **Auth method:** Bearer token
- **SDK JS/TS:** ✅ @vercel/blob
- **Endpoints:**
  - `PUT /` — upload (presigned URL)
  - `DELETE /` — delete
  - `HEAD /` — metadata
- **UI Studio connector:** Nativo (si Vercel es deploy target, Blob es natural)

**Conclusión storage:** S3 es el estándar universal. R2 y Vercel Blob como nativos complementarios.

---

## 9. Version Control / Git

### GitHub API
- **API type:** REST + GraphQL + SDK (@octokit/rest, octokit)
- **Auth method:** Personal Access Token (PAT), OAuth, GitHub App (JWT)
- **SDK JS/TS:** ✅ @octokit/rest, octokit (GitHub oficial)
- **Endpoints clave:**
  - `POST /repos/{owner}/{repo}` — crear repo
  - `POST /repos/{owner}/{repo}/pulls` — crear PR
  - `POST /repos/{owner}/{repo}/issues` — crear issue
  - `POST /repos/{owner}/{repo}/git/refs` — crear branch
  - `PUT /repos/{owner}/{repo}/contents/{path}` — commit archivo
  - GraphQL: `POST /graphql` — queries más flexibles
- **UI Studio connector:** ⭐ **Nativo** (función "Deploy con Git" + "Publicar en GitHub Pages")

### GitLab API
- **API type:** REST + GraphQL + SDK (@gitbeaker/rest)
- **Auth method:** Personal Access Token, OAuth
- **SDK JS/TS:** ✅ @gitbeaker/rest, @gitbeaker/node
- **Endpoints clave:**
  - `POST /projects` — crear proyecto
  - `POST /projects/<id>/merge_requests` — crear MR
  - `POST /projects/<id>/repository/commits` — commit
  - CI/CD: `POST /projects/<id>/pipeline` — trigger pipeline
- **UI Studio connector:** Nativo (GitLab CI/CD es muy usado)

### Bitbucket API
- **API type:** REST + SDK (bitbucket)
- **Auth method:** OAuth, Username + App Password
- **SDK JS/TS:** ✅ bitbucket (npm)
- **Endpoints:** Repos, PRs, commits, pipelines
- **UI Studio connector:** HTTP Action genérico (menos demanda)

**Conclusión Git:** GitHub es indispensable nativo. GitLab como #2. Bitbucket HTTP Action.

---

## 10. Monitoring & Analytics

### Sentry
- **API type:** REST + SDK (@sentry/node, @sentry/react)
- **Auth method:** DSN (DSN string) + Auth Token (Management API)
- **SDK JS/TS:** ✅ @sentry/node, @sentry/react, @sentry/nextjs
- **Endpoints:**
  - `POST /api/<project>/store/` — enviar evento
  - `GET /api/0/projects/<org>/<project>/issues/` — listar issues
  - `GET /api/0/organizations/<org>/events/` — query events
- **UI Studio connector:** Nativo (Sentry es el estándar de monitoreo JS)

### PostHog
- **API type:** REST + SDK (posthog-js, posthog-node)
- **Auth method:** API Key (ph_project_api_key + personal API key)
- **SDK JS/TS:** ✅ posthog-js, posthog-node
- **Servicios:** Product analytics, feature flags, session recording, experiments
- **Endpoints:**
  - `POST /capture` — capturar evento
  - `POST /decide` — feature flags
  - `GET /api/projects/<id>/insights/` — queries
- **Self-hosted:** Sí (Docker)
- **UI Studio connector:** Nativo (all-in-one analytics + flags + recordings)

### Plausible
- **API type:** REST + SDK (plausible-tracker)
- **Auth method:** API Key (Bearer)
- **SDK JS/TS:** ✅ plausible-tracker (npm)
- **Endpoints:**
  - `POST /api/event` — track evento
  - `GET /api/v1/stats/aggregate` — stats queries
  - `GET /api/v1/stats/breakdown` — breakdown
- **Self-hosted:** Sí (Docker, simple)
- **UI Studio connector:** HTTP Action genérico (analytics simple, solo POST events)

### Umami
- **API type:** REST + SDK (umami)
- **Auth method:** API Key
- **SDK JS/TS:** ✅ umami (npm package tracker)
- **Endpoints:** Track event, stats API, analytics queries
- **Self-hosted:** Sí
- **UI Studio connector:** HTTP Action genérico (simple, analytics-focused)

### LogSnag
- **API type:** REST
- **Auth method:** Bearer token
- **SDK JS/TS:** ✅ logsnag (npm)
- **Endpoints:** `POST /v1/log` — enviar log/evento
- **UI Studio connector:** HTTP Action genérico (es solo un POST)

### BetterStack (Logs + Uptime)
- **API type:** REST
- **Auth method:** API Key
- **SDK JS/TS:** No oficial (API directa)
- **Endpoints:** Ingest logs, query logs, uptime monitors, status pages
- **UI Studio connector:** HTTP Action genérico (log shipping vía POST)

**Conclusión monitoring:** Sentry (errores) y PostHog (analytics + flags) como nativos. Lo demás HTTP Action.

---

## 11. MCP Servers (Model Context Protocol)

MCP es un protocolo abierto de Anthropic para que los LLMs interactúen con herramientas externas. UI Studio debería exponer MCP servers para que AIs puedan manipular proyectos visualmente.

### MCP Servers Oficiales (por Anthropic/Claude)

| Server | Funcionalidad | API type | Relevancia UI Studio |
|--------|--------------|----------|---------------------|
| **Filesystem** | Leer/escribir archivos, buscar, mover | Stdio/HTTP | Alta — UI Studio podría exponer proyectos como FS |
| **GitHub** | PRs, issues, repos, commits | HTTP + OAuth | Alta — crear repo desde UI Studio |
| **Git** | Commit, diff, log, status | Stdio | Alta — versionar proyectos UI Studio |
| **PostgreSQL** | Query, schema, tables | HTTP + DB | Alta — UI Studio conecta a PG via MCP |
| **SQLite** | Query, schema, tables | Stdio | Alta — lo mismo pero SQLite |
| **Slack** | Mensajes, canales, búsqueda | HTTP + OAuth | Media — notificar cambios |
| **Puppeteer** | Browser automation | Stdio | Alta — UI Studio podría hacer E2E testing |
| **Sentry** | Issues, eventos | HTTP + API Key | Media |
| **Cloudflare** | Workers, DNS, Pages | HTTP + API Token | Alta — deploy UI Studio a CF |
| **Memory** | Knowledge graph persistente | Stdio | Media |

### MCP Servers Comunitarios Relevantes

| Server | Funcionalidad | Creado por |
|--------|--------------|-----------|
| **Stripe MCP** | Payments, subscriptions, products | @stripe |
| **Supabase MCP** | Query, auth, storage | @supabase (comunitario) |
| **Vercel MCP** | Deployments, projects, domains | @vercel (comunitario) |
| **Notion MCP** | Pages, databases, search | @notionhq |
| **Linear MCP** | Issues, projects, cycles | @linear |
| **Figma MCP** | Design files, components, styles | Comunitario |
| **OpenAPI MCP** | Cualquier API REST con spec OpenAPI | Comunitario |
| **Airtable MCP** | Bases, tables, records | Comunitario |
| **Docker MCP** | Containers, images, compose | Comunitario |

### Qué debería exponer UI Studio como MCP Server

```
uistudio-mcp
├── projects — list, create, read layouts
├── components — list, create, update, delete
├── pages — CRUD de páginas/rutas
├── data — conexiones a DB/API
├── export — trigger export (web, RN, mobile)
├── deploy — trigger deploy (Vercel, Netlify)
└── preview — obtener preview URL del proyecto
```

**UI Studio connector:** UI Studio debería tener su propio MCP server para permitir edición vía IA (Claude Desktop, Cursor, etc.). Esto es **diferenciador clave** frente a Retool/Appsmith.

---

## 12. CI/CD

### GitHub Actions
- **API type:** REST + SDK (@actions/core, @octokit)
- **Auth method:** PAT, GitHub App (JWT)
- **SDK JS/TS:** ✅ @octokit/rest (trigger workflow via API)
- **Endpoints:**
  - `POST /repos/{owner}/{repo}/actions/workflows/{id}/dispatches` — trigger workflow
  - `GET /repos/{owner}/{repo}/actions/runs` — status
  - `POST /repos/{owner}/{repo}/actions/runners/registration-token` — self-hosted runners
- **UI Studio connector:** Nativo (trigger "Deploy con Actions" es feature esperada)

### GitLab CI
- **API type:** REST
- **Auth method:** Personal Access Token, CI Job Token
- **SDK JS/TS:** ✅ @gitbeaker/rest
- **Endpoints:**
  - `POST /projects/<id>/pipeline` — trigger pipeline
  - `POST /projects/<id>/trigger/pipeline` — trigger with token
- **UI Studio connector:** Nativo (GitLab CI es segundo más usado)

### CircleCI
- **API type:** REST + API v2
- **Auth method:** Personal API Token
- **SDK JS/TS:** No oficial (API directa)
- **Endpoints:**
  - `POST /api/v2/project/<slug>/pipeline` — trigger pipeline
  - `GET /api/v2/project/<slug>/pipeline/<id>` — status
- **UI Studio connector:** HTTP Action genérico

### Jenkins
- **API type:** REST (XML/JSON)
- **Auth method:** API Token (user:token Basic Auth)
- **SDK JS/TS:** No oficial
- **Endpoints:**
  - `POST /job/<jobname>/build` — trigger build
  - `POST /job/<jobname>/buildWithParameters` — build con params
- **UI Studio connector:** HTTP Action genérico (intra-empresa legacy)

**Conclusión CI/CD:** GitHub Actions como nativo. GitLab CI como #2. CircleCI y Jenkins HTTP Action.

---

## 13. Tabla Resumen: Nivel de Soporte Planeado

### Leyenda
| Icono | Significado |
|-------|-------------|
| ⭐ **NATIVO** | Conector built-in en UI Studio (nodo visual con configuración) |
| 📦 **SDK** | No hay nodo visual pero UI Studio expone SDK/plugin system |
| 🔌 **HTTP** | Alcanza con el nodo HTTP Action genérico (POST/GET/PUT/DELETE + headers) |
| ❌ **No** | No requiere soporte específico |

### Categorías

| Servicio | Tipo API | Auth | SDK JS/TS | Nivel | Razón |
|----------|----------|------|-----------|-------|-------|
| **Supabase** | REST + GraphQL + Realtime | API Key + JWT | ✅ @supabase/supabase-js | ⭐ NATIVO | BaaS líder, DB + Auth + Storage + Realtime |
| **Firebase** | REST + SDK | API Key | ✅ firebase | ⭐ NATIVO | Demanda de mercado, ecosistema completo |
| **PocketBase** | REST + WS | JWT | ✅ pocketbase | ⭐ NATIVO | Self-hosted simple, SQLite |
| **Auth0** | REST + OIDC | OAuth + API Key | ✅ @auth0/auth0-spa-js | 🔌 HTTP | Management API vía HTTP, Auth vía SDK |
| **Clerk** | REST | API Key | ✅ @clerk/react | ⭐ NATIVO | Componentes embeddables, DX excelente |
| **NextAuth/Auth.js** | SDK | OAuth/Database | ✅ next-auth | 🔌 HTTP | Es backend library, no servicio externo |
| **Stripe** | REST | Secret Key | ✅ stripe | ⭐ NATIVO | Checkout + Subs + Webhooks + Invoices |
| **PayPal** | REST | OAuth | ✅ @paypal/checkout | ⭐ NATIVO | Complemento a Stripe |
| **Lemon Squeezy** | REST | API Key | ✅ @lemonsqueezy | ⭐ NATIVO | SaaS-focused, tax included |
| **Paddle** | REST | API Key | ✅ @paddle/paddle-js | 🔌 HTTP | Similar a Lemon Squeezy, menos demanda |
| **OpenAI** | REST | API Key | ✅ openai | ⭐ NATIVO | Chat + Embeddings + Vision + Assistants |
| **Anthropic** | REST | API Key | ✅ @anthropic-ai/sdk | ⭐ NATIVO | Claude es #2, formato distinto |
| **Google Gemini** | REST | API Key | ✅ @google/generative-ai | 🔌 HTTP | Formato Google, menos popular |
| **Mistral/Groq/Together/Ollama** | REST (OpenAI-format) | API Key | Varios | 🔌 HTTP | Todos formato OpenAI, un nodo basta |
| **Resend** | REST | API Key | ✅ resend | ⭐ NATIVO | Email moderno, React Email |
| **SendGrid** | REST | API Key | ✅ @sendgrid/mail | 🔌 HTTP | Email transaccional legacy |
| **Twilio SMS** | REST | Account SID + Token | ✅ twilio | ⭐ NATIVO | Canal comunicación crítico |
| **Slack Webhooks** | REST (webhook) | Webhook URL | No necesita | 🔌 HTTP | Simple POST request |
| **Discord Webhooks** | REST (webhook) | Webhook URL | No necesita | 🔌 HTTP | Simple POST request |
| **Amazon S3** | REST | AWS IAM | ✅ @aws-sdk/client-s3 | ⭐ NATIVO | Estándar almacenamiento cloud |
| **Cloudflare R2** | REST (S3-compat) | API Key | ✅ @aws-sdk/client-s3 | ⭐ NATIVO | S3-compatible, zero egress |
| **Google Cloud Storage** | REST | Service Account | ✅ @google-cloud/storage | 🔌 HTTP | Similar a S3 pero API distinta |
| **Vercel Blob** | REST | Bearer Token | ✅ @vercel/blob | ⭐ NATIVO | Natural si deploy es Vercel |
| **Vercel** | REST | Bearer Token | ✅ @vercel/sdk | ⭐ NATIVO | Deploy target #1 |
| **Netlify** | REST | Bearer Token | ✅ netlify | ⭐ NATIVO | Deploy target #2 |
| **Cloudflare Pages** | REST | API Token | ✅ wrangler | ⭐ NATIVO | Edge deployment |
| **Railway/Render/Fly.io** | REST | API Key | No oficial | 🔌 HTTP | Menos demanda, API menos madura |
| **AWS Amplify** | REST | AWS IAM | ✅ @aws-sdk/client-amplify | 🔌 HTTP | AWS es complejo, HTTP basta |
| **PostgreSQL** | Native protocol | User/pass | ✅ pg | ⭐ NATIVO | DB más demandada |
| **MySQL** | Native protocol | User/pass | ✅ mysql2 | ⭐ NATIVO | DB #2 más demandada |
| **SQLite** | Native/HTTP | File/Token | ✅ better-sqlite3 | ⭐ NATIVO | Ideal apps chicas (via PocketBase) |
| **MongoDB** | Native/REST | User/pass | ✅ mongodb | ⭐ NATIVO | DB NoSQL #1 |
| **Redis** | Native/REST | Password | ✅ ioredis | 🔌 HTTP | Cache/queue, no DB primaria |
| **DynamoDB** | REST | AWS IAM | ✅ @aws-sdk/client-dynamodb | 🔌 HTTP | AWS-locked, HTTP alcanza |
| **GitHub API** | REST + GraphQL | PAT | ✅ @octokit/rest | ⭐ NATIVO | Create repo, commit, PR desde UI Studio |
| **GitLab API** | REST | PAT | ✅ @gitbeaker/rest | ⭐ NATIVO | GitLab CI/CD trigger |
| **Bitbucket API** | REST | OAuth | ✅ bitbucket | 🔌 HTTP | Menos demanda |
| **GitHub Actions** | REST | PAT | ✅ @octokit | ⭐ NATIVO | Trigger CI/CD, deploy |
| **GitLab CI** | REST | PAT | ✅ @gitbeaker | ⭐ NATIVO | Trigger pipelines |
| **CircleCI** | REST | API Token | No oficial | 🔌 HTTP | Trigger vía HTTP |
| **Jenkins** | REST | API Token | No oficial | 🔌 HTTP | Legacy, HTTP basta |
| **Sentry** | REST + DSN | DSN + Token | ✅ @sentry/react | ⭐ NATIVO | Error monitoring estándar |
| **PostHog** | REST | API Key | ✅ posthog-js | ⭐ NATIVO | Analytics + Feature Flags + Recordings |
| **Plausible/Umami** | REST | API Key | ✅ plausible-tracker | 🔌 HTTP | Analytics simple, POST events |
| **LogSnag** | REST | Bearer | ✅ logsnag | 🔌 HTTP | Simple log webhook |
| **BetterStack** | REST | API Key | No oficial | 🔌 HTTP | Uptime + logs HTTP |
| **MCP Servers** | Stdio/HTTP | Varios | SDK MCP | ⭐ NATIVO | UI Studio debe exponer su propio MCP server |
| **Appwrite** | REST | API Key | ✅ appwrite | 📦 SDK | Menos market share, SDK alcanza |
| **Nhost** | GraphQL | JWT | ✅ @nhost/nhost-js | 📦 SDK | Hasura-based, GraphQL vía HTTP |
| **Convex** | SDK (RPC) | JWT | ✅ convex | 📦 SDK | Arquitectura única, SDK alcanza |
| **Lucia Auth** | SDK | DB | ✅ lucia | 🔌 HTTP | Es librería, no servicio |
| **UploadThing** | REST | API Key | ✅ uploadthing | 🔌 HTTP | Wrapper sobre S3, HTTP alcanza |

---

## 14. Prioridades de Implementación

### 🔴 Fase 1 — Core (v0.1 - v0.2)
*Lo mínimo para que UI Studio sea útil y se conecte al mundo real*

| # | Conector | Por qué primero |
|---|----------|----------------|
| 1 | **HTTP Action (genérico)** | Base de todo. Cualquier REST API funciona. Sin esto, UI Studio no conecta con nada. |
| 2 | **Supabase** | BaaS + DB + Auth + Storage + Realtime en un solo conector. La demo killer. |
| 3 | **OpenAI** | Chat LLM es la feature más demandada en 2025-2026. |
| 4 | **Stripe** | Pagos = monetización de apps generadas por UI Studio. |
| 5 | **GitHub (API + Actions)** | "Deploy con un clic" y "Commit changes" son features esperadas. |
| 6 | **Vercel** | Deploy target #1. One-click deploy desde UI Studio. |
| 7 | **PostgreSQL** | DB más demandada del mercado. |

### 🟡 Fase 2 — Expansión (v0.3 - v0.5)
*Cubrir el 80% de casos de uso comunes*

| # | Conector | Por qué |
|---|----------|---------|
| 8 | **Resend** | Email moderno, React Email compatible |
| 9 | **Anthropic (Claude)** | #2 en LLMs, formato distinto a OpenAI |
| 10 | **Cloudflare R2 + Pages** | Edge deployment + storage zero-egress |
| 11 | **MCP Server (UI Studio propio)** | Diferenciador: editar con IA |
| 12 | **MySQL** | DB #2 demanda |
| 13 | **Clerk** | Auth moderna con embeddable components |
| 14 | **NextAuth/Auth.js** | Auth estándar para Next.js apps |
| 15 | **MongoDB** | DB NoSQL #1 |
| 16 | **Netlify** | Deploy target #2 |
| 17 | **Sentry** | Error monitoring estándar |
| 18 | **PostHog** | Analytics + Feature Flags |

### 🟢 Fase 3 — Ecosistema (v0.6 - v1.0+)
*Completitud, cubrir todos los nichos*

| # | Conector | Por qué |
|---|----------|---------|
| 19 | **Twilio SMS** | Canal comunicación |
| 20 | **Firebase** | Demanda legacy/empresarial |
| 21 | **PocketBase** | Self-hosted simple |
| 22 | **PayPal** | Pagos complementario |
| 23 | **Lemon Squeezy** | SaaS indie |
| 24 | **GitLab API + CI** | Ecosistema GitLab |
| 25 | **Google Gemini** | IA Google |
| 26 | **AWS S3** | Storage estándar enterprise |
| 27 | **Google Cloud Storage** | Enterprise GCP |
| 28 | **SendGrid** | Email legacy |
| 29 | **Appwrite** | BaaS alternativo |
| 30 | **Redis** | Cache/Queue |
| 31 | **DynamoDB** | AWS-locked projects |
| 32 | **Convex** | Niche pero innovador |
| 33 | **Nhost** | GraphQL-first |
| 34 | **Paddle** | Pagos global enterprise |
| 35 | **Auth0** | Auth enterprise legacy |
| 36 | **CircleCI / Jenkins** | CI/CD alternativos |
| 37 | **Plausible / Umami** | Analytics simple |
| 38 | **LogSnag / BetterStack** | Monitoring complementario |
| 39 | **Bitbucket API** | Ecosistema Bitbucket |
| 40 | **Railway / Render / Fly.io** | Deploy targets alternativos |

---

## Arquitectura de Conectores Propuesta

```
UI Studio Canvas
       │
       ├── HTTP Action Node (genérico)
       │     └── Cualquier REST API
       │
       ├── Native Connectors (plugins built-in)
       │     ├── Supabase (DB + Auth + Storage + Realtime)
       │     ├── Stripe (Payments + Subs + Webhooks)
       │     ├── OpenAI (Chat + Embeddings + Vision)
       │     ├── Vercel (Deploy)
       │     ├── GitHub (Repo + PR + Actions)
       │     ├── Resend (Email)
       │     ├── Anthropic (Claude Chat)
       │     ├── Clerk (Auth)
       │     ├── Cloudflare (R2 + Pages)
       │     ├── Sentry (Error Monitoring)
       │     └── PostHog (Analytics + Flags)
       │
       ├── DB Connectors (queries + CRUD generation)
       │     ├── PostgreSQL
       │     ├── MySQL
       │     └── MongoDB
       │
       ├── MCP Server (IA puede editar proyectos)
       │     └── projects / components / pages / export / deploy
       │
       └── SDK / Plugin API (conectores comunitarios)
             └── Cualquier desarrollador puede crear su conector
```

---

## Documentación que UI Studio debe tener por conector

Para cada conector nativo, UI Studio necesita:

1. **Guía de configuración:** Cómo obtener API keys, setup inicial
2. **Nodos disponibles:** Qué acciones expone el conector (ej: Stripe → CreateCheckout, CreateSubscription, GetProduct)
3. **Binding de datos:** Cómo conectar salidas de un nodo a entradas de otro
4. **Webhooks:** Cómo recibir eventos del servicio en la app generada
5. **Rate limits:** Límites de API del servicio
6. **Error handling:** Códigos de error comunes, retry strategies
7. **Autenticación:** Cómo se guardan las credenciales (encrypted at rest)
8. **Ejemplos:** 3-5 ejemplos de flujos comunes (ej: "Form → Stripe Checkout → Email confirmación")
9. **Testing:** Cómo probar en sandbox/test mode
10. **Producción:** Checklist de go-live para cada servicio

---

*Documento generado el 20 de mayo de 2026*
*Investigación completa de conectores para UI Studio v1.0*
