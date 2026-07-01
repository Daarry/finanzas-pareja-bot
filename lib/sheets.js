// Acceso al Google Sheet de Finanzas Pareja mediante una cuenta de servicio.
import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const MOV = "Movimientos";   // columnas: A Fecha | B Mes | C Tipo | D Categoría | E Concepto | F Importe | G Quién
const RES = "Resumen";       // A Mes | B Ingresos | C Gastos | D Balance | ... K Acumulado | L Texto
const PAN = "Panel";
const MAX_ROW = 401;

function client() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

async function read(range) {
  const s = client();
  const r = await s.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range });
  return r.data.values || [];
}

export function currentMonth(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Añade un movimiento en la primera fila libre, conservando la fórmula del Mes.
export async function appendMovement({ fecha, tipo, categoria, concepto, importe, quien }) {
  const s = client();
  const col = await read(`${MOV}!A2:A${MAX_ROW}`);
  let row = 2;
  for (let i = 0; i < MAX_ROW - 1; i++) {
    if (!col[i] || col[i][0] === undefined || col[i][0] === "") { row = i + 2; break; }
    row = i + 3;
  }
  if (row > MAX_ROW) throw new Error("La hoja Movimientos está llena (amplía el rango).");
  // El "Mes" lo calculamos aquí (texto YYYY-MM) en vez de fórmula, para evitar el locale de Sheets (; vs ,)
  const mes = /^\d{4}-\d{2}/.test(fecha || "") ? fecha.slice(0, 7) : "";
  await s.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${MOV}!A${row}:G${row}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[fecha, mes, tipo, categoria, concepto, importe, quien]] },
  });
  return row;
}

