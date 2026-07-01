# Guía de instalación — Bot de Finanzas Pareja (para un nuevo usuario)

> Esta guía sirve para montarle a **otra pareja** el mismo sistema: un Excel (Google Sheets) donde un
> **bot de WhatsApp** apunta sus gastos e ingresos, con reparto justo, ahorro, deudas y plan de casa.
> Está pensada para seguirla en el portátil del NUEVO usuario, con SU cuenta de Google (así solo él y
> su pareja tienen acceso a sus datos). **Coste: 0 €.**

## Antes de empezar, ten a mano
- El **portátil** del usuario, con sesión iniciada en **su cuenta de Google** (en el navegador).
- **Su móvil** y el de **su pareja** (para verificarse en WhatsApp).
- ~45-60 min. No hace falta comprar ningún número ni poner tarjeta.
- Enlaces del kit:
  - **Plantilla del Excel (hacer copia):** `https://docs.google.com/spreadsheets/d/1fz9TAfEOOdk6a9WMP7ehr7FfN_I7zSMz8ulTTFPzc70/copy`
  - **Código del bot (GitHub):** `https://github.com/Daarry/finanzas-pareja-bot`

En esta guía, llamaremos **P1** a la primera persona y **P2** a su pareja (usa sus nombres reales).

---

## A) El Excel (Google Sheets)
1. Abre el **enlace de la plantilla** (arriba) estando en la cuenta de Google del usuario → **Hacer una copia**. Queda en SU Drive, privada.
2. **Pon vuestros nombres** (la plantilla trae "Darry" y "Mimi" de ejemplo):
   - Menú **Editar → Buscar y reemplazar** (o Ctrl+H).
   - Marca **"Buscar también en fórmulas"**.
   - Reemplaza `Darry` → **nombre de P1** (Reemplazar todos).
   - Reemplaza `Mimi` → **nombre de P2** (Reemplazar todos).
3. Copia el **ID** de la hoja (de la URL, entre `/d/` y `/edit`). ⚠️ Cópialo EXACTO (ojo con `I`/`l`/`1` y `O`/`0`). → será `GOOGLE_SHEET_ID`.

