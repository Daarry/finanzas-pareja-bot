// Interpreta el mensaje de WhatsApp con Google Gemini (nivel gratuito de Google AI Studio).
import { P1, P2 } from "./people.js";
const MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-flash-latest"];
const urlFor = (m) => `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`;

export const TIPOS = ["Ingreso", "Fijo personal", "Común", "Personal", "Liquidación"];
export const CATEGORIAS = [
  "Nómina", "Paro", "Otro ingreso",
  "Alquiler/Hipoteca", "Luz", "Agua", "Gas", "Internet/Móvil", "Comunidad", "Seguros",
  "Supermercado", "Transporte/Gasolina", "Salud", "Ocio", "Ropa", "Mascotas",
  "Suscripciones", "Gimnasio", "Préstamo personal", "Bizum", "Impuestos/Tasas", "Cuidado personal", "Otros",
];

const schema = {
  type: "OBJECT",
  properties: {
    intent: { type: "STRING", enum: ["registrar", "objetivo", "deuda", "casa", "compra_grande", "amortizacion", "consulta", "corregir", "borrar", "ayuda"] },
    coste_anual: { type: "NUMBER", description: "Coste anual del fondo de amortización (intent=amortizacion)." },
    correccion_tipo: { type: "STRING", enum: TIPOS, description: "Nuevo TIPO al corregir el último movimiento (común/personal/fijo/ingreso/liquidación)." },
    correccion_categoria: { type: "STRING", enum: CATEGORIAS, description: "Nueva CATEGORÍA al corregir el último movimiento (ocio, supermercado, etc.)." },
    casa_precio: { type: "NUMBER", description: "Precio objetivo de la vivienda (intent=casa)." },
    casa_anios: { type: "NUMBER", description: "Años objetivo para comprar (intent=casa)." },
    casa_ahorro_mensual: { type: "NUMBER", description: "Ahorro mensual que pueden destinar a la casa (intent=casa)." },
    casa_ahorrado: { type: "NUMBER", description: "Cuánto llevan ahorrado para la casa (intent=casa)." },
    tipo: { type: "STRING", enum: TIPOS },
    categoria: { type: "STRING", enum: CATEGORIAS },
    concepto: { type: "STRING" },
    importe: { type: "NUMBER", description: "El número de euros. Si el mensaje contiene un número, va aquí SIEMPRE." },
    fecha: { type: "STRING", description: "ISO YYYY-MM-DD si la menciona, si no vacío" },
    quien: { type: "STRING", enum: [P1, P2] },
    consulta: { type: "STRING", enum: ["resumen", "deuda", "saldo", "fondo", "objetivos", "deudas", "prevision", "casa", "patrimonio", "amortizacion", "categorias", "gastos", "gastos_casa"] },
    mes: { type: "STRING", description: "YYYY-MM si lo menciona" },
    nombre: { type: "STRING", description: "Nombre del objetivo de ahorro o de la deuda." },
    meta: { type: "NUMBER", description: "Cantidad objetivo a ahorrar (intent=objetivo)." },
    aportacion: { type: "NUMBER", description: "Aportación mensual al objetivo (intent=objetivo)." },
    saldo: { type: "NUMBER", description: "Saldo pendiente de la deuda (intent=deuda)." },
    cuota: { type: "NUMBER", description: "Cuota mensual de la deuda (intent=deuda)." },
    interes: { type: "NUMBER", description: "Interés % de la deuda (intent=deuda)." },
  },
  required: ["intent"],
};

