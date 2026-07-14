// Categorización por palabras clave (determinista) y limpieza de concepto.
// Se usa como respaldo cuando la IA no rellena categoria/concepto.

const MAP = [
  ["Bizum", ["bizum"]],
  ["Impuestos/Tasas", ["hacienda", "impuesto", "impuestos", "irpf", "itp", "seguridad social", "autonomo", "autónomo", "sancion", "sanción", "tasas", "renfe tasa"]],
  ["Alquiler/Hipoteca", ["alquiler", "hipoteca", "renta", "casero", "mensualidad piso"]],
  ["Luz", ["luz", "electricidad", "endesa", "iberdrola", "naturgy", "recibo luz", "factura luz"]],
  ["Agua", ["agua", "recibo agua", "factura agua"]],
  ["Internet/Móvil", ["internet", "fibra", "movil", "móvil", "telefono", "teléfono", "datos moviles", "movistar", "vodafone", "orange", "yoigo", "tarifa movil", "recarga", "wifi", "router"]],
  ["Comunidad", ["comunidad", "vecinos", "derrama"]],
  ["Seguros", ["seguro", "seguros", "mapfre", "mutua", "poliza", "póliza"]],
  ["Suscripciones", ["netflix", "spotify", "hbo", "disney", "amazon prime", "youtube premium", "suscripcion", "suscripción", "icloud", "apple cloud", "google one", "dropbox", "dazn", "playstation plus", "xbox", "chatgpt"]],
  ["Gimnasio", ["gimnasio", "gym", "crossfit", "padel", "pádel", "pilates", "yoga", "natacion", "natación", "piscina"]],
  ["Transporte/Gasolina", ["gasolina", "gasoil", "diesel", "diésel", "repostar", "parking", "peaje", "autobus", "autobús", "metro", "taxi", "uber", "cabify", "tren", "billete", "itv", "taller mecanico", "gasolinera", "moto", "cercanias", "cercanías", "abono transporte", "blablacar", "grua", "grúa", "multa"]],
  ["Gas", ["gas", "butano", "caldera"]],
  ["Salud", ["farmacia", "medico", "médico", "dentista", "optica", "óptica", "medicina", "medicamento", "fisio", "psicologo", "psicólogo", "analisis", "análisis", "gafas", "lentillas", "vacuna"]],
  ["Ocio", ["cena", "cenar", "comer fuera", "restaurante", "bar", "copas", "copa", "cerveza", "cañas", "vino", "cine", "concierto", "teatro", "museo", "viaje", "hotel", "airbnb", "finde", "escapada", "excursion", "excursión", "regalo", "cumpleaños", "boda", "ocio", "fiesta", "discoteca", "desayuno", "merienda", "almuerzo", "brunch", "cafeteria", "cafetería", "café", "escape room", "bolos"]],
  ["Ropa", ["ropa", "zapatos", "zapatillas", "zara", "primark", "complementos", "gorra", "gorro", "calcetines", "camiseta", "camisa", "pantalon", "pantalón", "sudadera", "chaqueta", "jersey", "vestido", "falda", "abrigo", "bufanda", "calzoncillo", "braga", "sujetador", "bikini", "bañador", "bambas", "botas", "cinturon", "cinturón", "chandal", "chándal"]],
  ["Mascotas", ["perro", "gato", "veterinario", "pienso", "mascota", "arena gato", "correa", "peluqueria canina"]],
  ["Cuidado personal", ["peluqueria", "peluquería", "peluquero", "barberia", "barbería", "barbero", "corte de pelo", "manicura", "pedicura", "depilacion", "depilación", "estetica", "estética", "cosmetica", "cosmética", "maquillaje", "perfume", "masaje", "uñas"]],
  ["Supermercado", ["super", "supermercado", "mercadona", "lidl", "carrefour", "alcampo", "consum", "aldi", "eroski", "hipercor", "compra semanal", "la compra", "fruteria", "frutería", "pescaderia", "carniceria", "carnicería", "despensa"]],
  ["Préstamo mamá", ["prestamo mama", "préstamo mamá", "prestamo de mama", "préstamo de mamá", "coche mama", "coche mamá"]],
  ["Préstamo personal", ["prestamo", "préstamo", "financiacion", "financiación", "credito personal", "crédito personal"]],
  ["Nómina", ["nomina", "nómina", "sueldo", "salario", "paga"]],
  ["Paro", ["paro", "desempleo", "prestacion", "prestación", "sepe"]],
  ["Ahorro", ["ahorro", "hucha", "traspaso ahorro", "cuenta ahorro", "apartar a ahorro"]],
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
  if (/\b(n[oó]mina|sueldo|salario|paga extra|paro|prestaci[oó]n|ingreso|reembolso|devoluci[oó]n|me ha ingresado|me ingres[oó])\b/.test(t)) return "Ingreso";
  return null;
}

// Decide el tipo de una transferencia/bizum según el destinatario (determinista).
// - A la PAREJA (p1/p2) -> Liquidación.  - A un TERCERO -> Personal (envío) o Ingreso (recibo).
export function transferTipo(text, p1, p2) {
  const t = (text || "").toLowerCase();
  const isBizum = /\bbizum\b/.test(t);
  const otherVerbs = /\b(le he pasado|le he dado|le pago|pago a|paga a|transferencia|le mando|le env[ií]o|me ha pasado|me han pasado|me ha transferido|me ha devuelto|me devolvi[oó]|me ha ingresado|me han ingresado|me lo ha pasado)\b/.test(t);
  if (!isBizum && !otherVerbs) return null;
  const toPartner = new RegExp(`\\b(${p1.toLowerCase()}|${p2.toLowerCase()})\\b`).test(t);
  const recibido = /\b(bizum de|de parte de|me ha|me han|me lo ha|recib|me hizo)\b/.test(t);
  const enviado = /\b(bizum a|le he|he enviado|enviad|pago a|paga a|le mando|le env[ií]o|transferencia a)\b/.test(t);
  if (recibido && !enviado) return toPartner ? "Liquidación" : "Ingreso";
  if (enviado && !recibido) return toPartner ? "Liquidación" : "Personal";
  if (isBizum) return "AMBIGUO"; // bizum sin dirección clara → preguntar
  return toPartner ? "Liquidación" : "Personal"; // otra transferencia sin dirección: por defecto enviado
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
