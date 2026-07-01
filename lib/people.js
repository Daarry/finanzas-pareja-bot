// Mapea el número de WhatsApp del remitente a la persona (Darry / Mimi).
// Solo estos dos números pueden usar el bot.

const norm = (n) => (n || "").replace(/[^0-9]/g, "");

const MAP = {
  [norm(process.env.WA_DARRY)]: "Darry",
  [norm(process.env.WA_MIMI)]: "Mimi",
};

export function personFromNumber(waNumber) {
  return MAP[norm(waNumber)] || null; // null = número no autorizado
}
