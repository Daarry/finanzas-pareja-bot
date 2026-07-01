// Categorización por palabras clave (determinista) y limpieza de concepto.
// Se usa como respaldo cuando la IA no rellena categoria/concepto.

const MAP = [
  ["Alquiler/Hipoteca", ["alquiler", "hipoteca", "renta", "casero", "piso"]],
  ["Luz", ["luz", "electricidad", "endesa", "iberdrola", "naturgy"]],
  ["Agua", ["agua"]],
  ["Internet/Móvil", ["internet", "fibra", "movil", "móvil", "telefono", "teléfono", "datos", "movistar", "vodafone", "orange", "yoigo", "tarifa"]],
  ["Comunidad", ["comunidad", "vecinos", "derrama"]],
  ["Seguros", ["seguro", "seguros", "mapfre", "mutua", "poliza", "póliza"]],
  ["Supermercado", ["super", "supermercado", "mercadona", "lidl", "carrefour", "alcampo", "consum", "compra", "comida"]],
  ["Transporte/Gasolina", ["gasolina", "gasoil", "diesel", "diésel", "repostar", "parking", "peaje", "bus", "metro", "taxi", "uber", "cabify", "tren", "billete", "itv", "taller", "coche", "moto"]],
  ["Gas", ["gas", "butano", "caldera"]],
  ["Salud", ["farmacia", "medico", "médico", "dentista", "optica", "óptica", "medicina", "fisio", "medicamento"]],
  ["Ocio", ["cena", "cenar", "comer fuera", "restaurante", "bar", "copas", "cine", "concierto", "viaje", "hotel", "finde", "escapada", "regalo", "ocio", "fiesta", "discoteca"]],
  ["Ropa", ["ropa", "zapatos", "zapatillas", "zara", "primark", "complementos"]],
  ["Mascotas", ["perro", "gato", "veterinario", "pienso", "mascota"]],
  ["Suscripciones", ["netflix", "spotify", "hbo", "disney", "prime", "youtube", "suscripcion", "suscripción", "max"]],
  ["Gimnasio", ["gimnasio", "gym", "crossfit", "padel", "pádel"]],
  ["Préstamo personal", ["prestamo", "préstamo", "financiacion", "financiación", "credito", "crédito"]],
  ["Nómina", ["nomina", "nómina", "sueldo", "salario", "paga"]],
  ["Paro", ["paro", "desempleo", "prestacion", "prestación", "sepe"]],
  ["Otro ingreso", ["devolucion", "devolución", "reembolso", "transferencia", "ingreso"]],
];

export function categorize(text) {
  const t = (text || "").toLowerCase();
  for (const [cat, kws] of MAP) if (kws.some((k) => t.includes(k))) return cat;
  return null;
}

// Detecta el TIPO por palabras clave explícitas (manda sobre la IA).
export function tipoFromText(text) {
  const t = (text || "").toLowerCase();
  if (/\b(liquidaci[oó]n|le he pasado|te he pasado|te paso|le paso|me ha pasado|me paso|me ha hecho un traspaso|me hizo un traspaso|traspaso|me ha transferido|me transfiri[oó]|devuelvo|devuelto|saldar)\b/.test(t)) return "Liquidación";
  if (/\b(fijo|fija)\b/.test(t)) return "Fijo personal";
  if (/\b(personal|capricho|m[ií]o|m[ií]a|solo yo|para m[ií])\b/.test(t)) return "Personal";
  if (/\b(com[uú]n|compartido|de casa|juntos|de los dos)\b/.test(t)) return "Común";
  if (/\b(n[oó]mina|sueldo|salario|paga extra|paro|prestaci[oó]n)\b/.test(t)) return "Ingreso";
  return null;
}

// Para una Liquidación, decide quién ENTREGA el dinero (el otro me pagó, o yo le pagué).
export function liquidacionQuien(text, person, other) {
  const t = (text || "").toLowerCase();
  const mePago = /\bme (ha |han )?(pasado|hecho|transferido|ingresado|dado|devuelto)|traspaso de|transferencia de|me lo (ha |han )?(pasado|dado)\b/.test(t) || t.includes("de " + other.toLowerCase());
  return mePago ? other : person; // por defecto, quien escribe es quien entregó
}

// Concepto corto a partir del texto: quita el número y palabras de control.
export function conceptoFrom(text) {
  const c = (text || "")
    .replace(/\d+(?:[.,]\d{1,2})?\s*€?/, "")
    .replace(/\b(comun|común|personal|fijo|fija|de|he|pagado|gastado|euros?)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return c ? c.charAt(0).toUpperCase() + c.slice(1, 40) : null;
}