// Cambia el TIPO del último movimiento apuntado por 'person'. Devuelve datos de la fila o null.
export async function updateLastTipo(person, nuevoTipo) {
  const rows = await read(`${MOV}!A2:G${MAX_ROW}`);
  let target = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r && r[0] && r[6] === person) target = i;
  }
  if (target < 0) return null;
  const rowNum = target + 2;
  const s = client();
  await s.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${MOV}!C${rowNum}`,
    valueInputOption: "RAW",
    requestBody: { values: [[nuevoTipo]] },
  });
  const r = rows[target];
  return { row: rowNum, concepto: r[4] || r[3], importe: r[5], tipo: nuevoTipo };
}

// Devuelve la fila del Resumen para un mes (YYYY-MM) ya calculada.
export async function resumenMes(mes) {
  const rows = await read(`${RES}!A3:L20`);
  const r = rows.find((x) => x[0] === mes);
  if (!r) return null;
  return {
    mes,
    ingresos: r[1], gastos: r[2], balance: r[3],
    aportoDarry: r[6], aportoMimi: r[7],
    saldoMes: r[8], acumulado: r[10], quienDebe: r[11],
  };
}

// Saldos de cada cuenta personal (calculados en el Panel).
export async function saldos() {
  const r = await read(`${PAN}!B22:C22`);
  const v = r[0] || [];
  return { darry: v[0], mimi: v[1] };
}

// ---- Hoja "Ahorro y Deudas" ----
const AYD = "'Ahorro y Deudas'";

async function firstEmpty(start, end) {
  const col = await read(`${AYD}!A${start}:A${end}`);
  for (let i = 0; i <= end - start; i++) if (!col[i] || !col[i][0]) return start + i;
  return null;
}

export async function addObjetivo({ nombre, meta, aportacion = 0 }) {
  const s = client();
  const row = await firstEmpty(14, 19);
  if (!row) throw new Error("lleno");
  await s.spreadsheets.values.update({ spreadsheetId: SHEET_ID, range: `${AYD}!A${row}:C${row}`, valueInputOption: "USER_ENTERED", requestBody: { values: [[nombre, meta, 0]] } });
  await s.spreadsheets.values.update({ spreadsheetId: SHEET_ID, range: `${AYD}!E${row}`, valueInputOption: "USER_ENTERED", requestBody: { values: [[aportacion || ""]] } });
  return row;
}

export async function addDeuda({ nombre, saldo, cuota = 0, interes = "" }) {
  const s = client();
  const row = await firstEmpty(23, 28);
  if (!row) throw new Error("lleno");
  await s.spreadsheets.values.update({ spreadsheetId: SHEET_ID, range: `${AYD}!A${row}:D${row}`, valueInputOption: "USER_ENTERED", requestBody: { values: [[nombre, saldo, cuota || "", interes]] } });
  return row;
}

export async function fondoEmergencia() {
  const r = await read(`${AYD}!B4:B10`);
  const g = (i) => (r[i] && r[i][0]) || "—";
  return { gastoMedio: g(0), objetivo: g(2), saldo: g(3), falta: g(4), completado: g(5), aportacion: g(6) };
}

export async function listObjetivos() {
  const rows = await read(`${AYD}!A14:F19`);
  return rows.filter((x) => x[0]);
}

export async function listDeudas() {
  const rows = await read(`${AYD}!A23:E28`);
  const tot = await read(`${AYD}!B29`);
  return { items: rows.filter((x) => x[0]), total: (tot[0] && tot[0][0]) || "—" };
}

// Previsión de gastos de casa (hoja "Previsión Casa").
export async function prevision() {
  const r = await read(`'Previsión Casa'!B18:B20`);
  const g = (i) => (r[i] && r[i][0]) || "—";
  return { previsto: g(0), pagado: g(1), queda: g(2) };
}

// ---- Plan de compra de casa (hoja "Casa") ----
export async function setCasa({ precio, anios, ahorroMensual, ahorrado }) {
  const data = [];
  if (precio != null) data.push({ range: "Casa!B4", values: [[precio]] });
  if (ahorrado != null) data.push({ range: "Casa!B10", values: [[ahorrado]] });
  if (anios != null) data.push({ range: "Casa!B14", values: [[anios]] });
  if (ahorroMensual != null) data.push({ range: "Casa!B16", values: [[ahorroMensual]] });
  if (!data.length) return false;
  await client().spreadsheets.values.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: { valueInputOption: "USER_ENTERED", data } });
  return true;
}

export async function readCasa() {
  const r = await read(`Casa!B9:B26`);
  const g = (row) => (r[row - 9] && r[row - 9][0]) || "—";
  return { total: g(9), falta: g(11), mensualNecesario: g(15), aVuestroRitmo: g(17), cuotaMax: g(21), cuota: g(25), veredicto: g(26) };
}

// ---- Fondos de amortización (hoja "Fondos") ----
export async function addFondo({ nombre, costeAnual }) {
  const s = client();
  const col = await read(`Fondos!B4:B13`);
  let row = 4;
  for (let i = 0; i < 10; i++) { if (!col[i] || !col[i][0]) { row = 4 + i; break; } row = 4 + i + 1; }
  if (row > 13) throw new Error("lleno");
  await s.spreadsheets.values.update({ spreadsheetId: SHEET_ID, range: `Fondos!A${row}:B${row}`, valueInputOption: "USER_ENTERED", requestBody: { values: [[nombre, costeAnual]] } });
  return row;
}

export async function readAmortizacion() {
  const r = await read(`Fondos!B14:E14`);
  const v = r[0] || [];
  return { anual: v[0] || "—", mensual: v[1] || "—", falta: v[3] || "—" };
}

export async function readPatrimonio() {
  const r = await read(`Patrimonio!B7:B14`);
  const g = (row) => (r[row - 7] && r[row - 7][0]) || "—";
  return { activos: g(7), pasivos: g(12), neto: g(14) };
}

export async function addCompraGrande({ nombre, importe }) {
  const s = client();
  const col = await read(`${AYD}!A45:A50`);
  let row = 45;
  for (let i = 0; i < 6; i++) { if (!col[i] || !col[i][0]) { row = 45 + i; break; } row = 45 + i + 1; }
  if (row > 50) throw new Error("lleno");
  const hoy = new Date().toLocaleDateString("es-ES", { timeZone: "Europe/Madrid" });
  await s.spreadsheets.values.update({ spreadsheetId: SHEET_ID, range: `${AYD}!A${row}:D${row}`, valueInputOption: "USER_ENTERED", requestBody: { values: [[nombre, importe, hoy, "Pendiente"]] } });
  return row;
}
