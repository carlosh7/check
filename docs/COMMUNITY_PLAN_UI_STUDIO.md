# UI Studio — Plan de Comunidad Open Source

> **Proyecto:** UI Studio — Visual App Builder Universal  
> **Estado:** Desde 0 (pre-lanzamiento)  
> **Inspiración:** n8n, Appsmith, Supabase, Directus, Budibase  
> **Versión del plan:** 1.0

---

## Tabla de Contenidos

1. [GitHub Setup](#1-github-setup)
2. [Communication Channels](#2-communication-channels)
3. [Governance Model](#3-governance-model)
4. [Release Strategy](#4-release-strategy)
5. [Contributor Experience](#5-contributor-experience)
6. [Community Growth](#6-community-growth)
7. [Metrics & Success Indicators](#7-metrics--success-indicators)
8. [Sustainability](#8-sustainability)

---

## 1. GitHub Setup

### 1.1 README.md — Estructura

```
┌──────────────────────────────────────────────┐
│  LOGO + Badges (build, license, discord,     │
│  stars, PRs welcome, semver)                 │
├──────────────────────────────────────────────┤
│  "Build apps visually. Ship code natively."  │
│  One-liner + screenshot/GIF animado          │
├──────────────────────────────────────────────┤
│  ✨ Features (bullet points, icon each)      │
│  🚀 Quick Start (1-2 comandos)              │
│  🖼️ Screenshots / Demo video link           │
│  📖 Documentation link                       │
│  🏗️ Architecture (diagrama simple)          │
│  🤝 Contributing + Code of Conduct           │
│  💬 Community (Discord, Twitter, etc)        │
│  ⭐ Star history (badge)                     │
│  📄 License                                  │
└──────────────────────────────────────────────┘
```

**Reglas del README:**
- Primer bloque debe ser entendible en 5 segundos
- Screenshot/GIF ANTES del "How to install"
- Enlaces directos a: Docs, Discord, Contributing, Good First Issues
- Badges de: build status, coverage, discord, stars, license, PRs welcome

### 1.2 Issue Templates

#### Bug Report
```markdown
---
name: Bug report
about: Create a report to help us improve
title: '[BUG] '
labels: bug, triage
---

**Describe the bug**
A clear and concise description.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Expected behavior**
What should happen.

**Screenshots / Video**
If applicable.

**Environment (please complete):**
- OS: [e.g. Ubuntu 22.04]
- Browser: [e.g. Chrome 120]
- UI Studio version: [e.g. 0.1.0]
- Node version: [e.g. 20.x]
- Database: [e.g. SQLite, PostgreSQL]

**Additional context**
```

#### Feature Request
```markdown
---
name: Feature request
about: Suggest an idea for this project
title: '[FEATURE] '
labels: enhancement, needs-discussion
---

**Is your feature request related to a problem?**
A clear and concise description.

**Describe the solution you'd like**
What you want to happen.

**Describe alternatives you've considered**
Other approaches.

**Use case**
Why is this important? Who benefits?

**Would you be willing to contribute this?**
[ ] Yes, I can submit a PR
[ ] No, I'd like someone else to do it
```

#### Question / Support
```markdown
---
name: Question / Support
about: Ask a question about using UI Studio
title: '[QUESTION] '
labels: question
---

**What are you trying to achieve?**
Context first.

**What have you tried?**
Steps you've already taken.

**Environment**
OS, version, browser, etc.
```

### 1.3 Pull Request Template

```markdown
## Description

Please include a summary of the change and which issue is fixed.

Fixes #(issue)

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update
- [ ] Refactor / Performance

## How Has This Been Tested?

- [ ] Unit tests
- [ ] Integration tests
- [ ] Manual testing in browser

## Checklist:

- [ ] My code follows the project style
- [ ] I have linted and formatted my code
- [ ] I have added tests that prove my fix/feature works
- [ ] New and existing tests pass
- [ ] I have updated the documentation
- [ ] I have added a changeset (`npx changeset`)

## Screenshots (if applicable):

## Additional context:
```

### 1.4 CONTRIBUTING.md — Estructura

```markdown
# Contributing to UI Studio

## Welcome!
Thank you for considering contributing. This guide will help you get started.

## Table of Contents
- Code of Conduct
- What we're building (vision)
- How to contribute (tldr)
  - 🐛 Found a bug? → Open issue
  - 💡 Have an idea? → Discussion first
  - 👷 Want to code? → Good First Issues
  - 📖 Docs? → docs/ folder
  - 🌐 Translations? → i18n guide
- Development setup
  - Prerequisites (Node 20+, pnpm, Docker)
  - Clone + install + run
  - Environment variables
  - Database setup
- Project architecture
  - Monorepo structure (apps/, packages/)
  - Key folders explained
- Coding conventions
  - TypeScript strict mode
  - ESLint + Prettier
  - Naming conventions
  - Component patterns
- Testing guidelines
  - Unit: vitest
  - E2E: Playwright
  - When to write tests
- PR workflow
  - Branch naming: `feat/`, `fix/`, `docs/`, `chore/`
  - Conventional commits
  - Changeset workflow
  - Review process
- Where to ask for help
  - Discord #contributors
  - GitHub Discussions
- Recognition
  - All-contributors bot
  - Contributors page
```

### 1.5 Code of Conduct

Adoptar **Contributor Covenant 2.1** (traducido al español). Incluir:

- Nuestro compromiso
- Estándares (comportamiento esperado e inaceptable)
- Responsabilidades de mantenimiento
- Alcance (aplica en GitHub, Discord, eventos)
- Procedimiento de reporte: **conduct@uistudio.dev** (email real, no un alias genérico)
- Equipo de respuesta: 3 personas mínimo, máximo 7 días para resolver

### 1.6 Security Policy

```markdown
# Security Policy

## Supported Versions
- Latest stable release
- Previous minor (for 30 days after new release)

## Reporting a Vulnerability
**DO NOT** open a public issue.

Email: security@uistudio.dev
PGP Key: [link]
Expected response: 48 hours
```

### 1.7 Support Guide (`SUPPORT.md`)

```markdown
# Support

## Community (free)
- 📖 Documentation: docs.uistudio.dev
- 💬 Discord: #help channel
- 💡 GitHub Discussions: Q&A category
- 🔍 Stack Overflow: tag `uistudio`

## Professional (paid)
- Email support (SLA: 4h)
- Dedicated Slack channel
- Priority bug fixes
- Custom feature development
```

### 1.8 Labels Scheme

**Tipo (color: blue)**
- `bug` — algo no funciona
- `enhancement` — nueva feature
- `documentation` — docs
- `refactor` — mejora interna
- `tests` — testing
- `dependencies` — upgrades de dependencias
- `chore` — tareas de mantenimiento

**Prioridad (color: red/orange)**
- `priority: critical` — bloqueante, urgente
- `priority: high` — debe estar en el próximo release
- `priority: medium` — importante pero no urgente
- `priority: low` — nice to have

**Estado (color: purple)**
- `triage` — necesita revisión
- `needs-discussion` — requiere consenso
- `needs-reproduction` — bug no confirmado
- `blocked` — depende de otra cosa
- `duplicate` — ya reportado
- `wontfix` — no se va a implementar

**Contribución (color: green)**
- `good first issue` — para nuevos contribuidores
- `help wanted` — el equipo no puede abordarlo ahora
- `hacktoberfest` — para eventos

**Plataforma (color: gray)**
- `backend` — server-side
- `frontend` — UI/UX
- `database` — esquemas, migraciones
- `deployment` — Docker, cloud

### 1.9 Milestones Scheme

| Milestone | Plazo | Tipo | Contenido típico |
|-----------|-------|------|-------------------|
| v0.1.0 — MVP | Mes 1-2 | Release | Canvas básico, drag & drop de 3 componentes, export HTML |
| v0.2.0 — Core | Mes 2-3 | Release | Estados, variables, conexión a API REST |
| v0.3.0 — UX | Mes 3-4 | Release | Temas, responsividad, plugins |
| v0.4.0 — Data | Mes 4-5 | Release | CRUD, autenticación, bases de datos |
| v0.5.0 — Beta | Mes 5-6 | Release | E2E tests, documentación, estabilidad |
| v1.0.0 — Stable | Mes 6-8 | Release | Producción-ready, plugins externos, 10+ componentes |
| Backlog | — | Forever | Todo lo demás |

*Nota: milestones por tiempo, no por features. Si una feature no está lista, se mueve al siguiente milestone.*

---

## 2. Communication Channels

### 2.1 Decisión: Discord ✅

| Canal | Razón |
|-------|-------|
| **Discord** | Mejor para comunidad técnica en tiempo real, gratuito, ampliamente adoptado en OSS |
| **GitHub Discussions** | Para features asíncronos y Q&A persistentes (se integra con issues) |
| ~~Slack~~ | ❌ No. Caro, menos abierto, menos discoverability |

**Estrategia híbrida:**
- **Discord** para chat en vivo, soporte rápido, contribuidores activos
- **GitHub Discussions** para propuestas de features, Q&A, anuncios (indexable por Google)
- Ambos sirven públicos distintos y se complementan

### 2.2 Estructura de Discord

```
📢 ANNOUNCEMENTS
  #welcome — reglas, roles, enlaces útiles
  #announcements — releases, eventos, solo admins escriben
  #roadmap — cambios al roadmap, discusión pública pero controlada

💬 GENERAL
  #general — charla libre sobre UI Studio
  #showcase — builds hechos con UI Studio
  #feedback — ideas y críticas constructivas
  #random — off-topic

🆘 SUPPORT
  #help — preguntas de uso (los mantenedores responden aquí)
  #troubleshooting — bugs conocidos, workarounds
  #share-knowledge — tips, tutoriales, trucos

🧑‍💻 CONTRIBUTORS
  #contributors — discusión sobre PRs, issues, desarrollo
  #code-reviews — pedidos de review
  #design — discusión de UI/UX del producto
  #docs — documentación
  #translations — i18n

🔧 INTERNAL (solo maintainers)
  #moderation — incidencias de moderación
  #security — reportes de seguridad
  #maintainers — coordinación del equipo
```

**Roles:**
- `@everyone` — todos
- `@Contributor` — alguien con PR merged
- `@Maintainer` — equipo core
- `@Moderator` — ayuda en moderación
- `@Alpha Tester` — acceso temprano a builds
- `@VIP` — contribuidores destacados

### 2.3 Moderation Guidelines

1. **Sé respetuoso** — No toleramos discriminación, acoso, spam
2. **Auto-suficiencia** — Lee docs/pinned antes de preguntar
3. **No cross-post** — Un tema, un canal
4. **No promociones** — Sin autopromoción sin permiso
5. **No +1** — Usa emoji reactions, no mensajes de "same"
6. **Reporta, no respondas** — Ante una violación, reporta a moderadores

**Enforcement:**
1. Advertencia privada (DM)
2. Mute temporal (1h → 24h → 7d)
3. Kick / Ban (solo para reincidencia o violación grave)

### 2.4 FAQ Section (para #welcome y README)

**P: ¿Qué es UI Studio?**  
R: Un visual app builder universal. Diseña interfaces arrastrando componentes, conecta datos de cualquier fuente, y exporta código limpio.

**P: ¿Es gratis?**  
R: Sí, 100% open source (MIT). Ofrecemos una versión cloud con hosting para quienes no quieren auto-hostear.

**P: ¿Qué tecnologías usa?**  
R: Frontend en React/Next.js + Tailwind, backend en Node.js + TypeScript, base de datos PostgreSQL. Los builds generan React puro.

**P: ¿Cómo puedo contribuir sin saber código?**  
R: Docs, traducciones, diseño, testing, examples, responder preguntas en Discord.

**P: ¿Tienen hoja de ruta?**  
R: Sí, pública en docs/ROADMAP.md

**P: ¿Puedo usarlo en producción?**  
R: Recomendamos esperar a v1.0.0. v0.x es para experimentar.

**P: ¿Cómo reporto un bug de seguridad?**  
R: security@uistudio.dev — nunca en issues públicos.

---

## 3. Governance Model

### 3.1 Modelo: BDFL + Meritocracia Híbrido

**Fase 1 (0-12 meses): BDFL**
- Fundador tiene voto final en decisiones técnicas
- Pero delega día a día a maintainers
- Decisión: ¿rompemos BC? ¿cambiamos dirección del producto? → fundador decide

**Fase 2 (12+ meses): Transición a Meritocracia**
- Se forma un TSC (Technical Steering Committee) de 3-5 personas
- Decisiones por consenso, voto si es necesario (mayoría simple)
- Fundador sigue siendo "Presidente" con veto solo en temas de visión

Este es el modelo que usó Supabase (Paul Copplestone como BDFL inicial) y Node.js (transición a fundación). Evita la parálisis inicial de una meritocracia pura, pero da gobernanza real cuando el proyecto escala.

### 3.2 Roles

| Rol | Requisitos | Privilegios | Responsabilidades |
|-----|-----------|-------------|-------------------|
| **Community Member** | Tener cuenta en Discord/GitHub | Acceder a Discord, abrir issues, comentar | Seguir CoC, ayudar a otros |
| **Contributor** | 1+ PR merged | Role en Discord, listado en web contributors | Enviar PRs de calidad, participar en reviews |
| **Active Contributor** | 5+ PRs en 3 meses | + Menciones en release notes, + early access | Mentoría a nuevos, mantener áreas del código |
| **Maintainer** | Invitación del TSC/fundador | + Push directo, + voto en TSC, + acceso a Discord interno | Review PRs, triage issues, guiar contribuidores |
| **TSC Member** | 6+ meses como Maintainer, voto del TSC | + Decisión en roadmap, + veto en breaking changes | Gobernanza, estrategia técnica |
| **BDFL / Founder** | Fundador original | Veto en visión y dirección general | Visión del producto, relaciones públicas, recaudación |

### 3.3 Decision-Making Process

**Flujo para decisiones técnicas:**

```
Issue/Discusión abierta (5 días mínimo)
    ↓
Los maintainers discuten (Discord #maintainers o GitHub)
    ↓
¿Hay consenso?
    ├── Sí → Se ejecuta
    └── No → Votación (TSC + Maintainers)
              - 1 semana de votación
              - Mayoría simple gana
              - BDFL puede vetar (solo temas de visión)
```

**Decisiones que requieren votación:**
- Breaking changes en API pública
- Nuevas dependencias core
- Cambios en licencia
- Admisión de nuevos maintainers
- Roadmap mayor

**Decisiones que NO requieren votación:**
- Bug fixes
- Refactors internos
- Documentación
- CI/CD cambios
- Dependencias menores

### 3.4 Voting

- **Quórum:** 50% + 1 de TSC + Maintainers
- **Duración:** 7 días
- **Voto:** +1 (apruebo), 0 (neutral), -1 (rechazo con razón)
- **Veto:** Solo fundador, solo en visión/misión, con explicación pública

---

## 4. Release Strategy

### 4.1 Semantic Versioning (Semver)

**Formato:** `MAJOR.MINOR.PATCH`

| Componente | Qué cambia | Ejemplo |
|------------|-----------|---------|
| MAJOR | Breaking changes en API, componentes, export | `v1.0.0` → `v2.0.0` |
| MINOR | Nuevas features sin breaking changes | `v1.0.0` → `v1.1.0` |
| PATCH | Bug fixes, rendimiento, seguridad | `v1.0.0` → `v1.0.1` |

**Pre-release tags:** `v1.0.0-beta.1`, `v1.0.0-rc.1`

### 4.2 Release Cadence

| Canal | Cadencia | Propósito |
|-------|----------|-----------|
| **Nightly** | Cada merge a main | Testing automático, preview |
| **Beta** | Cada 2 semanas | Features estables para early adopters |
| **Stable** | Cada 4-6 semanas | Release oficial para todos |
| **LTS** | Cada MAJOR | Solo security patches por 12 meses |

**Modelo elegido:** **Time-based con feature gates**.  
Cada 4 semanas sale un release estable. Si una feature no está lista, se desactiva con feature flag y sale en el siguiente. n8n usa este modelo y funciona.

### 4.3 Changelog — Formato (Keep a Changelog)

```markdown
# Changelog

## [0.4.0] - 2025-06-15

### Added
- New component: DataTable with sorting and filtering (#234)
- Dark mode support (#210)
- REST API connector (#198)

### Changed
- Performance: canvas renders 3x faster (#220)
- Upgrade to React 19 (#215)

### Fixed
- Drag & drop glitch in Safari (#205)
- Export not preserving font styles (#199)

### Deprecated
- Legacy connector API. Use `connect()` instead.

### Security
- Updated `axios` to 1.7.0 (CVE-2025-1234)

### Contributors
- @newcontributor for #234
- @veteran for #210 and #220
```

**Herramienta:** `changesets` — cada PR que toca una feature pública debe incluir un changeset. Al hacer release, se agrupan.

### 4.4 Release Notes Process

1. **Branch:** `release/v{X.Y.Z}` desde `main`
2. **Changesets:** Se consolidan automáticamente (CI)
3. **QA:** Tests E2E completos en la release branch
4. **Release candidate:** `v{X.Y.Z}-rc.1`, pruebas de 48h
5. **Tag + GitHub Release:** Notas generadas desde changesets
6. **Publish:** npm, Docker Hub
7. **Announce:** Discord #announcements + Twitter + Blog post
8. **Merge back:** `release/v{X.Y.Z}` → `main`

### 4.5 LTS vs Nightly vs Stable

| Canal | Usuario objetivo | Updates | Soporte |
|-------|-----------------|---------|---------|
| **Nightly** | Contributors, early adopters | Diario | Ninguno |
| **Beta** | Testers enthusiasts | Quincenal | Issues bienvenidos |
| **Stable** | Todos | Mensual | Critical bugs se backportean |
| **LTS** | Enterprise, producción | Solo security | 12 meses desde release |

---

## 5. Contributor Experience

### 5.1 Good First Issues — Curaduría

**Requisitos para un GFI:**
1. Problema bien definido y acotado (no más de 2-3 archivos)
2. Pasos de reproducción o especificación clara
3. Enlace a la sección del código relevante
4. Estimación de tiempo ("esto toma ~2-4 horas")
5. Mentor asignado (persona real que responde en <24h)

**Ejemplo de GFI bien escrito:**
> **good first issue:** Add focus ring to Button component
> 
> **Files:** `packages/ui/src/Button.tsx`, `packages/ui/src/Button.test.tsx`
> **Time estimate:** 1-2 hours
> **Mentor:** @johndoe
> 
> The Button component currently doesn't show a visible focus ring when tabbed to. Add `outline: 2px solid blue` on `:focus-visible`.
> 
> **How to test:** Tab through the demo page. You should see a blue ring on focused buttons.

### 5.2 Onboarding Process

**Día 1 — El contribuidor llega:**
1. README → "Getting Started" en 2 comandos
2. CONTRIBUTING.md → setup completo
3. Discord #welcome → role automático

**Primer issue:**
1. Asignación manual (el mentor asigna)
2. Mentor guía en el PR
3. Review rápida (<72h objetivo)
4. ¡PR merged! → role @Contributor + mención en release notes

**Primera semana:**
1. Invitación a reunión semanal de contributors (opcional)
2. Onboarding call de 30 min con un maintainer (opcional)
3. Acceso al canal #contributors

### 5.3 Mentor Program

**Estructura:**
- Cada GFI tiene un mentor asignado (maintainer o active contributor)
- El mentor hace review del PR en <48h
- Mentor ofrece pair programming session si el contribuidor lo pide
- Después de 3 PRs, el contribuidor puede mentorizar a otros

**Incentivos para mentores:**
- Badge en perfil de Discord
- Mención en release notes
- Prioridad en swag
- Reconocimiento público trimestral

### 5.4 Recognition

**All-Contributors Bot:**
```
@all-contributors please add @username for code, doc, design
```

**Categorías:** code, doc, design, translation, bug, review, test, talk, financial, infrastructure, maintenance, mentoring

**Contributors Page** (en la web del proyecto):
- Grid de todos los contribuidores con avatar y contribuciones
- Ordenados por: commits, impacto, diversidad de tipos
- Los top contribuidores tienen destacado especial

**Release Notes:**
```
### Contributors
- @alice for the DataTable component
- @bob for fixing the drag & drop issue
- @carol for improving the docs
```

### 5.5 Swag / Stickers (Futuro)

**Fase 1 (0-6 meses):** Stickers digitales, badges en Discord
**Fase 2 (6-12 meses):** Stickers físicos y stickers packs (enviar a top 10 contribuidores)
**Fase 3 (12+ meses):** Camisetas, tazas. Gratis para contribuidores con 5+ PRs. Venta al público para financiar.

---

## 6. Community Growth

### 6.1 Launch Strategy

**Semana 0 — Pre-lanzamiento:**
- Landing page con waitlist (para medir interés)
- Twitter/X account: @uistudio
- Discord server abierto (50 personas mínimo antes del launch)
- Blog post técnico: "Building a visual app builder from scratch" (Dev.to, Medium)

**Semana 1 — Launch:**
| Canal | Acción | Timing |
|-------|--------|--------|
| **Product Hunt** | Launch con pre-subscribers, comentarios preparados | Lunes 00:01 PT |
| **Hacker News** | Post tipo "Show HN: UI Studio – Open-source visual app builder" | Martes |
| **Reddit r/javascript** | Cross-post con detalles técnicos | Miércoles |
| **Twitter/X** | Thread con GIFs del producto | Lunes (simultáneo PH) |
| **Dev.to** | Tutorial: "Build your first app with UI Studio in 5 minutes" | Jueves |
| **YouTube** | Video de 3-5 min mostrando el producto | Viernes |

**Estrategia PH:**
- Preparar 10-15 comentarios de apoyo de early users (reales, no ficticios)
- Maker video (el fundador explica el producto en 30s)
- Ofrecer "PH Launch discount" en cloud hosting (si aplica)
- Tener al menos 3 features que sorprendan

**Show HN:**
- Título descriptivo, no clickbait
- Primer comentario del fundador explicando el "why"
- Responder a TODOS los comentarios en las primeras 6h

### 6.2 Content Marketing

**Cadencia de contenido:**

| Tipo | Frecuencia | Canal |
|------|-----------|-------|
| Blog post: tutorial | Semanal | Blog + Dev.to + Medium |
| Blog post: técnico / arquitectura | Quincenal | Blog + HN |
| Video: feature demo | Quincenal | YouTube + Twitter |
| Video: tutorial building algo real | Mensual | YouTube |
| Thread de Twitter con tips | 2-3/semana | Twitter/X |
| Newsletter | Mensual | Email + Discord |

**Temas iniciales (primeros 2 meses):**
1. "How UI Studio works under the hood" (arquitectura)
2. "Build a dashboard in 10 minutes with UI Studio"
3. "UI Studio vs Retool vs Appsmith: which one for your team?"
4. "From visual builder to production: deploying UI Studio apps"
5. "Creating custom components for UI Studio"
6. "Why we chose React + Tailwind for UI Studio"

### 6.3 Social Media Presence

| Plataforma | Estrategia |
|-----------|-----------|
| **Twitter/X** | Canal principal. El fundador tuitea en vivo el desarrollo. Threads semanales. GIFs de features. |
| **LinkedIn** | Contenido más formal: casos de uso empresarial, comparativas, releases. 1-2 post/semana. |
| **YouTube** | Tutoriales, demos, vlogs del desarrollo. Calidad sobre cantidad (1 video/semana bien editado). |
| **Dev.to** | Cross-post del blog. Comunidad técnica muy activa y receptiva a OSS. |
| **Reddit** | Solo contribuciones genuinas en r/javascript, r/webdev, r/selfhosted. NUNCA spam. |

**Regla de oro:** 80% contenido de valor / 20% autopromoción.

### 6.4 Community Events

**Virtuales (desde el día 1):**
- **Weekly contributor sync:** 30 min, Google Meet, todos los viernes. Abierto.
- **Monthly community call:** Demo de features, Q&A, showcase de builds comunitarios.
- **Hackathons:** Cada 3 meses. "Build something cool with UI Studio". Premios: swag, cloud credits, feature requests priorizadas.

**Presenciales (fase 2, 12+ meses):**
- Meetups locales organizados por la comunidad (guide para organizar)
- Presencia en conferencias (React Conf, JSConf, OSS Summit)

### 6.5 Partnerships with Other OSS Projects

**Estrategia de integraciones:**
- **n8n** → UI Studio apps pueden disparar workflows de n8n
- **Supabase** → UI Studio como frontend visual para Supabase
- **Directus** → UI Studio como frontend para Directus CMS
- **MinIO** → almacenamiento de assets
- **Clerk / NextAuth** → autenticación plug-and-play

**Beneficio mutuo:** Cada integración = cross-promotion en ambas comunidades. Ejemplo: Supabase menciona UI Studio en su blog como "visual frontend builder recomendado".

---

## 7. Metrics & Success Indicators

### 7.1 Dashboard de Métricas

| Métrica | Gol S1 (3 meses) | Gol S2 (6 meses) | Gol Y1 (12 meses) | Herramienta |
|---------|-----------------|-----------------|-------------------|-------------|
| GitHub Stars | 1,000 | 5,000 | 15,000 | Star History |
| GitHub Forks | 100 | 500 | 1,500 | — |
| Contributors (total) | 25 | 100 | 300 | All-contributors |
| Active Contributors (3+ PRs/mes) | 5 | 20 | 50 | GitHub Insights |
| Discord Members | 500 | 2,000 | 8,000 | Discord Analytics |
| npm Downloads/mes | 1,000 | 10,000 | 100,000 | npm stats |
| Docker Pulls/mes | 500 | 5,000 | 50,000 | Docker Hub |
| Issues Opened/Closed ratio | 1:1 | 1.5:1 | 2:1 | GitHub |
| PR Merge Time (p50) | <48h | <24h | <12h | GitHub Insights |
| Issue Resolution Time (p50) | <7d | <3d | <48h | Linear / GitHub |
| Documentation Coverage | 40% | 70% | 90% | Custom check |
| Page Views (docs.uistudio.dev) | 5k/mes | 50k/mes | 500k/mes | Plausible / Fathom |

### 7.2 Health Metrics (Cualitativas)

- **Contributor retention:** cuántos vuelven después del primer PR (target: >30%)
- **Time to first PR:** desde que alguien llega hasta que envía su primer PR (target: <7 días)
- **First response time:** tiempo hasta que un maintainer responde un issue (target: <4h en horario laboral)
- **Bus factor:** cuántas personas pueden hacer cada tarea crítica (target: mínimo 2 para cada área)
- **Net Promoter Score (NPS):** encuesta trimestral a la comunidad (target: >40)

### 7.3 OKRs Trimestrales

**Q1 Ejemplo (0-3 meses):**
- **KR1:** 1,000 GitHub stars
- **KR2:** 25 contributors with merged PRs
- **KR3:** 500 Discord members
- **KR4:** Average PR merge time < 72h
- **KR5:** 3 blog posts published, 1 video tutorial

---

## 8. Sustainability

### 8.1 Modelo de Ingresos

```
┌─────────────────────────────────────────────┐
│            UI Studio Revenue Model           │
├─────────────────────────────────────────────┤
│  Open Source (MIT)                           │
│  → Gratis para siempre                       │
│  → Self-hosted, no limitaciones              │
├─────────────────────────────────────────────┤
│  Open Collective / GitHub Sponsors           │
│  → Donaciones de individuos y empresas       │
│  → Transparente, público                     │
├─────────────────────────────────────────────┤
│  UI Studio Cloud (SaaS)                      │
│  → Hosted version (no hay que self-hostear)  │
│  → Free tier + paid tiers                    │
├─────────────────────────────────────────────┤
│  Enterprise                                  │
│  → SSO / SAML                                │
│  → SLA (99.9% uptime)                       │
│  → On-premise option                         │
│  → Custom branding                           │
├─────────────────────────────────────────────┤
│  Services                                    │
│  → Consulting (custom components)            │
│  → Training (workshops for teams)            │
│  → Custom development                        │
└─────────────────────────────────────────────┘
```

### 8.2 Tiers de Sponsorship (GitHub Sponsors / Open Collective)

**Individual:**
| Tier | Precio | Beneficios |
|------|--------|------------|
| 🐣 Supporter | $5/mes | Badge en Discord |
| 🐱 Cat | $10/mes | + Nombre en README |
| 🦊 Fox | $25/mes | + Access a #vip en Discord |

**Team / Corporate:**
| Tier | Precio | Beneficios |
|------|--------|------------|
| 🏢 Bronze | $100/mes | Logo en README (pequeño) |
| 🏢 Silver | $500/mes | Logo en web + mención en release notes |
| 🏢 Gold | $2,000/mes | + Priority feature requests + consulting hours |
| 🏢 Platinum | $5,000/mes | + Custom integration support + SLA |

### 8.3 UI Studio Cloud — Pricing

| Tier | Price | Apps | Users | Storage | Extra |
|------|-------|------|-------|---------|-------|
| **Free** | $0 | 3 | 2 | 100 MB | Community support |
| **Pro** | $29/mes | 20 | 10 | 5 GB | Email support |
| **Team** | $99/mes | Unlimited | 50 | 25 GB | Priority support |
| **Enterprise** | Custom | Unlimited | Unlimited | Custom | SSO, SLA, on-prem |

*Nota: Self-hosted siempre es gratis y sin limitaciones. El cloud es conveniencia, no extorsión.*

### 8.4 License: MIT ✅

**Por qué MIT:**
- Apache 2.0 es incompatible con GPLv2 (proyectos embedded)
- GPL ahuyenta contribuciones empresariales (legal teams dicen no)
- MIT es la licencia más adoptada en OSS tooling (React, Node, Express, jQuery)
- Permite que empresas adopten sin fricción legal
- Permite que UI Studio Cloud use el mismo código sin conflictos (open core)

**Excepción:** Componentes premium (enterprise-only) pueden ser bajo licencia adicional (Commercial License), pero el core es y será siempre MIT.

### 8.5 Costos Estimados (Mensuales Fase 1)

| Concepto | Costo | Nota |
|---------|-------|------|
| Servers (cloud dev/staging) | $50-100 | DigitalOcean / Hetzner |
| Dominio + DNS | $15 | uistudio.dev + docs.uistudio.dev |
| Discord Boost | $10 | Para calidad de audio/video |
| GitHub Sponsors fees | ~5% | Comisión de transacción |
| CI/CD (GitHub Actions) | $0 | Gratis en OSS |
| Email (sendgrid/resend) | $0-20 | Free tier suficiente |
| **Total** | **~$80-150/mes** | |

---

## Apéndices

### A. Checklist de Pre-Lanzamiento

- [ ] README.md completo con badges, GIF, quick start
- [ ] CONTRIBUTING.md
- [ ] CODE_OF_CONDUCT.md (Contributor Covenant)
- [ ] SECURITY.md
- [ ] SUPPORT.md
- [ ] Issue templates (3)
- [ ] PR template
- [ ] Labels creadas en GitHub
- [ ] Milestones creados (v0.1.0 → v1.0.0)
- [ ] Discord server configurado con roles y canales
- [ ] GitHub Discussions habilitado
- [ ] Twitter/X account: @uistudio
- [ ] Blog (blog.uistudio.dev o Substack)
- [ ] YouTube channel
- [ ] Product Hunt page preparada
- [ ] Landing page (uistudio.dev)
- [ ] docs.uistudio.dev (VitePress / Docusaurus)
- [ ] Open Collective / GitHub Sponsors configurado
- [ ] 3 Good First Issues listos
- [ ] 5 early users confirmados para comentar en PH
- [ ] CI/CD configurado (tests + lint + build)
- [ ] Codecov / Coveralls configurado
- [ ] npm package name reservado: `uistudio`

### B. Plantilla de Tweet de Lanzamiento

```
🚀 UI Studio is now open source!

Build apps visually. Drag, drop, connect.
Export clean React code.

🆓 MIT licensed
🧩 Extensible
🌐 Self-host or cloud

→ uistudio.dev
#opensource #webdev #uistudio
```

### C. Referencias

- n8n — community playbook, release strategy, contributor experience
- Appsmith — GitHub setup, issue templates, labels
- Supabase — governance (BDFL → meritocracy), growth strategy, sponsorships
- Directus — licensing model (MIT + cloud)
- Budibase — contributor onboarding, good first issues
- Astro — content marketing, community events, YouTube strategy
- Cal.com — open source business model, enterprise tiers
