// Recordatorios automáticos (Vercel Cron, 1 vez/día).
// OJO: los mensajes que INICIA el bot fuera de la ventana de 24h necesitan una
// plantilla aprobada en Meta. Esto es "best-effort": funciona si habéis escrito
// al bot en las últimas 24h. Para garantizarlo, crea una plantilla utility en Meta.
import { resumenMes, currentMonth } from "../lib/sheets.js";
import { sendText } from "../lib/whatsapp.js";

const madrid = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(d);

export default async function handler(req, res) {
  try {
    const recipients = [process.env.WA_DARRY, process.env.WA_MIMI].filter(Boolean);
    const today = madrid(new Date());
    const day = parseInt(today.slice(8, 10), 10);
    const month = today.slice(0, 7);
    const tomorrowMonth = madrid(new Date(Date.now() + 86400000)).slice(0, 7);
    const isLastDay = tomorrowMonth !== month;

    let text = null;

    if (day === 1) {
      text =
        "📅 ¡Nuevo mes! Acordaos de apuntar las *nóminas* (escribid «nómina 1450») y los *gastos fijos*. " +
        "Preguntadme «cómo vamos» cuando queráis.";
    } else if (isLastDay) {
      const r = await resumenMes(currentMonth());
      if (r && r.quienDebe && r.quienDebe !== "Saldados") {
        text =
          `🔁 Fin de mes. ${r.quienDebe} (acumulado: ${r.acumulado || "—"}). ` +
          "Cuando lo saldéis, escribidme «le he pasado X a ...».";
      }
    }

    if (text) {
      for (const to of recipients) await sendText(to, text);
    }
    return res.status(200).json({ ok: true, sent: !!text, day });
  } catch (e) {
    console.error("cron error", e);
    return res.status(200).json({ ok: false });
  }
}
