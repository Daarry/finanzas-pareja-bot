// Configuración de las dos personas (nombres y números). Configurable por variables de entorno
// para reutilizar el bot con cualquier pareja. Compatible con la config antigua (WA_DARRY/WA_MIMI).

export const P1 = process.env.PERSON1 || "Darry";
export const P2 = process.env.PERSON2 || "Mimi";
const P1NUM = process.env.WA_PERSON1 || process.env.WA_DARRY;
const P2NUM = process.env.WA_PERSON2 || process.env.WA_MIMI;

const norm = (n) => (n || "").replace(/[^0-9]/g, "");

const MAP = {
  [norm(P1NUM)]: P1,
  [norm(P2NUM)]: P2,
};

export function personFromNumber(waNumber) {
  const k = norm(waNumber);
  return k && MAP[k] ? MAP[k] : null; // null = número no autorizado
}

// Dada una persona, devuelve la otra.
export function otherPerson(person) {
  return person === P1 ? P2 : P1;
}
