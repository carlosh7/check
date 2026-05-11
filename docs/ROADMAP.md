# Roadmap — Check Pro

Plan maestro del proyecto.

---

## ⚡ Estado Actual

| Item | Valor |
|------|-------|
| **Version** | v12.44.751 |
| **Fases 0-4, S, backlog, Ciclos 2-10** | ✅ 100% |
| **Ciclo 11 (9 features)** | ✅ 100% |
| **Infraestructura** | Linux + Portainer + nginx-proxy |
| **URL** | `http://192.168.2.17:3000` |

### Últimos fixes (v12.44.737–751)
- app.js SyntaxError + i18n CSP (v437)
- 3D Planner iframe /editor (v438)
- Cross-Origin-Opener-Policy + Origin-Agent-Cluster (v439)
- 3D Planner React error #185 (v0.28.7)
- Ciclo 11 completo (v742–751)

---

## 🔬 Diagnóstico Técnico (Mayo 2026)

| Área | Hallazgo | Severidad |
|------|----------|-----------|
| **Vulnerabilidades** | `imap@0.8.19` — 4 high (CVE sin fix). Reemplazar con `imapflow` | 🔴 Alta |
| **Vulnerabilidades** | `brace-expansion` moderate, `dompurify` moderate | 🟡 Media |
| **Rendimiento** | Sin caché Redis funcional | 🟡 Media |
| **Rendimiento** | 42 routes → 42+ consultas SQL en dashboard | 🟡 Media |
| **Estabilidad** | Sin tests de carga/estrés | 🟡 Media |
| **Estabilidad** | Sin healthcheck comprehensivo (solo HTTP 200) | 🟢 Baja |
| **Código** | Archivos JS >20K líneas (app.js: 20700) | 🟡 Media |
| **Código** | Sin TypeScript ni tipos estáticos en backend | 🟢 Baja |
| **BD** | Sin migraciones formales (ALTER TABLE ad-hoc) | 🟡 Media |

---

## 🎯 Plan de Mejoras

### Fase 1: Seguridad y Estabilidad (HIGH PRIORITY)

| # | Tarea | Esfuerzo | Impacto |
|---|-------|----------|---------|
| H-01 | Reemplazar `imap` por `imapflow` (4 high vulns) | 2h | 🔴 Elimina riesgos críticos |
| H-02 | Agregar healthcheck endpoint comprehensivo (BD, disco, memoria) | 1h | 🟡 Monitoreo proactivo |
| H-03 | Rate limiting por IP + usuario en todas las rutas | 2h | 🟡 Protección abuso |
| H-04 | Validación de entrada con schema (express-validator) en rutas críticas | 3h | 🟡 Previene inyecciones |
| H-05 | Logging estructurado (request ID, timing, errores) | 2h | 🟡 Debugging eficiente |
| H-06 | Tests de carga (autocannon/k6) para rutas principales | 2h | 🟡 Mide límites reales |

### Fase 2: Rendimiento y Optimización (MEDIUM PRIORITY)

| # | Tarea | Esfuerzo | Impacto |
|---|-------|----------|---------|
| P-01 | Implementar Redis cache real (TTL por ruta, purga automática) | 3h | 🟡 Reduce latencia 10-50x |
| P-02 | Agregar índices compuestos faltantes en consultas frecuentes | 1h | 🟡 Acelera queries |
| P-03 | Lazy loading de módulos frontend (code splitting app.js) | 4h | 🟡 Reduce JS inicial 60% |
| P-04 | Compresión Brotli para assets estáticos (nginx) | 1h | 🟡 Reduce transferencia 20% |
| P-05 | Cacheo de consultas repetitivas (WAL mode, prepared stmts) | 1h | 🟡 BD más rápida |
| P-06 | Implementar WAL mode en SQLite para lecturas concurrentes | 1h | 🟡 Mejora concurrencia |

### Fase 3: Calidad de Código y Tests (MEDIUM PRIORITY)

| # | Tarea | Esfuerzo | Impacto |
|---|-------|----------|---------|
| C-01 | Tests unitarios para todas las rutas API (superagent + jest) | 8h | 🟡 Regresión 0 |
| C-02 | Refactor app.js (20700 líneas) en módulos ES6 | 6h | 🟡 Mantenible |
| C-03 | ESLint + Prettier + husky config | 1h | 🟢 Consistencia |
| C-04 | Migraciones BD formales (evitar ALTER TABLE ad-hoc) | 3h | 🟡 Integridad |
| C-05 | Error handling consistente (middleware centralizado) | 2h | 🟡 Robustez |
| C-06 | Logs de auditoría para todas las operaciones críticas | 2h | 🟡 Compliance |

### Fase 4: Expansión y Features Futuros (LOW PRIORITY)

| # | Tarea | Esfuerzo | Impacto |
|---|-------|----------|---------|
| F-01 | WebSocket para tiempo real (check-in, polls, notificaciones) | 4h | 🟡 UX en vivo |
| F-02 | Dashboard con métricas reales (invitados, check-in, polls) | 3h | 🟡 Visibilidad |
| F-03 | Exportación avanzada (CSV, Excel, PDF con filtros) | 2h | 🟡 Reporting |
| F-04 | Multi-tenant completo con aislamiento por organización | 6h | 🟡 Escalabilidad |
| F-05 | API pública documentada (OpenAPI/Swagger) | 4h | 🟡 Integraciones |
| F-06 | CI/CD pipeline (GitHub Actions → Docker → Portainer) | 3h | 🟡 Deploy automático |

---

## 📊 Tablero de Progreso Acumulado

| Hito | Estado | Versión |
|------|--------|---------|
| Fases 0-4 + backlog | ✅ | v12.44.678 |
| Ciclos 2-10 (seguridad, refinamiento) | ✅ | v12.44.736 |
| C11-01 Gamificación / Live Polling | ✅ | v12.44.742 |
| C11-02 Badge printing (Zebra/ESC/POS) | ✅ | v12.44.743 |
| C11-03 Kiosko auto-check-in | ✅ | v12.44.744 |
| C11-04 Networking scoring | ✅ | v12.44.746 |
| C11-05 Seating chart (3D Planner) | ✅ | v12.44.738 |
| C11-06 Constructor landing pages | ✅ | v12.44.748 |
| C11-07 Álbum de fotos compartido | ✅ | v12.44.747 |
| C11-08 Certificados automáticos | ✅ | v12.44.745 |
| C11-09 Plugin marketplace | ✅ | v12.44.749 |

---

## 📋 Pendientes Post-Ciclo 11

- [ ] H-01: Reemplazar `imap@0.8.19` → `imapflow` (4 high vulns)
- [ ] H-02: Healthcheck endpoint comprehensivo
- [ ] H-06: Tests de carga (k6/autocannon)
- [ ] P-01: Redis cache (no funcional actualmente)
- [ ] P-03: Code splitting frontend (app.js 20K líneas)
- [ ] C-02: Refactor app.js en módulos
- [ ] C-04: Migraciones BD formales
- [ ] F-06: CI/CD pipeline

---

## 📚 Documentación Referenciada

| Archivo | Propósito |
|---------|-----------|
| `docs/repos-analysis.md` | Análisis competitivo vs SaaS |
| `docs/features/gamificacion-plan.md` | Plan detallado de Gamificación |
| `docs/ARQUITECTURA_SISTEMA.md` | Arquitectura del sistema |
| `docs/SECURITY_IA.md` | Postura de seguridad IA |
| `docs/ESTRUCTURA_UI_CHECK_PRO.md` | Estructura del frontend |