## B) Cuenta de servicio de Google (para que el bot escriba en la hoja)
1. [console.cloud.google.com](https://console.cloud.google.com) → arriba, crea/selecciona un **proyecto** (ej. `finanzas-bot`). **Ignora** el banner de crédito de 300 $ / no hace falta facturación.
2. Buscador → **Google Sheets API** → **Habilitar**.
3. Menú → **API y servicios → Credenciales → Crear credenciales → Cuenta de servicio** → nombre `bot-finanzas` → Crear → (sin rol) → Listo.
4. Clic en la cuenta creada → pestaña **Claves → Agregar clave → JSON** → se descarga un `.json`. **Guárdalo, es secreto.**
5. Del `.json`: `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`; `private_key` → `GOOGLE_PRIVATE_KEY`.
6. **MUY IMPORTANTE:** abre el Google Sheet del usuario → **Compartir** → pega el `client_email` como **Editor**. (Sin esto, el bot da error 404.)

## C) Clave de Gemini (gratis)
1. [aistudio.google.com/apikey](https://aistudio.google.com/apikey) → **Crear clave de API** → elige un proyecto (vale el "Default Gemini Project", nivel gratuito). → `GEMINI_API_KEY`.

## D) WhatsApp Cloud API (Meta) — la parte más larga
1. [developers.facebook.com](https://developers.facebook.com) → **Mis aplicaciones → Crear aplicación** → caso de uso **"Conectarte con los clientes a través de WhatsApp"** → portfolio personal → nombre → crear.
2. **WhatsApp → Configuración básica (Paso 1. Pruébalo):**
   - Apunta el **Identificador del número de teléfono** (Phone Number ID) → `WHATSAPP_PHONE_NUMBER_ID`.
   - Apunta el **WhatsApp Business Account ID (WABA ID)** (lo necesitarás en el paso D6).
   - En **Destinatario → Administrar lista** → añade el **móvil de P1** y el de **P2** (llega un código por WhatsApp a cada uno; verifícalos).
3. **Token permanente:** [business.facebook.com/settings](https://business.facebook.com/settings) → **Usuarios → Usuarios del sistema** → **Agregar** (`bot-finanzas`, rol **Admin**) → **Asignar activos**: elige **Apps** (tu app, Control total) **y** **Cuentas de WhatsApp** (la de prueba, Control total) → Guardar → **Generar token** → app = tu app, caducidad **Nunca**, permisos **`whatsapp_business_messaging`** y **`whatsapp_business_management`** → Generar → cópialo (`EAA...`) → `WHATSAPP_TOKEN`. **Es secreto.**
4. Inventa una palabra para `WHATSAPP_VERIFY_TOKEN` (ej. `finanzas-2026`). Apúntala.
5. **Registrar el número** (si no, al enviar da error 133010 "Account not registered"). En el **Graph API Explorer** (developers.facebook.com/tools/explorer) o por terminal, haz un **POST**:
   `https://graph.facebook.com/v21.0/{WHATSAPP_PHONE_NUMBER_ID}/register`
   con cuerpo JSON: `{"messaging_product":"whatsapp","pin":"135790"}` (con tu token). Debe responder `{"success":true}`.
6. **Suscribir la app a la WABA** (si no, NO llegan los mensajes al bot). POST:
   `https://graph.facebook.com/v21.0/{WABA_ID}/subscribed_apps` (con tu token). Debe responder `{"success":true}`.

## E) Desplegar el bot en Vercel
1. [vercel.com](https://vercel.com) → inicia sesión con la cuenta del usuario (puede ser con GitHub) → **Add New → Project** → **Import** el repo `Daarry/finanzas-pareja-bot` (búscalo o pega la URL; al ser público se puede importar).
2. Antes de **Deploy**, abre **Environment Variables** y añade estas (production):

| Variable | Valor |
|---|---|
| `GOOGLE_SHEET_ID` | ID de la hoja (paso A3) |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `client_email` del JSON |
| `GOOGLE_PRIVATE_KEY` | `private_key` del JSON (tal cual, con los `\n`) |
| `GEMINI_API_KEY` | clave de Gemini |
| `WHATSAPP_TOKEN` | token permanente `EAA...` |
| `WHATSAPP_PHONE_NUMBER_ID` | Phone Number ID |
| `WHATSAPP_VERIFY_TOKEN` | la palabra que inventaste |
| `PERSON1` | nombre de P1 (igual que en el Excel) |
| `PERSON2` | nombre de P2 (igual que en el Excel) |
| `WA_PERSON1` | móvil de P1 (internacional, sin `+`, ej. `34666111222`) |
| `WA_PERSON2` | móvil de P2 |

3. **Deploy**. Te queda una URL `https://tu-proyecto.vercel.app`.

## F) Conectar el webhook en Meta
1. En la app de Meta → **WhatsApp → Configuración → Webhook (Paso 2)**:
   - Callback URL: `https://tu-proyecto.vercel.app/api/webhook`
   - Verify token: el `WHATSAPP_VERIFY_TOKEN`.
   - **Verificar y guardar** (debe verificar OK).
2. En **Campos de webhook** → suscríbete a **messages** (toggle ON).

## G) Probar
1. Desde el WhatsApp de P1, escribe al **número del bot** (el de prueba, +1 …): «40 cena común».
2. El bot debe responder «🧾 Apuntado…» y aparecer la fila en la hoja **Movimientos**.
3. Prueba «cómo vamos», «cuánto hay en las cuentas». Repite con P2 desde su móvil.

---

## ⚠️ Fallos típicos (revisa aquí si algo no va)
- **El bot no escribe en la hoja (404):** no compartiste el Sheet con el `client_email` como Editor, o el `GOOGLE_SHEET_ID` tiene un carácter mal (I/l, O/0).
- **El bot no responde nada:** falta **registrar el número** (D5) o **suscribir la app a la WABA** (D6). Sin la suscripción, no llega ningún mensaje al webhook.
- **Responde pero pone "undefined"/no coge el importe:** ya está resuelto en el código (extrae el número por reglas). Si pasa, revisa que desplegaste la última versión del repo.
- **Error de Gemini 429 "limit 0":** el modelo `gemini-2.0-flash` no tiene cuota gratis; el código ya usa `gemini-2.5-flash-lite` con cascada. No cambies el modelo.
- **Los nombres salen como "Darry"/"Mimi":** no hiciste el Buscar y reemplazar (A2) o `PERSON1`/`PERSON2` no coinciden con los del Excel. Deben ser IGUALES.
- **Recordatorios:** los mensajes que inicia el bot fuera de 24h necesitan plantilla de Meta; para uso normal (el usuario escribe primero) funciona sin más.

## Cómo funciona (para el usuario)
- **Apuntar:** «40 cena común» · «nómina 1450» · «gimnasio 35 fijo» · «le he pasado 100 a [pareja]» · «nuevo objetivo viaje 2000» · «deuda tarjeta 600 cuota 50» · «el IBI son 400 al año».
- **Corregir:** «el último es personal».
- **Casa:** «la casa vale 200000, en 5 años» · «podemos ahorrar 500 al mes».
- **Preguntar:** «cómo vamos» · «cuánto se debe» · «cuánto hay en las cuentas» · «cómo va el fondo» · «cuánto nos falta para la casa» · «cuál es nuestro patrimonio».
