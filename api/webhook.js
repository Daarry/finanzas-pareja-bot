// Webhook de WhatsApp Cloud API: verifica (GET) y recibe mensajes (POST).
import { personFromNumber, otherPerson, P1, P2 } from "../lib/people.js";
import { parseMessage } from "../lib/parse.js";
import { appendMovement, resumenMes, saldos, currentMonth, addObjetivo, addDeuda, fondoEmergencia, listObjetivos, listDeudas, updateLastTipo, updateLastCategoria, prevision, setCasa, readCasa, addCompraGrande, addFondo, readAmortizacion, readPatrimonio } from "../lib/sheets.js";
import { sendText } from "../lib/whatsapp.js";
import { categorize, conceptoFrom, tipoFromText, liquidacionQuien, transferTipo } from "../lib/categorize.js";
import { CATEGORIAS, classifyCategory } from "../lib/parse.js";

const nums = (t) => [...(t || "").matchAll(/\d+(?:[.,]\d{1,2})?/g)].map((x) => parseFloat(x[0].replace(",", ".")));
const cleanName = (t) =>
  (t || "")
    .replace(/\d+(?:[.,]\d{1,2})?\s*€?/g, "")
    .replace(/\b(nuevo|nueva|objetivo|meta|ahorro|ahorrar|para|un|una|deuda|prestamo|préstamo|cuota|interes|interés|de|del|la|el|tenemos|tengo|añade|mete|metiendo|al mes|mensual)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

const seen = new Set(); // de-dup básico por instancia caliente

function todayISO() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" }); // YYYY-MM-DD
}

const HELP =
  "👋 Soy el bot de Finanzas Pareja. Apunta cosas:\n" +
  "• «40 cena fuera, común» (gasto compartido)\n" +
  "• «nómina 1450» (ingreso)\n" +
  "• «gimnasio 35, fijo» (gasto fijo tuyo)\n" +
  "• «le he pasado 100 a " + P2 + "» (liquidación)\n" +
  "• «nuevo objetivo viaje 2000» (meta de ahorro)\n" +
  "• «deuda tarjeta 600 cuota 50» (deuda)\n" +
  "• «el último es personal» (corrige el tipo del último)\n" +
  "• «la casa vale 200000, en 5 años» · «podemos ahorrar 500 al mes» (plan de casa)\n" +
  "• «quiero comprar un sofá de 800» (compra grande a decidir)\n\n" +
  "💡 Truco: añade *común*, *personal* o *fijo* al mensaje y lo respeto siempre.\n\n" +
  "Y pregunta:\n" +
  "• «cómo vamos este mes»\n" +
  "• «cuánto se debe» · «cuánto hay en las cuentas»\n" +
  "• «cómo va el fondo» · «qué objetivos/deudas tenemos»";

export default async function handler(req, res) {
  // --- Verificación del webhook (Meta) ---
  if (req.method === "GET") {
    const { ["hub.mode"]: mode, ["hub.verify_token"]: token, ["hub.challenge"]: challenge } = req.query;
    if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send("forbidden");
  }
  if (req.method !== "POST") return res.status(405).end();

  // Responde rápido a Meta; procesamos después.
  try {
    const msg = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg || msg.type !== "text") return res.status(200).end();
    if (seen.has(msg.id)) return res.status(200).end();
    seen.add(msg.id);

    const from = msg.from;
    const person = personFromNumber(from);
    if (!person) return res.status(200).end(); // número no autorizado: ignorar

    await handleMessage(from, person, msg.text.body.trim());
    return res.status(200).end();
  } catch (e) {
    console.error("webhook error", e);
    return res.status(200).end();
  }
}

