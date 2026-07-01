// Interpreta el mensaje de WhatsApp con Google Gemini (nivel gratuito de Google AI Studio).
const MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-flash-latest"];
const urlFor = (m) => `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`;

export const TIPOS = ["Ingreso", "Fijo personal", "Común", "Personal", "Liquidación"];
export const CATEGORIAS = [
  "Nómina", "Paro", "Otro ingreso",
  "Alquiler/Hipoteca", "Luz", "Agua", "Gas", "Internet/Móvil", "Comunidad", "Seguros",
  "Supermercado", "Transporte/Gasolina", "Salud", "Ocio", "Ropa", "Mascotas",
  "Suscripciones", "Gimnasio", "Préstamo personal", "Otros",
];

const schema = {
  type: "OBJECT",
  properties: {
    intent: { type: "STRING", enum: ["registrar", "objetivo", "deuda", "casa", "compra_grande", "amortizacion", "consulta", "corregir", "ayuda"] },
    coste_anual: { type: "NUMBER", description: "Coste anual del fondo de amortización (intent=amortizacion)." },
    correccion_tipo: { type: "STRING", enum: TIPOS, description: "Nuevo tipo al corregir el último movimiento." },
    casa_precio: { type: "NUMBER", description: "Precio objetivo de la vivienda (intent=casa)." },
    casa_anios: { type: "NUMBER", description: "Años objetivo para comprar (intent=casa)." },
    casa_ahorro_mensual: { type: "NUMBER", description: "Ahorro mensual que pueden destinar a la casa (intent=casa)." },
    casa_ahorrado: { type: "NUMBER", description: "Cuánto llevan ahorrado para la casa (intent=casa)." },
    tipo: { type: "STRING", enum: TIPOS },
    categoria: { type: "STRING", enum: CATEGORIAS },
    concepto: { type: "STRING" },
    importe: { type: "NUMBER", description: "El número de euros. Si el mensaje contiene un número, va aquí SIEMPRE." },
    fecha: { type: "STRING", description: "ISO YYYY-MM-DD si la menciona, si no vacío" },
    quien: { type: "STRING", enum: ["Darry", "Mimi"] },
    consulta: { type: "STRING", enum: ["resumen", "deuda", "saldo", "fondo", "objetivos", "deudas", "prevision", "casa", "patrimonio", "amortizacion"] },
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

const SYSTEM = `Eres el asistente de un Excel de finanzas de una pareja (Darry y Mimi). Devuelves SIEMPRE JSON.

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
- "casa": configura el PLAN de compra de casa. Rellena lo que diga: casa_precio (precio de la vivienda), casa_anios (en cuántos años), casa_ahorro_mensual (cuánto pueden ahorrar al mes para la casa), casa_ahorrado (cuánto llevan ahorrado para la casa).
- "compra_grande": quiere apuntar una compra grande futura a decidir con calma (aún no la ha pagado). Rellena nombre e importe.
- "amortizacion": quiere añadir un fondo de amortización = un gasto ANUAL que quiere prorratear por meses (IBI, seguro anual, ITV, Navidad...). Rellena nombre y coste_anual.
  Consultas nuevas: "patrimonio" (cuánto tenemos en total / patrimonio neto), "amortizacion" (cuánto apartar al mes para los gastos anuales).
- "corregir": quiere CAMBIAR EL TIPO del último gasto que apuntó ("el último es personal", "cámbialo a fijo", "no era común, es personal"). Rellena correccion_tipo con el nuevo tipo.
- "ayuda": saludo, duda o algo que no encaja.

TIPO (elige uno):
- "Ingreso": entra dinero (nómina, paro, devolución, transferencia recibida).
- "Común": gasto compartido del hogar (alquiler, suministros, compra del super, cena juntos, etc.).
- "Fijo personal": gasto fijo propio que paga uno mismo (su préstamo, su móvil, su gimnasio, su seguro).
- "Personal": capricho o gasto puntual propio (no compartido).
- "Liquidación": uno le PASA dinero al otro para saldar cuentas ("le he pasado X a Mimi", "te devuelvo X").
Si no está claro si es común o personal, usa "Común".

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
"le he pasado 100 a Mimi" -> {"intent":"registrar","tipo":"Liquidación","concepto":"liquidación a Mimi","importe":100}
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
"cuánto tengo que apartar al mes para los gastos anuales" -> {"intent":"consulta","consulta":"amortizacion"}`;

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
