# Guía de Entregabilidad de Emails - Check Pro

**Última actualización:** Marzo 2026  
**Sistema:** Check Pro v12.16.5+

---

## 1. Introducción

Para asegurar que los emails enviados por Check Pro (confirmaciones, recordatorios, invitaciones) lleguen a la **Bandeja de Entrada** y no a **Spam**, es esencial configurar los registros DNS de tu dominio.

### ¿Por qué es importante?

| Problema | Causa | Consecuencia |
|----------|-------|--------------|
| Emails en **Spam** | Dominio no autenticado | Usuarios no ven las notificaciones |
| Emails **rechazados** | Servidores no reconocen el origen | Direcciones bloqueadas |
| Baja reputación | Sin validación SPF/DKIM | Dominio marcado como spam |

---

## 2. Registros DNS Necesarios

Agrega estos registros en el panel de control de tu dominio (GoDaddy, HostGator, Namecheap, Cloudflare, etc.):

---

### 2.1 SPF (Sender Policy Framework)

**Tipo:** TXT  
**Nombre/Host:** @ (o vacío)  
**Valor:**

```
v=spf1 include:_spf.google.com ~all
```

> **Nota:** Si usas **Microsoft 365/MS365**, usa:
> ```
> v=spf1 include:spf.protection.outlook.com ~all
> ```

**¿Qué hace?**  
Indica qué servidores de correo están autorizados a enviar emails *desde* tu dominio.

---

### 2.2 DKIM (DomainKeys Identified Mail)

**Tipo:** TXT  
**Nombre/Host:** `google._domainkey` o `dkim._domainkey`  

**Valor:** Copia la clave pública desde:
- **Google Workspace:** Admin Console → Aplicaciones → Google Workspace → Gmail → Autenticación de email → DKIM
- **Microsoft 365:** Exchange Admin Center → Flujo de correo → Dominios → DKIM

**Ejemplo de valor:**
```
k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC...
```

**¿Qué hace?**  
Añade una firma criptográfica a cada email que puede ser verificada por el servidor receptor.

---

### 2.3 DMARC (Domain-based Message Authentication)

**Tipo:** TXT  
**Nombre/Host:** `_dmarc`  
**Valor:**

```
v=DMARC1; p=quarantine; rua=mailto:admin@tudominio.com
```

**Parámetros:**
| Parámetro | Valor | Significado |
|-----------|-------|-------------|
| `v` | DMARC1 | Versión del protocolo |
| `p` | quarantine | Los emails sospechosos van a spam ( alternatives: `reject` = rechazar, `none` = solo monitoreo) |
| `rua` | mailto:... | Reports de agregado enviados a este email |

**¿Qué hace?**  
Define qué hacer cuando un email falla la validación SPF o DKIM.

---

## 3. Configuración según tu proveedor de email

### 3.1 Google Workspace (Gmail)

1. **SPF ya incluido** en: `v=spf1 include:_spf.google.com ~all`

2. **DKIM:**
   - Ve a Admin Console → Aplicaciones → Google Workspace → Gmail
   - Autenticación de email → Generar nuevo registro DKIM
   - Copia el valor TXT con nombre `google._domainkey`

3. **DMARC:**
   - Agrega el registro `_dmarc` en tu DNS

---

### 3.2 Microsoft 365 (Outlook/Exchange)

1. **SPF:**
   ```
   v=spf1 include:spf.protection.outlook.com ~all
   ```

2. **DKIM:**
   - Exchange Admin Center → Flujo de correo → Dominios → DKIM
   - Habilita DKIM para tu dominio
   - Copia los valores CNAME o TXT

3. **DMARC:**
   ```
   v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@tudominio.com
   ```

---

### 3.3 Si usas otro proveedor SMTP (SendGrid, Mailgun, etc.)

1. **SPF:** Añade el include de tu proveedor
   ```
   v=spf1 include:sendgrid.net ~all
   ```

2. **DKIM:** Configura las claves DKIM desde el panel de tu proveedor

3. **DMARC:** Registro genérico
   ```
   v=DMARC1; p=quarantine; rua=mailto:reports@tudominio.com
   ```

---

## 4. Verificación de Configuración

### Herramientas online:

| Herramienta | URL | Qué verifica |
|-------------|-----|--------------|
| **MXToolbox** | https://mxtoolbox.com/ | SPF, DKIM, DMARC, MX |
| **Mail-Tester** | https://mail-tester.com/ | Score de entregabilidad |
| **Google Admin Toolbox** | https://toolbox.googleapps.com/ | Diagnóstico Gmail |

### Verificación manual:

```bash
# Verificar SPF
nslookup -type=TXT tudominio.com

# Verificar DKIM (sustituye el selector)
nslookup -type=TXT google._domainkey.tudominio.com

# Verificar DMARC
nslookup -type=TXT _dmarc.tudominio.com
```

---

## 5. Checklist de Configuración

| Paso | Tarea | Estado |
|------|-------|--------|
| 1 | Configurar SPF en DNS | ⬜ |
| 2 | Generar y añadir DKIM en DNS | ⬜ |
| 3 | Añadir registro DMARC en DNS | ⬜ |
| 4 | Esperar propagación DNS (24-48h) | ⬜ |
| 5 | Verificar con MXToolbox | ⬜ |
| 6 | Enviar email de prueba | ⬜ |
| 7 | Revisar si llegó a Inbox (no Spam) | ⬜ |

---

## 6. Configuración SMTP en Check Pro

En Check Pro, configura tu SMTP en **Configuración → Email**:

| Campo | Valor ejemplo |
|-------|--------------|
| **Host SMTP** | smtp.gmail.com |
| **Puerto** | 587 (TLS) o 465 (SSL) |
| **Usuario** | tuemail@tudominio.com |
| **Contraseña** | Contraseña de aplicación |
| **Seguridad** | STARTTLS |

> **Importante:** Si usas Gmail/Google Workspace, necesitas crear una **Contraseña de aplicación** (no tu contraseña normal).

---

## 7. Troubleshooting

| Problema | Solución |
|----------|----------|
| Emails van a Spam | Verifica SPF, DKIM, DMARC; usa addresses@tu-dominio.com |
| Error "Authentication failed" | Verifica usuario/contraseña SMTP; usa contraseña de aplicación |
| Servidor bloquea puerto 587 | Prueba puerto 465 con SSL |
| Cambios DNS no aplicados | Espera 24-48h; verifica propagación |

---

## 8. Recursos Adicionales

- **Google:** [Autenticación de email en Gmail](https://support.google.com/a/answer/2466583)
- **Microsoft:** [Configurar DKIM en Exchange](https://docs.microsoft.com/en-us/microsoft-365/security/office-365-security/use-dkim-to-validate-outbound-email)
- **DMARC Inspector:** https://dmarcian.com/dmarc-inspector/
- **Sender Score:** https://senderscore.org/

---

**¿Preguntas?** Revisa los logs de email en Check Pro (Configuración → Email → Logs) para diagnosticar problemas.
