// index.js
import express from "express";
import crypto from "node:crypto";

const app = express();
app.use(express.json({ verify: (req, res, buf) => (req.rawBody = buf) }));

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.MESSENGER_VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.MESSENGER_PAGE_TOKEN;
const APP_SECRET = process.env.META_APP_SECRET;
const OPENAI = process.env.OPENAI_API_KEY;

// --- Messenger webhook verification (GET) ---
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === VERIFY_TOKEN) return res.status(200).send(challenge);
  return res.sendStatus(403);
});

// --- Verify X-Hub-Signature-256 from Meta ---
function isFromMeta(req) {
  const sig = req.headers["x-hub-signature-256"];
  if (!sig || !APP_SECRET || !req.rawBody) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", APP_SECRET).update(req.rawBody).digest("hex");
  try { return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)); } catch { return false; }
}

// --- Receive message events (POST) ---
app.post("/webhook", async (req, res) => {
  if (!isFromMeta(req)) return res.sendStatus(403);

  const messaging = req.body?.entry?.[0]?.messaging?.[0];
  const psid = messaging?.sender?.id;
  const text = messaging?.message?.text;

  if (psid && text) {
    const reply = await aiReply(text);
    await sendToMessenger(psid, reply);
  }

  res.sendStatus(200);
});

// --- Send message via Messenger Send API ---
async function sendToMessenger(psid, text) {
  await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: psid },
      messaging_type: "RESPONSE",
      message: { text: String(text).slice(0, 900) }
    })
  });
}

// --- OpenAI Responses API (simple text) ---
async function aiReply(userText) {
  // Optional: moderation
  const modRes = await fetch("https://api.openai.com/v1/moderations", {
    method: "POST",
    headers: { "Authorization": `Bearer ${OPENAI}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "omni-moderation-latest", input: userText })
  });
  const flagged = (await modRes.json())?.results?.[0]?.flagged;
  if (flagged) return "Sorry, I can’t help with that. A human can assist you.";

  const system = "You are a friendly 3DBotics/LalaSpa assistant. Be concise, helpful, and offer 'Talk to a human' when needed.";
  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Authorization": `Bearer ${OPENAI}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-5-mini",
      input: [{ role: "system", content: system }, { role: "user", content: userText }]
    })
  });
  const data = await r.json();
  return data?.output_text || "Hi! How can I help today?";
}

app.get("/", (req, res) => res.send("OK"));
app.listen(PORT, () => console.log(`Listening on ${PORT}`));
