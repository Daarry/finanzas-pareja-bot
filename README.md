# Bot de WhatsApp — Finanzas Pareja

Bot que apunta y consulta vuestro Google Sheet de finanzas escribiéndole por WhatsApp.

- **Apuntar:** «40 cena fuera, común» · «nómina 1450» · «gimnasio 35 fijo» · «le he pasado 100 a Mimi»
- **Consultar:** «cómo vamos este mes» · «cuánto se debe» · «cuánto hay en las cuentas»
- **Recordatorios:** aviso a fin de mes si hay saldo pendiente y el día 1 para apuntar nóminas.

Quién paga se detecta por tu número de WhatsApp (Darry vs Mimi). Todas las fórmulas del Sheet
(reparto, acumulado, cuentas) se recalculan solas.

## Coste: 0 €
Vercel hobby (gratis), Google Sheets API (gratis), Gemini Flash nivel gratuito (gratis),
WhatsApp Cloud API (gratis para vuestras conversaciones). Solo necesitáis un **número de WhatsApp
para el bot** distinto de vuestro WhatsApp personal (una SIM/numero secundario).

---

## Puesta en marcha (una vez)

### A. Google Sheet
1. Sube `Finanzas-Pareja.xlsx` a Drive y ábrelo como Hoja de cálculo de Google.
2. Copia su **ID** de la URL: `docs.google.com/spreadsheets/d/`**`ESTE_ID`**`/edit` → será `GOOGLE_SHEET_ID`.

### B. Cuenta de servicio de Google (para que el bot escriba en la hoja)
1. Entra en https://console.cloud.google.com → crea un proyecto (o usa uno).
2. **APIs y servicios → Biblioteca** → activa **Google Sheets API**.
3. **APIs y servicios → Credenciales → Crear credenciales → Cuenta de servicio**. Crea una.
4. En esa cuenta de servicio → pestaña **Claves → Agregar clave → JSON**. Se descarga un `.json`.
5. Del JSON saca: `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`, y `private_key` → `GOOGLE_PRIVATE_KEY`.
6. **Importante:** abre tu Google Sheet → **Compartir** → pega el `client_email` con permiso **Editor**.

### C. Clave de Gemini (gratis)
1. Ve a https://aistudio.google.com/apikey → **Create API key** (sin tarjeta). → `GEMINI_API_KEY`.

### D. WhatsApp Cloud API (Meta)
1. https://developers.facebook.com → **My Apps → Create App → Business**.
2. Añade el producto **WhatsApp**. En *API Setup* verás un número de prueba y un **Phone number ID**
   (`WHATSAPP_PHONE_NUMBER_ID`). Para uso real, registra tu número secundario.
3. Token permanente: **Business Settings → Users → System Users** → crea uno, asígnale la app con
   permiso *Manage*, y **Generate token** con permisos `whatsapp_business_messaging` y
   `whatsapp_business_management`. Ese token → `WHATSAPP_TOKEN` (no uses el temporal de 24h).
4. Inventa una cadena para `WHATSAPP_VERIFY_TOKEN` (la usarás en el paso F).
5. Apunta vuestros números en formato internacional sin `+` (ej. `34666111222`) → `WA_DARRY`, `WA_MIMI`.

### E. Desplegar en Vercel
1. Sube esta carpeta a un repo de GitHub (privado).
2. https://vercel.com → **Add New → Project** → importa el repo.
3. En **Settings → Environment Variables** mete todas las del `.env.example` con tus valores.
   - `GOOGLE_PRIVATE_KEY`: pega el valor tal cual del JSON (con los `\n`), entre comillas.
4. **Deploy**. Te queda una URL tipo `https://tu-proyecto.vercel.app`.

### F. Conectar el webhook en Meta
1. En la app de Meta → **WhatsApp → Configuration → Webhook → Edit**:
   - Callback URL: `https://tu-proyecto.vercel.app/api/webhook`
   - Verify token: el mismo `WHATSAPP_VERIFY_TOKEN`.
2. **Verify and save** (debe verificar OK).
3. En **Webhook fields** suscríbete a **messages**.

### Probar
Escribe al número del bot desde el WhatsApp de Darry: «40 cena, común» → debe responder «🧾 Apuntado…»
y aparecer la fila en la hoja Movimientos. Prueba «cómo vamos» y «cuánto hay en las cuentas».

---

## Recordatorios (opcional, ojo)
El cron diario (`vercel.json`) avisa a fin de mes y el día 1. Meta solo deja que el bot **inicie**
mensajes libres dentro de las 24h desde vuestro último mensaje; fuera de eso hace falta una
**plantilla aprobada** (categoría *utility*, gratis o céntimos). Si queréis recordatorios garantizados,
crea una plantilla en Meta y adapto `cron-reminder.js` para usarla. Si no, funciona "best-effort".

## Seguridad
- Solo los números `WA_DARRY` y `WA_MIMI` pueden usar el bot; el resto se ignora.
- No subas el `.json` de Google ni el `.env` al repo (ya están en `.gitignore`).
- La cuenta de servicio solo tiene acceso a la hoja que tú compartas.

## Estructura
```
api/webhook.js         Recibe mensajes de WhatsApp (apuntar / consultar)
api/cron-reminder.js   Recordatorios diarios
lib/parse.js           Interpreta el texto con Gemini (gratis)
lib/sheets.js          Lee/escribe en el Google Sheet
lib/whatsapp.js        Envía mensajes
lib/people.js          Número → persona (Darry/Mimi)
```