async function handleMessage(from, person, text) {
  let p;
  try {
    p = await parseMessage(text);
  } catch (e) {
    console.error("parse error", e);
    return sendText(from, "Uy, no te he entendido. " + HELP);
  }

  if (p.intent === "registrar") {
    let importe = Number(p.importe) || 0;
    if (importe <= 0) {
      const num = text.match(/\d+(?:[.,]\d{1,2})?/); // primer número del texto (40, 40€, 40,50)
      if (num) importe = parseFloat(num[0].replace(",", "."));
    }
    if (!importe || importe <= 0) return sendText(from, "¿Qué importe? Ej: «40 cena, común».");
    // Prioridad tipo: transferencia/bizum (por destinatario) → palabra clave → IA → Común
    const tipo = transferTipo(text, P1, P2) || tipoFromText(text) || p.tipo || "Común";
    // Categoría: IA principal (si no es "Otros") → palabras clave → clasificador IA → Otros
    let categoria = p.categoria && p.categoria !== "Otros" ? p.categoria : categorize(text);
    if (!categoria) categoria = await classifyCategory(p.concepto || text);
    if (!categoria) categoria = tipo === "Ingreso" ? "Otro ingreso" : "Otros";
    const other = otherPerson(person);
    const quien = tipo === "Liquidación" ? liquidacionQuien(text, person, other) : p.quien || person;
    const fecha = /^\d{4}-\d{2}-\d{2}$/.test(p.fecha || "") ? p.fecha : todayISO();
    const concepto = p.concepto || conceptoFrom(text) || categoria;
    try {
      await appendMovement({ fecha, tipo, categoria, concepto, importe, quien });
    } catch (e) {
      console.error("append error", e);
      return sendText(from, "No he podido apuntarlo en la hoja 😕 (revisa permisos del bot).");
    }
    const emo = tipo === "Ingreso" ? "💰" : tipo === "Liquidación" ? "🔁" : "🧾";
    return sendText(
      from,
      `${emo} Apuntado:\n• ${tipo} — ${categoria}\n• ${importe} € (${concepto})\n• Pagó: ${quien} · ${fecha}`
    );
  }

  if (p.intent === "objetivo") {
    const n = nums(text);
    const meta = Number(p.meta) || n[0] || 0;
    const aportacion = Number(p.aportacion) || n[1] || 0;
    const nombre = p.nombre || cleanName(text) || "Objetivo";
    if (meta <= 0) return sendText(from, "¿Cuánto quieres ahorrar? Ej: «nuevo objetivo viaje 2000».");
    try {
      await addObjetivo({ nombre, meta, aportacion });
    } catch {
      return sendText(from, "No pude añadir el objetivo (puede que ya tengáis 6).");
    }
    return sendText(from, `🎯 Objetivo añadido:\n• ${nombre}\n• Meta: ${meta} €${aportacion ? `\n• Ahorro: ${aportacion} €/mes` : ""}`);
  }

  if (p.intent === "deuda") {
    const n = nums(text);
    const saldo = Number(p.saldo) || n[0] || 0;
    const cuota = Number(p.cuota) || n[1] || 0;
    let interes = Number(p.interes) || 0;
    if (interes > 1) interes = interes / 100; // 18 -> 0.18
    const nombre = p.nombre || cleanName(text) || "Deuda";
    if (saldo <= 0) return sendText(from, "¿De cuánto es la deuda? Ej: «deuda tarjeta 600 cuota 50».");
    try {
      await addDeuda({ nombre, saldo, cuota, interes: interes || "" });
    } catch {
      return sendText(from, "No pude añadir la deuda (puede que ya tengáis 6).");
    }
    return sendText(from, `💳 Deuda añadida:\n• ${nombre}\n• Saldo: ${saldo} €${cuota ? `\n• Cuota: ${cuota} €/mes` : ""}`);
  }

  if (p.intent === "casa") {
    const n = nums(text);
    let precio = Number(p.casa_precio) || null;
    let anios = Number(p.casa_anios) || null;
    let mensual = Number(p.casa_ahorro_mensual) || null;
    let ahorrado = Number(p.casa_ahorrado) || null;
    if (precio == null && anios == null && mensual == null && ahorrado == null && n.length) {
      const t = text.toLowerCase(); const v = n[0];
      if (/a[ñn]os?/.test(t)) anios = v;
      else if (/al mes|mensual|cada mes/.test(t)) mensual = v;
      else if (/ahorrad|llevamos|tenemos/.test(t)) ahorrado = v;
      else precio = v;
    }
    const ok = await setCasa({ precio, anios, ahorroMensual: mensual, ahorrado });
    if (!ok) return sendText(from, "¿Qué dato de la casa? Ej: «la casa vale 200000», «en 5 años», «podemos ahorrar 500 al mes».");
    const c = await readCasa();
    return sendText(from, `🏡 Plan de casa actualizado:\n• Total a ahorrar: ${c.total}\n• Falta: ${c.falta}\n• Ahorro/mes necesario: ${c.mensualNecesario}`);
  }

  if (p.intent === "compra_grande") {
    const importe = Number(p.importe) || nums(text)[0] || 0;
    const nombre = p.nombre || cleanName(text) || "Compra";
    if (importe <= 0) return sendText(from, "¿De cuánto es la compra? Ej: «quiero comprar un sofá de 800».");
    try {
      await addCompraGrande({ nombre, importe });
    } catch {
      return sendText(from, "La lista de compras grandes está llena (máx 6).");
    }
    return sendText(from, `🛒 Compra grande anotada:\n• ${nombre}: ${importe} €\n📌 Regla: los dos de acuerdo + esperad 24-72h antes de pagar.`);
  }

  if (p.intent === "amortizacion") {
    const costeAnual = Number(p.coste_anual) || nums(text)[0] || 0;
    const nombre = p.nombre || cleanName(text) || "Fondo";
    if (costeAnual <= 0) return sendText(from, "¿Cuánto al año? Ej: «el IBI son 400 al año».");
    try {
      await addFondo({ nombre, costeAnual });
    } catch {
      return sendText(from, "La lista de fondos está llena (máx 10).");
    }
    return sendText(from, `🗓️ Fondo añadido:\n• ${nombre}: ${costeAnual} €/año\n• Aparta ${(costeAnual / 12).toFixed(2)} €/mes y no te pillará por sorpresa.`);
  }

  if (p.intent === "corregir") {
    const nuevaCat = (p.correccion_categoria && CATEGORIAS.includes(p.correccion_categoria)) ? p.correccion_categoria : categorize(text);
    const nuevoTipo = p.correccion_tipo || tipoFromText(text);
    if (nuevaCat) {
      const upd = await updateLastCategoria(person, nuevaCat);
      if (!upd) return sendText(from, "No encuentro ningún movimiento tuyo que corregir.");
      return sendText(from, `✏️ Corregido: tu último apunte (${upd.concepto || ""} ${upd.importe || ""}) ahora es categoría *${nuevaCat}*.`);
    }
    if (nuevoTipo) {
      const upd = await updateLastTipo(person, nuevoTipo);
      if (!upd) return sendText(from, "No encuentro ningún movimiento tuyo que corregir.");
      return sendText(from, `✏️ Corregido: tu último apunte (${upd.concepto || ""} ${upd.importe || ""}) ahora es *${nuevoTipo}*.`);
    }
    return sendText(from, "¿Qué cambio? Ej: «el último es personal» (tipo) o «el último es ocio» (categoría).");
  }

  if (p.intent === "consulta") {
    if (p.consulta === "saldo") {
      const s = await saldos();
      return sendText(from, `💳 En las cuentas:\n• ${P1}: ${s.darry || "—"}\n• ${P2}: ${s.mimi || "—"}`);
    }
    if (p.consulta === "categorias") {
      return sendText(from, "🏷️ Categorías disponibles:\n" + CATEGORIAS.map((c) => "• " + c).join("\n"));
    }
    if (p.consulta === "patrimonio") {
      const pat = await readPatrimonio();
      return sendText(from, `💰 Patrimonio neto:\n• Activos: ${pat.activos}\n• Deudas: ${pat.pasivos}\n• *Neto: ${pat.neto}*`);
    }
    if (p.consulta === "amortizacion") {
      const a = await readAmortizacion();
      return sendText(from, `🗓️ Gastos anuales (amortización):\n• Apartar al mes: ${a.mensual}\n• Total anual: ${a.anual}`);
    }
    if (p.consulta === "casa") {
      const c = await readCasa();
      return sendText(from, `🏡 Plan de casa:\n• Total a ahorrar: ${c.total}\n• Falta: ${c.falta}\n• Ahorro/mes necesario: ${c.mensualNecesario}\n• Cuota estimada: ${c.cuota} (máx recomendada ${c.cuotaMax})\n• ${c.veredicto}`);
    }
    if (p.consulta === "prevision") {
      const pv = await prevision();
      return sendText(from, `🏠 Gastos de casa (este mes):\n• Previsto: ${pv.previsto}\n• Pagado: ${pv.pagado}\n• Queda por pagar: ${pv.queda}`);
    }
    if (p.consulta === "fondo") {
      const f = await fondoEmergencia();
      return sendText(from, `🛟 Fondo de emergencia:\n• Ahorrado: ${f.saldo} (de ${f.objetivo})\n• Completado: ${f.completado}\n• Falta: ${f.falta}`);
    }
    if (p.consulta === "objetivos") {
      const o = await listObjetivos();
      if (!o.length) return sendText(from, "🎯 Aún no tenéis objetivos de ahorro.");
      return sendText(from, "🎯 Objetivos:\n" + o.map((x) => `• ${x[0]}: ${x[2] || 0}/${x[1]} (falta ${x[3] || x[1]})`).join("\n"));
    }
    if (p.consulta === "deudas") {
      const d = await listDeudas();
      if (!d.items.length) return sendText(from, "💳 No tenéis deudas registradas. 🎉");
      return sendText(from, "💳 Deudas:\n" + d.items.map((x) => `• ${x[0]}: ${x[1]}`).join("\n") + `\nTotal: ${d.total}`);
    }
    const mes = /^\d{4}-\d{2}$/.test(p.mes || "") ? p.mes : currentMonth();
    const r = await resumenMes(mes);
    if (!r) return sendText(from, `No tengo datos del mes ${mes}.`);
    if (p.consulta === "deuda") {
      return sendText(from, `🔁 Mes ${mes}:\n${r.quienDebe || "Saldados"}\n(acumulado: ${r.acumulado || "0 €"})`);
    }
    return sendText(
      from,
      `📊 ${mes}:\n• Ingresos: ${r.ingresos}\n• Gastos: ${r.gastos}\n• Balance: ${r.balance}\n• ${r.quienDebe || "Saldados"}`
    );
  }

  return sendText(from, HELP);
}