const SYSTEM = `Eres el asistente de un Excel de finanzas de una pareja (${P1} y ${P2}). Devuelves SIEMPRE JSON.

INTENT:
- "registrar": un gasto, ingreso o liquidación. RELLENA SIEMPRE: importe, concepto, tipo y categoria.
- "objetivo": quiere AÑADIR un nuevo objetivo de ahorro (ej. "nuevo objetivo viaje 2000"). Rellena nombre, meta y aportacion (si la dice).
- "deuda": quiere AÑADIR una nueva deuda o préstamo (ej. "tengo una deuda tarjeta 600 cuota 50"). Rellena nombre, saldo, cuota e interes (si los dice).
- "consulta": pregunta por el estado:
  · "resumen" = cómo vamos / balance del mes.
  · "deuda" = quién debe a quién entre vosotros / cuánto os debéis.
  · "saldo" = cuánto hay en vuestras cuentas personales.
  · "fondo" = cómo va el fondo de emergencia.
  · "objetivos" = lista de objetivos de ahorro.
  · "deudas" = lista de deudas/préstamos pendientes.
  · "prevision" = gastos de casa previstos del mes / cuánto queda por pagar de casa.
  · "casa" = plan de compra de casa (cuánto falta, cuánto ahorrar al mes, qué hipoteca podemos pagar).
  · "categorias" = qué categorías existen para clasificar los gastos.
  · "gastos" = cuánto ha gastado cada uno este mes en total (por persona).
  · "gastos_casa" = cuánto ha gastado cada uno SOLO en gastos de casa (comunes), por persona.
- "borrar": quiere ELIMINAR el último movimiento que apuntó ("borra el último", "elimina el último gasto", "quita eso").
- "casa": configura el PLAN de compra de casa. Rellena lo que diga: casa_precio (precio de la vivienda), casa_anios (en cuántos años), casa_ahorro_mensual (cuánto pueden ahorrar al mes para la casa), casa_ahorrado (cuánto llevan ahorrado para la casa).
- "compra_grande": quiere apuntar una compra grande futura a decidir con calma (aún no la ha pagado). Rellena nombre e importe.
- "amortizacion": quiere añadir un fondo de amortización = un gasto ANUAL que quiere prorratear por meses (IBI, seguro anual, ITV, Navidad...). Rellena nombre y coste_anual.
  Consultas nuevas: "patrimonio" (cuánto tenemos en total / patrimonio neto), "amortizacion" (cuánto apartar al mes para los gastos anuales).
- "corregir": quiere CAMBIAR el último gasto que apuntó. Puede ser:
  · el TIPO ("el último es personal", "cámbialo a fijo", "no era común") → rellena correccion_tipo.
  · la CATEGORÍA ("el último es ocio", "cámbialo a supermercado", "ponlo en salud") → rellena correccion_categoria.
- "ayuda": saludo, duda o algo que no encaja.

TIPO (elige uno):
- "Ingreso": entra dinero (nómina, paro, devolución, transferencia recibida).
- "Común": gasto del hogar o plan del que os beneficiáis LOS DOS (${P1} y ${P2}): alquiler, luz, agua, la compra conjunta, cena o plan los dos juntos.
- "Fijo personal": gasto fijo propio que paga uno mismo (su préstamo, su móvil, su gimnasio, su seguro).
- "Personal": gasto de uno solo, un capricho, o un plan con OTRA persona que NO es la pareja (ej. "cine con Noe", "desayuno con la abuela", "regalo a un amigo").
- "Liquidación": uno le PASA dinero al otro para saldar cuentas ("le he pasado X a ${P2}", "te devuelvo X").
REGLA IMPORTANTE: si el gasto menciona a otra persona por su nombre que NO es ${P1} ni ${P2} (un amigo, un familiar), o es claramente un plan individual, es "Personal", NUNCA "Común". "Común" solo cuando os beneficia a los dos.
BIZUM / transferencia: si es a un TERCERO (un amigo, un familiar, alguien a quien se le debe dinero) es "Personal". Solo es "Liquidación" si el Bizum es a la pareja (${P1} o ${P2}).

CATEGORIA (elige la MÁS cercana; mapea por palabras clave):
- Alquiler/Hipoteca: alquiler, hipoteca, renta, piso.
- Luz: luz, electricidad, endesa, iberdrola, naturgy.
- Agua: agua, recibo del agua.
- Gas: gas, butano, caldera.
- Internet/Móvil: internet, fibra, móvil, teléfono, datos, movistar, vodafone, orange, yoigo, tarifa.
- Comunidad: comunidad, vecinos, derrama.
- Seguros: seguro, mapfre, mutua, póliza (coche, hogar, vida, salud).
- Supermercado: super, supermercado, compra, mercadona, lidl, carrefour, dia, alcampo, comida de casa.
- Transporte/Gasolina: gasolina, gasoil, diésel, repostar, parking, peaje, bus, metro, taxi, uber, cabify, tren, billete, ITV, taller, coche.
- Salud: farmacia, médico, dentista, óptica, medicinas, fisio.
- Ocio: cena, comer/cenar fuera, restaurante, bar, copas, cine, concierto, viaje, hotel, finde, escapada, regalos, ocio.
- Ropa: ropa, zapatos, zapatillas, zara, primark, complementos.
- Mascotas: perro, gato, veterinario, pienso, mascota.
- Suscripciones: netflix, spotify, hbo, max, disney, amazon prime, youtube, suscripción, app.
- Gimnasio: gimnasio, gym, crossfit, pádel, cuota deporte.
- Préstamo personal: préstamo, financiación, cuota del préstamo, crédito.
- Nómina: nómina, sueldo, salario, paga.
- Paro: paro, desempleo, prestación, SEPE.
- Otro ingreso: otro ingreso, transferencia recibida, devolución, reembolso.
- Otros: SOLO si de verdad no encaja en ninguna de las anteriores.

CONCEPTO: SIEMPRE un texto corto y natural (2-4 palabras) describiendo el gasto. Ej: "cena fuera", "compra Mercadona", "gasolina coche", "nómina mensual".

REGLAS:
- Si el mensaje contiene un número, ESE número es el "importe" en euros: rellénalo SIEMPRE.
- Por defecto el que escribe es quien pagó: NO rellenes "quien" salvo que diga claramente que pagó la otra persona.

EJEMPLOS:
"40 cena común" -> {"intent":"registrar","tipo":"Común","categoria":"Ocio","concepto":"cena fuera","importe":40}
"85 compra mercadona" -> {"intent":"registrar","tipo":"Común","categoria":"Supermercado","concepto":"compra Mercadona","importe":85}
"he echado 50 de gasolina" -> {"intent":"registrar","tipo":"Común","categoria":"Transporte/Gasolina","concepto":"gasolina","importe":50}
"nómina 1450" -> {"intent":"registrar","tipo":"Ingreso","categoria":"Nómina","concepto":"nómina mensual","importe":1450}
"gimnasio 35 fijo" -> {"intent":"registrar","tipo":"Fijo personal","categoria":"Gimnasio","concepto":"cuota gimnasio","importe":35}
"netflix 13" -> {"intent":"registrar","tipo":"Común","categoria":"Suscripciones","concepto":"Netflix","importe":13}
"le he pasado 100 a ${P2}" -> {"intent":"registrar","tipo":"Liquidación","concepto":"liquidación a ${P2}","importe":100}
"bizum a Daniel 30" -> {"intent":"registrar","tipo":"Personal","categoria":"Otros","concepto":"Bizum a Daniel","importe":30}
"bizum a ${P2} 50" -> {"intent":"registrar","tipo":"Liquidación","concepto":"Bizum a ${P2}","importe":50}
"cómo vamos este mes" -> {"intent":"consulta","consulta":"resumen"}
"cuánto se debe" -> {"intent":"consulta","consulta":"deuda"}
"cuánto tengo en la cuenta" -> {"intent":"consulta","consulta":"saldo"}
"nuevo objetivo viaje 2000" -> {"intent":"objetivo","nombre":"Viaje","meta":2000}
"quiero ahorrar para un coche 5000 metiendo 150 al mes" -> {"intent":"objetivo","nombre":"Coche","meta":5000,"aportacion":150}
"tenemos una deuda de la tarjeta 600 con cuota 50" -> {"intent":"deuda","nombre":"Tarjeta","saldo":600,"cuota":50}
"añade préstamo coche 5000 cuota 180 interés 7" -> {"intent":"deuda","nombre":"Préstamo coche","saldo":5000,"cuota":180,"interes":7}
"el último es personal" -> {"intent":"corregir","correccion_tipo":"Personal"}
"cámbialo a fijo personal" -> {"intent":"corregir","correccion_tipo":"Fijo personal"}
"no era común, es personal" -> {"intent":"corregir","correccion_tipo":"Personal"}
"el último cámbialo a ocio" -> {"intent":"corregir","correccion_categoria":"Ocio"}
"esa merienda es ocio, no otros" -> {"intent":"corregir","correccion_categoria":"Ocio"}
"cómo va el fondo de emergencia" -> {"intent":"consulta","consulta":"fondo"}
"qué objetivos tenemos" -> {"intent":"consulta","consulta":"objetivos"}
"qué deudas tenemos" -> {"intent":"consulta","consulta":"deudas"}
"cuánto nos queda por pagar de casa este mes" -> {"intent":"consulta","consulta":"prevision"}
"gastos de casa previstos" -> {"intent":"consulta","consulta":"prevision"}
"la casa que queremos vale 220000" -> {"intent":"casa","casa_precio":220000}
"queremos comprar en 6 años" -> {"intent":"casa","casa_anios":6}
"para la casa podemos ahorrar 600 al mes" -> {"intent":"casa","casa_ahorro_mensual":600}
"llevamos 5000 ahorrados para la casa" -> {"intent":"casa","casa_ahorrado":5000}
"cuánto nos falta para la casa" -> {"intent":"consulta","consulta":"casa"}
"qué hipoteca podemos pagar" -> {"intent":"consulta","consulta":"casa"}
"quiero comprar un sofá de 800" -> {"intent":"compra_grande","nombre":"Sofá","importe":800}
"me gustaría comprarme una tele de 600" -> {"intent":"compra_grande","nombre":"Tele","importe":600}
"el IBI son 400 al año, apártalo" -> {"intent":"amortizacion","nombre":"IBI","coste_anual":400}
"añade fondo seguro coche 600 anual" -> {"intent":"amortizacion","nombre":"Seguro coche","coste_anual":600}
"cuánto tenemos en total" -> {"intent":"consulta","consulta":"patrimonio"}
"cuál es nuestro patrimonio" -> {"intent":"consulta","consulta":"patrimonio"}
"cuánto tengo que apartar al mes para los gastos anuales" -> {"intent":"consulta","consulta":"amortizacion"}
"qué categorías hay" -> {"intent":"consulta","consulta":"categorias"}
"dime las categorías disponibles" -> {"intent":"consulta","consulta":"categorias"}
"borra el último" -> {"intent":"borrar"}
"elimina el último gasto" -> {"intent":"borrar"}
"cuánto ha gastado ${P2} este mes" -> {"intent":"consulta","consulta":"gastos"}
"cuánto he gastado yo" -> {"intent":"consulta","consulta":"gastos"}
"cuánto ha gastado cada uno en casa" -> {"intent":"consulta","consulta":"gastos_casa"}
"gastos de casa por persona" -> {"intent":"consulta","consulta":"gastos_casa"}`;

