# MARCO NORMATIVO APLICABLE — "Check Pro" (SaaS colombiano de gestión de eventos y boletería)

**Documento de referencia legal — Equipo Legal de Investigación**
**Fecha de corte:** 23 de septiembre de 2026 · **Jurisdicción principal:** Colombia · **Proyección:** LATAM
**Estado:** Investigado con verificación web de reformas recientes. Los puntos que no se pudieron confirmar en fuente primaria están marcados como **POR CONFIRMAR** y NO deben tratarse como hechos.

> ⚠️ **Aviso:** este documento es material de trabajo técnico-legal elaborado por el equipo de investigación del proyecto. NO constituye asesoría legal profesional. Antes de decisiones de alto impacto (multas, contratos, inscripción RNBD), validar con abogado colegiado en Colombia.

---

## 1. COLOMBIA (detalle alto)

### 1.1 Ley Estatutaria 1581 de 2012 — régimen general de protección de datos personales

Es la columna vertebral del habeas data colombiano, de carácter **estatutario** (desarrolla el art. 15 de la Constitución; su trámite y reforma exigen mayorías agravadas). Texto oficial: [Secretaría del Senado](https://www.secretariasenado.gov.co/senado/basedoc/ley_1581_2012.html) y [Gestor Normativo de Función Pública](https://www.funcionpublica.gov.co).

Conceptos clave para Check Pro:

- **Roles.** En la plataforma conviven los tres roles:
  - **Titular:** el asistente al evento, el staff, el organizador.
  - **Responsable del tratamiento:** quien decide la finalidad y el tratamiento. **Check Pro es responsable de las bases de datos de usuarios de la plataforma, staff y auditoría**, y a su vez opera como tratamiento por cuenta de terceros para los datos de asistentes que gestionan sus clientes organizadores (en ese caso Check Pro puede actuar como **encargado** del organizador). Recomendación: formalizar esta doble condición en los Términos y Condiciones y, con organizadores, firmar un **contrato de tratamiento de datos por encargo** (obligación del art. 18 de la Ley).
  - **Encargado del tratamiento:** quien procesa datos por cuenta del responsable (hosting, pasarelas, proveedores de email/SMS).
- **Deberes del responsable (art. 17):** solicitar autorización, informar de forma expresa y clara, informar sobre el carácter facultativo de las respuestas, cumplir instrucciones del titular, facilitar derechos (acceso, actualización, rectificación y supresión — "ARCO"), velar por la seguridad de la información, **actualizar información**, tramitar consultas y reclamos en plazos legales (consultas: 10 días hábiles; reclamos: 15 días hábiles, prorrogables 10 más), adoptar manual interno de políticas de privacidad, registrar reclamos.
- **Autorización previa (arts. 8-9):** regla general: ninguna persona puede ser tratada sin autorización previa, expresa e informada. Puede ser: (a) autorizada en texto o voz; (b) conducta no ambigua presumida (indudable); (c) mediante enunciado específico otorgado por vía electrónica (el click en un checkbox informativo vale). **Conserve la prueba de la autorización** — la carga de demostrarla es del responsable.
- **Tratamiento sin autorización (art. 15):** datos de carácter público; cumulación con una ley; por derecho histórico, estadístico o científico; por orden judicial; por necesidad médica; dictámenes especializados; en mercados de valores.
- **Consultas y reclamos (arts. 14-15):** canal obligatorio con plazos perentorios. La SIC sanciona sistemáticamente la falta de respuesta oportuna.
- **Sanciones (Ley 1581 + Ley 1437 de 2011):** hasta 2.000 SMLMV, disolución de la persona jurídica, cierre temporal. La SIC es la autoridad de control.

### 1.2 REFORMA A LA LEY 1581 — aclaración crítica (verificado septiembre 2026)

> **La "Ley 2381 de 2024" NO es la reforma de datos personales.** Verificado: la **Ley 2381 de 2024 (julio de 2024) es la reforma pensional** — [Gestor Normativo Función Pública](https://www.funcionpublica.gov.co). Existe una colisión numérica casual; **no existe aún una ley de reforma al régimen de datos con ese número.**

Estado real de la modernización del régimen (verificado con [Congreso Visible — Uniandes](https://congresovisible.uniandes.edu.co), [Cámara de Representantes](https://www.camara.gov.co) y el "ABC del Proyecto de Ley" publicado por la propia [SIC](https://www.sic.gov.co)):

- La reforma a la Ley Estatutaria 1581 de 2012 existe como **proyecto de ley**, no como ley aprobada. Fue radicada en legislaturas previas y **re-radicada en 2025-2026** al no completar trámite; al corte de esta fecha continúa en trámite legislativo — **POR CONFIRMAR el número de radicado vigente**.
- Como es **ley estatutaria**, requiere mayorías especiales; el proyecto contempla: biometría como dato sensible, tratamiento de datos por sistemas de IA, fortalecimiento de potestades de la SIC, reglas reforzadas de transferencias internacionales y de consentimiento, alineación con el GDPR.
- **Implicación práctica para Check Pro:** el régimen vigente aplicable HOY sigue siendo Ley 1581 + Decreto 1377 de 2013 + Decreto 1074 de 2015 + Circulares SIC. Monitorear trimestralmente el proyecto, porque su aprobación elevará exigencias (DPO, DPIAs, bases de licitud tipo GDPR).

### 1.3 Decreto 1377 de 2013 y Decreto 1074 de 2015 (reglamentarios)

- **Decreto 1377 de 2013:** reglamentario de la Ley 1581. Define el contenido mínimo del **aviso de privacidad** (identidad del responsable, tratamiento y finalidades, canales para ejercer ARCO, cadena de encargados, datos sensibles y menores), regula la autorización (incluida la electrónica y la conducta presumida), el **manual interno de políticas y procedimientos** (obligatorio, debe publicarse), los regímenes sancionatorios aplicables, y las reglas sobre **titulares de datos de menores**.
- **Decreto 1074 de 2015 (Decreto Único):** compiló el Decreto 1377 en su Libro 2, Parte 2.2, Título 2.5 (arts. 2.2.2.25.2.1 y ss.). Texto: [Secretaría del Senado](https://www.secretariasenado.gov.co/senado/basedoc/decreto_1074_2015.html).
- **Decreto 4288 de 2020:** modificó el art. 26 del Decreto 1377 para fijar la **actualización anual obligatoria del RNBD** (ver 1.4).

### 1.4 Registro Nacional de Bases de Datos (RNBD) ante la SIC

- **Quién debe registrarse:** los **responsables y encargados del tratamiento** que efectúen tratamiento en territorio colombiano. Un SaaS de boletería sí está obligado: bases típicas a inscribir — usuarios/administradores de la plataforma, asistentes/boletos, staff, auditoría/accesos, marketing.
- **Plazo de inscripción:** dentro de los **2 meses siguientes a la creación de la base de datos**.
- **Actualización anual:** entre el **2 de enero y el 31 de marzo de cada año** (Decreto 4288 de 2020). Confirmado vigente para el ciclo 2026. Inscripción y actualización en línea en la sede electrónica de la SIC: [RNBD - SIC](https://www.sic.gov.co).
- **Riesgo:** el no registro y la no actualización anual son infracciones típicas sancionadas por la SIC (aparecen con frecuencia en sus fallos).

### 1.5 Avisos de privacidad y prueba de la autorización

- El aviso de privacidad debe existir y su contenido mínimo está en el Decreto 1377 (ver 1.3). En la práctica web: política de privacidad publicada y checkbox separado para autorización de tratamiento y para marketing (no pre-marcado).
- **Conservación de prueba:** el responsable debe conservar el registro de cuándo, cómo y qué autorizó el titular (logs de consentimiento con timestamp, versión del aviso aceptado). Debe cubrir la vida de la base de datos.
- El **manual interno de políticas y procedimientos** es obligatorio y debe estar a disposición del público.

### 1.6 Notificación de brechas / incidentes de seguridad

- **A la SIC:** la SIC mantiene la **Guía para la notificación de incidentes de seguridad informática**: los responsables (y encargados) deben notificar los incidentes que afecten datos personales en bases de datos, en general dentro de los **15 días hábiles siguientes al conocimiento**, por el formulario oficial en [sic.gov.co](https://www.sic.gov.co), incluyendo descripción del incidente, datos afectados, causas y medidas. *(Fundamento: Circular Única SIC / Circular Externa 005 de 2017 + Guía de la SIC — verificado en doctrina; no se pudo abrir la página oficial en esta sesión: **POR CONFIRMAR el texto exacto de la guía vigente**.)*
- **A los titulares:** obligación del art. 17.8 de la Ley 1581 y art. 22 del Decreto 1377: cuando el incidente **afecte datos sensibles o de menores, o exista riesgo para los titulares**, el responsable debe informar **sin demora** a los titulares: qué datos, qué pasó, medidas de mitigación, canales de atención. A diferencia del GDPR no hay plazo de "72 horas", pero la comunicación debe ser ágil y documentada.

### 1.7 Datos de menores de edad (art. 7 Ley 1581)

- El tratamiento de datos de menores está **proscrito por regla general**, salvo que sea de **carácter público** y cumpla el **principio del interés superior** y la garantía de sus derechos fundamentales.
- La autorización debe otorgarla el representante legal, siempre que el menor lo entienda (presunción de entendimiento desde los 14 años).
- **Aplicación a Check Pro:** la boletería de eventos incluye menores (boletas infantiles, eventos para todo público). Recomendación: no construir perfiles de menores, minimizar datos (sin documento ni foto de menores si es evitable), evaluar si el tratamiento es indispensable para vender la boleta o acompañar al menor al evento, y advertir a organizadores en los términos del servicio. Complementario: **Ley 679 de 2001** (ver 1.12).

### 1.8 Ley 527 de 1999 — comercio electrónico y firma electrónica

- Da plena validez jurídica a **mensajes de datos** (contratos electrónicos, boletas digitales, códigos QR) y a la **firma electrónica**; define firma digital (con certificado de entidad de certificación acreditada) y sus efectos probatorios.
- Relevancia: soporte legal del contrato electrónico con el comprador de boletas, de la aceptación de T&C en pantalla y de la validez de la boleta digital y del check-in.

### 1.9 Ley 1480 de 2011 — Estatuto del Consumidor aplicado a boletería

- **Art. 16 (venta de boletería):** el proveedor debe informar de manera expresa y destacada las condiciones del evento (lugar, fecha, hora, reglamento, condiciones de devolución) y **debe devolver el dinero cuando el evento se cancela o suspende**, además de responder cuando el servicio no se preste en las condiciones ofrecidas. Los cambios de fecha (reprogramación) exigen informar y respetar el derecho del consumidor; la SIC ha reiterado que el reembolso debe ser efectivo y oportuno.
- **Cláusulas abusivas (art. 42):** ejemplos típicos que deben evitarse en T&C de boletería: no reembolsar ante cancelación imputable al organizador, autorizar cambios unilaterales sin aviso, renuncia anticipada a reclamos.
- **Protección al comprador electrónico:** obligaciones de información precontractual (arts. 4-5, 30-32: el contrato queda perfeccionado cuando el consumidor confirma; el proveedor debe confirmar la recepción con medio que genere constancia — el correo de confirmación de la compra es obligatorio).
- **Reclamos:** canal PQR obligatorio; la SIC ejerce supervisión y las infracciones generan sanciones (hasta 2.000 SMLMV).

### 1.10 Ley 1335 de 2009 — mensajes comerciales (email/SMS marketing)

- Reglamenta el envío de **mensajes comerciales no solicitados** (spam) usando datos personales: toda comunicación comercial debe (i) **informar de la fuente** de los datos, (ii) ser identificable como comercial, (iii) incluir **instrucciones claras para dejar de recibirla (opt-out)**, y (iv) ofrecer datos de contacto.
- Aplica directamente a las notificaciones promocionales de eventos que Check Pro u organizadores envíen. Los correos transaccionales (confirmación de compra, recordatorio) están fuera por no ser comerciales, pero las campañas de marketing requieren autorización previa específica. En SaaS con usuarios registrados, lo correcto es autorización específica + opt-out en cada envío.

### 1.11 Facturación electrónica DIAN

- La **factura electrónica de venta es obligatoria** en Colombia (art. 616-1 del Estatuto Tributario; despliegue generalizado desde 2019-2020 vía Resolución DIAN 165 de 2018 modificada por 42 de 2020, con posteriores actualizaciones).
- Normativa reciente verificada: vigentes al corte **Resolución 000119 de 2024, Resolución 000189 de 2024 y Resolución 000202 de 31 de marzo de 2025** (ver [micrositio de facturación electrónica DIAN](https://micrositios.dian.gov.co) y [dian.gov.co](https://www.dian.gov.co)). Puntos operativos 2025-2026: transmisión a la DIAN **el mismo día de emisión**, emisión únicamente **en pesos colombianos** desde el 1 de mayo de 2025, y exigencia a los **proveedores tecnológicos** de certificación ISO/IEC 27001:2022.
- **Para Check Pro:** si la plataforma emite o facilita la emisión de tiquetes/facturas por boletas, requiere habilitarse como **facturador electrónico** ante la DIAN (o integrar un proveedor tecnológico habilitado), generando CUFE, firma digital (certificado) y transmisión en el plazo vigente.

### 1.12 PCI DSS y pagos con tarjeta en Colombia

- El PCI DSS **no es ley colombiana**: lo imponen **contractualmente las marcas de tarjetas (Visa, Mastercard, etc.) y los adquirentes/bancos** a comercios y proveedores de servicios. Si Check Pro procesa, transmite o almacena datos de titulares de tarjeta, entra al alcance.
- **Estrategia SAQ-A:** si los pagos se delegan completamente a una pasarela certificada **con redirección o página hospedada** (el servidor de Check Pro nunca toca PAN ni datos de autenticación), el alcance se reduce al cuestionario **SAQ-A** (el más corto). Ojo 2025-2026: con PCI DSS v4.x, si el formulario de pago se **incrusta (iframe/script) en el sitio de Check Pro**, hay requisitos adicionales (control de scripts en la página de pago y detección de alteraciones — requisitos 6.4.3 y 11.6.1); la redirección pura mantiene el alcance mínimo.
- Complemento contractual: cláusulas de responsabilidad con la pasarela y verificación anual de su **Attestation of Compliance (AOC)**.

### 1.13 Ley 679 de 2001 y afines — protección de menores (eventos)

- **Ley 679 de 2001:** previene y sanciona la explotación, la pornografía y el turismo sexual con menores. La **Ley 1336 de 2009** extendió obligaciones a establecimientos que reciben público (afiches y advertencias obligatorias con la leyenda de protección de menores y las líneas de denuncia, p. ej. línea 141).
- **Aplicación:** organizadores y establecimientos de eventos con aforo suelen estar cobijados por las advertencias obligatorias. Recomendación: incluir en la plataforma un módulo/advertencia estándar imprimible para organizadores y en las boletas de eventos con menores, y definir en T&C la prohibición de uso de la plataforma para eventos con contenido prohibido a menores.

### 1.14 Ciberseguridad — lineamientos gubernamentales (MinTIC)

- No existe hoy una ley de ciberseguridad que imponga obligaciones directas de autogobierno a un SaaS privado colombiano; el marco es de política pública: **Política Nacional de Confianza y Seguridad Digital (CONPES 3854 de 2016)**, el **Marco de Ciberseguridad para el Sector TIC** de MinTIC (alineado con NIST CSF, voluntario/buenas prácticas), la **Ley 2207 de 2022 de Gobierno Digital** (relevante si se contrata con el Estado) y la reorganización institucional ciber 2023-2026. Para Check Pro se recomienda adoptar el Marco de Ciberseguridad MinTIC/NIST CSF como brújula técnica y mantener el deber legal de seguridad de la información de la Ley 1581 (art. 17) como piso obligatorio.

---

## 2. LATAM (resumen ejecutivo por país)

Aplicable si Check Pro atiende organizadores/asistentes fuera de Colombia (extraterritorialidad tipo GDPR: aplicar cuando se ofrezcan servicios a titulares del país o se monitoree su comportamiento).

### 2.1 México — LFPDPPP (reforma 2025) — **verificado**
Reforma estructural verificada: el **20 de marzo de 2025** se publicó (vigente desde el 21 de marzo de 2025) la **nueva Ley Federal de Protección de Datos Personales en Posesión de los Particulares**, que **deroga la ley de 2010** y forma parte del paquete que **extinguió el INAI**; la supervisión y sanción pasó a la **Secretaría Anticorrupción y Buen Gobierno** (órgano del Ejecutivo, no autónomo). La nueva ley amplía definiciones, derechos del titular, y da relevancia a decisiones automatizadas/IA. Clave práctica: mantener **avisos de privacidad de conformidad con el marco mexicano** (cláusula de privacidad separada si hay operación real en México), canal ARCO y provisión de datos al titular.

### 2.2 Brasil — LGPD (Ley 13.709/2018) — vigente
Ley general alineada al GDPR: 10 principios (art. 6), 10 bases de licitud (art. 7, incluido **interés legítimo** y obligaciones legales), derechos del titular (arts. 18-20, incl. revisión de decisiones automatizadas), **encarregado (DPO)** obligatorio en la práctica, y **autoridad ANPD** con poderes normativos y sancionadores: multas hasta **2% de la facturación en Brasil, tope R$ 50 millones por infracción** (aplicables desde agosto de 2021; ya hay multas aplicadas). Clave práctica: para operar hacia Brasil, nombrar encarregado, elaborar Relatório de Impacto (RIPD) si hay decisión automatizada de check-in/riesgo, y revisar transferencias internacionales (la ANPD aprobó cláusulas patrón — SCC brasileñas — en 2024).

### 2.3 Argentina — Ley 25.326 (2000) — con actualizaciones en curso
Régimen veterano y de estricto cumplimiento: registro **previo** de bases de datos ante la autoridad (hoy **AAIP**, [argentina.gob.ar/aaip](https://www.argentina.gob.ar/aaip)), derechos de acceso/rectificación/actualización/supresión fuertes, y **regla de transferencia internacional restrictiva** (solo países con nivel adecuado o consentimiento del titular; art. 12). El reglamento histórico es el **Decreto 1558/2001**; durante 2024-2025 la AAIP impulsó un **nuevo reglamento general y proyectos de reforma integral alineados al GDPR** — **POR CONFIRMAR el estado exacto y número del nuevo decreto/resolución al cierre** (verificar en el [Boletín Oficial](https://www.boletinoficial.gob.ar)). Clave práctica: si hay clientes argentinos, evaluar inscripción en el registro de la AAIP y cláusulas de transferencia.

### 2.4 Chile — Ley 21.719 (nueva ley de datos) — **verificado, fechas al límite**
Verificado: la **Ley 21.719** (publicada el 13 de diciembre de 2024) reemplaza la Ley 19.628 con estándar cercano al GDPR: bases de licitud (incluido interés legítimo), **Agencia de Protección de Datos Personales**, delegado de protección de datos, registro de bases, notificación de brechas, multas hasta 20.000 UTM. **Vigencia plena prevista: 1 de diciembre de 2026**; sin embargo, el **1 de septiembre de 2026 el Gobierno presentó un proyecto para postergarla un año (a diciembre de 2027)** alegando falta de preparación de empresas y de la Agencia ([análisis Araya](https://araya.cl), [Carey](https://www.carey.cl), [texto oficial BCN](https://www.bcn.cl/leychile)). Clave práctica: al 23-sep-2026 la fecha oficial sigue siendo **01-12-2026** pero hay incertidumbre real de postergación; para un SaaS con clientes chilenos conviene preparar adecuación en 2026 y vigilar el proyecto.

### 2.5 Perú — Ley 29733 y nuevo reglamento — **verificado**
La Ley 29733 (2011, con el principio de publicidad como base por defecto) fue **reglamentada por el Decreto Supremo 016-2024-JUS**, que **sustituye al reglamento de 2013 y rige desde el 30/31 de marzo de 2025** (ver [Garrigues](https://www.garrigues.com), [Gob.pe](https://www.gob.pe)). El nuevo reglamento detalla aviso de privacidad, consentimiento, registros de actividades, transferencias internacionales, medidas de seguridad y régimen sancionador a cargo de la **Autoridad Nacional de Protección de Datos Personales** (Minjus). Clave práctica: en Perú el dato "por defecto" tiende a ser público a menos que se declare reservado; usar aviso de privacidad conforme al DS 016-2024-JUS y plazos de atención ARCO (20 días hábiles).

### 2.6 Ecuador — LOPDP (2021)
**Ley Orgánica de Protección de Datos Personales** (Registro Oficial Suplemento 447, 26 de mayo de 2021), reglamentada por **Decreto Ejecutivo 754 de 2023**; autoridad: **Superintendencia de Protección de Datos Personales** ([datosproteccion.gob.ec](https://www.datosproteccion.gob.ec)). Estándar GDPR-like: consentimiento granular, DPO, evaluaciones de impacto, notificación de incidentes a la Superintendencia (**10 días** desde conocimiento) y a titulares, multas con escala progresiva y periodo de adecuación transitorio ya vencido (2024-2025). Clave práctica: avisos de privacidad y consentimiento por finalidad; registrar incidentes con cronómetro de 10 días.

### 2.7 Uruguay — Ley 18.331 (2008)
Régimen consolidado: Ley 18.331, reglamentada por Decreto 414/009 (modificado por 664/020); autoridad **URCDP**. Exige **registro de bases de datos** ante la URCDP, consentimiento con excepciones, y **transferencias internacionales** solo hacia países con protección adecuada (lista de la URCDP) o con autorización/consentimiento. Clave práctica: para usuarios uruguayos, alta de bases en el registro URCDP y revisión de la lista de países adecuados.

---

## 3. INTERNACIONAL (referentes)

### 3.1 GDPR (Reglamento UE 2016/679) — el estándar de oro
Aunque no aplica directamente a Check Pro salvo clientes europeos, es la referencia de diseño ("privacy by design"): **principios** (art. 5: licitud/lealtad/transparencia, limitación de finalidades, minimización, exactitud, limitación del plazo de conservación, integridad/confidencialidad, responsabilidad proactiva); **bases de licitud** (art. 6: consentimiento, contrato, obligación legal, intereses vitales, interés público, **interés legítimo**); **derechos** (acceso, rectificación, supresión, limitación, portabilidad, oposición, no sujeción a decisiones automatizadas); **DPO** (arts. 37-39) cuando aplica; **DPIA/EIPD** (art. 35) para tratamientos de alto riesgo (p. ej., verificación con foto en check-in = biometría si se procesan rasgos); **brechas**: aviso a la autoridad en **72 horas** (art. 33) y a titulares sin demora si hay alto riesgo (art. 34); **transferencias**: adecuaciones, SCC y normas complementarias (caps. V). Texto: [EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj).

### 3.2 PCI DSS 4.0.1 — pagos con tarjeta
Estándar del PCI Security Standards Council, **v4.0.1 vigente** (v4.0 retirada el 31 de marzo de 2025; los requisitos "future-dated" de la v4.x son obligatorios desde el 31 de marzo de 2025). 12 requisitos agrupados en 6 objetivos; MFA obligatorio ampliado, gestión de scripts en páginas de pago y cifrado en tránsito/reposo. **Para Check Pro:** el objetivo es mantener el alcance mínimo (SAQ-A) dejando todo el PAN en la pasarela con redirección; si se usa iframe, cumplir 6.4.3/11.6.1. Documento oficial: [pcisecuritystandards.org](https://www.pcisecuritystandards.org).

### 3.3 ISO/IEC 27001 e ISO/IEC 27701
- **ISO/IEC 27001:2022** — certifica un **SGSI**: evaluación de riesgos, controles del Anexo A (93 controles en 4 temas), auditoría por tercero acreditado. Para un SaaS de eventos: señal fuerte ante organizadores corporativos y requisito creciente en licitaciones; además la DIAN la exige a proveedores tecnológicos de facturación.
- **ISO/IEC 27701** — extiende el SGSI hacia un **PIMS** (gestión de privacidad), con anexos para responsables y encargados, alineado al GDPR. Fue **actualizada en 2025** para hacerla certificable de forma autónoma — **POR CONFIRMAR el estado de transición de certificaciones** ([iso.org/standard/71670.html](https://www.iso.org/standard/71670.html)). Recomendación: primero 27001; 27701 después, cuando el programa de privacidad madure.

### 3.4 Otros estándares relevantes
**SOC 2** (AICPA, criterios Trust Services; informe Tipo II tras ~6 meses de evidencia) es hoy el estándar de facto que exigen clientes empresariales de SaaS en la región; **NIST Cybersecurity Framework 2.0** (2024) sirve como mapa de madurez sin costo de certificación y es la base del Marco de Ciberseguridad de MinTIC; **ISO/IEC 27017/27018** agregan controles específicos de nube y protección de PII en nube pública.

---

## 4. CHECKLIST ACCIONABLE

| # | Obligación | Norma | ¿Aplica a un SaaS de boletería colombiano? | Prioridad sugerida |
|---|-----------|-------|--------------------------------------------|--------------------|
| 1 | Solicitar **autorización previa, expresa e informada** (checkbox informativo por finalidad) y **conservar la prueba** (logs con fecha/versión) | Ley 1581 arts. 8-9; Decreto 1377 arts. 3-13 | Sí — usuarios, staff, asistentes | P0 |
| 2 | **Aviso de privacidad** con contenido mínimo (responsable, finalidades, canales ARCO, datos sensibles, menores) | Decreto 1377 arts. 14-15 | Sí | P0 |
| 3 | **Política de privacidad publicada** + **manual interno de políticas y procedimientos** de tratamiento | Ley 1581 art. 17.12; Decreto 1377 art. 13 | Sí | P0 |
| 4 | Inscripción de bases en el **RNBD** (dentro de 2 meses de su creación) | Decreto 1377 art. 22; Decreto 2652 de 2013 | Sí — bases de usuarios, asistentes, staff, auditoría | P0 |
| 5 | **Actualización anual del RNBD** (2 enero – 31 marzo) | Decreto 4288 de 2020 | Sí — calendario anual | P0 |
| 6 | Canal de **derechos ARCO** con plazos legales (consultas 10 días hábiles; reclamos 15 + prórroga 10) y registro de reclamos | Ley 1581 arts. 14-15, 17 | Sí — formulario en la app y en la web pública | P0 |
| 7 | Procedimiento de **notificación de brechas**: a la SIC (≈15 días hábiles; POR CONFIRMAR guía vigente) y a titulares sin demora si hay datos sensibles/menores o riesgo | Ley 1581 art. 17.8; Decreto 1377 art. 22; Guía SIC | Sí — escribir el protocolo ANTES del primer incidente | P0 |
| 8 | **Seguridad de la información**: cifrado en tránsito (TLS) y en reposo, control de acceso/roles, gestión de secretos, backups, registros de auditoría | Ley 1581 art. 17.7; Decreto 1074; valorar ISO 27001 | Sí | P0 |
| 9 | **Términos y condiciones** de la plataforma y de venta de boletas, sin cláusulas abusivas, con reglas de cancelación/reprogramación y reembolso | Ley 1480 arts. 16, 42; Ley 527 de 1999 | Sí — núcleo del negocio | P0 |
| 10 | Información **precontractual electrónica** y confirmación de compra con constancia (correo con detalles del evento y condiciones de devolución) | Ley 1480 arts. 4-5, 16, 30-32 | Sí | P1 |
| 11 | **Marketing con opt-out**: autorización específica + leyenda de baja en cada email/SMS comercial | Ley 1335 de 2009 | Sí — campañas de eventos | P1 |
| 12 | **Política de cookies** y consentimiento para cookies no esenciales (buena práctica consolidada; normativa específica por confirmar en Colombia) | Ley 1581 (consentimiento); práctica GDPR | Sí (sitio web) | P1 |
| 13 | **Facturación electrónica DIAN** (habilitación propia o vía proveedor tecnológico; CUFE, firma, transmisión según resoluciones vigentes) | E.T. arts. 616-1/616-2; Res. DIAN 165/2018, 42/2020, 119/189/2024, 202/2025 | Sí — si se emiten tiquetes/facturas desde la plataforma | P1 |
| 14 | **PCI DSS vía pasarela**: delegar todo el PAN a pasarela certificada con redirección (SAQ-A); si se usa iframe, cumplir 6.4.3 y 11.6.1; AOC anual del proveedor | PCI DSS v4.0.1 (exigencia de marcas/bancos) | Sí — si hay pagos con tarjeta | P0 (diseño) / P1 (mantenimiento) |
| 15 | **Contrato de tratamiento por encargo** con organizadores que cargan datos de asistentes (Check Pro como encargado) | Ley 1581 art. 18 | Sí — cláusula en T&C + contrato B2B | P0 |
| 16 | **Tratamiento de menores**: minimización, sin perfiles, autorización de representante, evaluación de necesidad por boleta | Ley 1581 art. 7; Decreto 1377 | Sí — eventos familiares/infantiles | P1 |
| 17 | **Advertencias obligatorias** de protección de menores (explotación sexual) en eventos/establecimientos y prohibición de eventos prohibidos en T&C | Ley 679 de 2001; Ley 1336 de 2009 | Sí — módulo de advertencia para organizadores | P2 |
| 18 | **Transferencias internacionales** de datos: cláusulas contractuales con proveedores de nube/email/pasarela (SIC admite contratos tipo; revisar destino) | Ley 1581 arts. 26-28; Circulares SIC; Circ. Ext. 002 de 2015 | Sí — hosting y SaaS suelen estar fuera de Colombia | P1 |
| 19 | **Retención y supresión**: definir plazos de conservación por base (asistentes, auditoría, contable) y procedimiento de eliminación/anonimización a petición del titular | Ley 1581 arts. 15, 17.6; principios de finalidad y temporalidad | Sí | P1 |
| 20 | **Adecuación LATAM** (si se atienden titulares de esos países): cláusula de privacidad México (nueva LFPDPPP 2025), revisión LGPD (encarregado/SCC ANPD), preparación Chile 21.719 (vigencia 1-dic-2026 salvo postergación), aviso Perú (DS 016-2024-JUS), consentimiento Ecuador (LOPDP), registro Uruguay (18.331) | Véase sección 2 | Condicional (expansión real a cada país) | P2 |
| 21 | Adoptar **marco de seguridad formal** (NIST CSF 2.0 / Marco MinTIC) y evaluar certificación ISO 27001 (requerida a proveedores de facturación electrónica; valor comercial alto) | CONPES 3854; Marco MinTIC; ISO/IEC 27001:2022 | Sí como hoja de ruta | P2 |
| 22 | **Monitoreo legislativo**: proyecto de reforma estatutaria a la Ley 1581 (re-radicado 2025-2026) y proyecto chileno de postergación; actualizar este documento al aprobarse | Proyectos en trámite | Sí — revisión trimestral | P2 |

---

## Puntos explícitamente POR CONFIRMAR (no tomar como hechos)

1. **Número y estado del proyecto de reforma** a la Ley Estatutaria 1581 (re-radicación 2025-2026) — verificar en [congresovisible.uniandes.edu.co](https://congresovisible.uniandes.edu.co) y [camara.gov.co](https://www.camara.gov.co).
2. **Texto/fecha exacta de la Guía SIC de notificación de incidentes** y su plazo vigente (15 días hábiles es el criterio consistente reportado en doctrina, pero no se pudo abrir la fuente primaria en esta sesión).
3. **Argentina:** nuevo decreto/reglamento de la AAIP 2025 (número y vigencia) — verificar en [boletinoficial.gob.ar](https://www.boletinoficial.gob.ar) y [argentina.gob.ar/aaip](https://www.argentina.gob.ar/aaip).
4. **Chile:** desenlace del proyecto de postergación (dic-2026 → dic-2027) — verificar en [bcn.cl/leychile](https://www.bcn.cl/leychile).
5. **ISO/IEC 27701:2025:** estado de transición de certificaciones respecto a la edición 2019.
6. **Plazo textual de reembolso** en cancelación de eventos (el art. 16 de la Ley 1480 ordena la devolución; confirmar el criterio operativo de la SIC al momento del reclamo).

---

## Sources

- [Ley 1581 de 2012 — Secretaría del Senado](https://www.secretariasenado.gov.co/senado/basedoc/ley_1581_2012.html) · [Gestor Normativo Función Pública](https://www.funcionpublica.gov.co)
- [Ley 2381 de 2024 (reforma pensional — NO es la de datos) — Función Pública](https://www.funcionpublica.gov.co)
- [Proyecto de reforma a la Ley 1581 — Cámara de Representantes](https://www.camara.gov.co) · [Congreso Visible Uniandes](https://congresovisible.uniandes.edu.co) · [SIC — ABC del proyecto](https://www.sic.gov.co)
- [Decreto 1074 de 2015 — Secretaría del Senado](https://www.secretariasenado.gov.co/senado/basedoc/decreto_1074_2015.html)
- [SIC — Registro Nacional de Bases de Datos (RNBD) y actualización anual](https://www.sic.gov.co) · [Sede Electrónica SIC](https://sedeelectronica.sic.gov.co)
- [Ley 527 de 1999 — Secretaría del Senado](https://www.secretariasenado.gov.co/senado/basedoc/ley_0527_1999.html)
- [Ley 1480 de 2011 — Secretaría del Senado](https://www.secretariasenado.gov.co/senado/basedoc/ley_1480_2011.html)
- [Ley 1335 de 2009 — Secretaría del Senado](https://www.secretariasenado.gov.co/senado/basedoc/ley_1335_2009.html)
- [Ley 679 de 2001 — Secretaría del Senado](https://www.secretariasenado.gov.co/senado/basedoc/ley_0679_2001.html)
- [DIAN — Facturación electrónica](https://www.dian.gov.co) · [Micrositio normativo facturación DIAN](https://micrositios.dian.gov.co)
- [CONPES 3854 de 2016 — Confianza y Seguridad Digital (DNP)](https://colaboracion.dnp.gov.co/CDT/Conpes/Econ%C3%B3micos/3854.pdf) · [MinTIC](https://www.mintic.gov.co)
- [PCI Security Standards Council — document library](https://www.pcisecuritystandards.org)
- [GDPR — EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj)
- [ISO/IEC 27701](https://www.iso.org/standard/71670.html) · [ISO/IEC 27001](https://www.iso.org/standard/27001)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- México: [Greenberg Traurig](https://www.gtlaw.com) · [White & Case](https://www.whitecase.com) · [IAPP](https://iapp.org) · [DOF](https://www.dof.gob.mx)
- Brasil: [LGPD Ley 13.709/2018 — Planalto](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm) · [ANPD](https://www.gov.br/anpd)
- Argentina: [Ley 25.326 — InfoLeg](https://www.argentina.gob.ar/normativa) · [AAIP](https://www.argentina.gob.ar/aaip) · [Boletín Oficial](https://www.boletinoficial.gob.ar)
- Chile: [Ley 21.719 — Biblioteca del Congreso Nacional](https://www.bcn.cl/leychile) · [Análisis Araya](https://araya.cl) · [Carey](https://www.carey.cl)
- Perú: [Gob.pe — vigencia nuevo reglamento](https://www.gob.pe) · [Garrigues — DS 016-2024-JUS](https://www.garrigues.com) · [SPIJ](https://spij.minjus.gob.pe)
- Ecuador: [Superintendencia de Protección de Datos Personales](https://www.datosproteccion.gob.ec)
- Uruguay: [Ley 18.331 — IMPO](https://www.impo.com.uy/bases/leyes/18331-2008) · [URCDP](https://www.gub.uy/unidad-reguladora-control-datos-personales)
