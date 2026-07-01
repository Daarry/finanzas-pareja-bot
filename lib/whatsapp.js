// Envío de mensajes por WhatsApp Cloud API.
const API = "https://graph.facebook.com/v21.0";

export async function sendText(to, body) {
  const url = `${API}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: body.slice(0, 4000) },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    console.error("WhatsApp send error", res.status, t);
  }
  return res.ok;
}