export async function parseMessage(text) {
  const body = JSON.stringify({
    system_instruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: "user", parts: [{ text }] }],
    generationConfig: {
      temperature: 0,
      response_mime_type: "application/json",
      responseSchema: schema,
    },
  });
  for (const m of MODELS) {
    try {
      const res = await fetch(`${urlFor(m)}?key=${process.env.GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (!res.ok) {
        console.error("Gemini", m, res.status, (await res.text()).slice(0, 200));
        continue; // prueba el siguiente modelo (429/503/etc.)
      }
      const data = await res.json();
      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.error("Gemini fetch", m, e.message);
    }
  }
  return { intent: "ayuda" };
}

// Clasifica un gasto en la categoría más cercana (respaldo cuando las palabras clave no aciertan).
export async function classifyCategory(text) {
  const body = JSON.stringify({
    system_instruction: { parts: [{ text: `Clasifica el gasto/ingreso en UNA de estas categorías, la más cercana: ${CATEGORIAS.join(", ")}. Ej: "gorra y calcetines"→Ropa, "auriculares"→Otros, "entradas concierto"→Ocio, "pintalabios"→Otros.` }] },
    contents: [{ role: "user", parts: [{ text }] }],
    generationConfig: {
      temperature: 0,
      response_mime_type: "application/json",
      responseSchema: { type: "OBJECT", properties: { categoria: { type: "STRING", enum: CATEGORIAS } }, required: ["categoria"] },
    },
  });
  for (const m of MODELS) {
    try {
      const res = await fetch(`${urlFor(m)}?key=${process.env.GEMINI_API_KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body });
      if (!res.ok) continue;
      const data = await res.json();
      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (raw) { const o = JSON.parse(raw); if (o.categoria && CATEGORIAS.includes(o.categoria)) return o.categoria; }
    } catch {}
  }
  return null;
}
