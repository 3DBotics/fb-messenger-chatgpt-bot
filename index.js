// index.js — CommonJS (works without "type":"module")
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// ===== Business context =====
const BUSINESS_CONTEXT = `
You are the official assistant for 3DBotics (3D Designing, 3D Printing, AI-assisted coding, new age robotics).
Tone: 70% casual, 30% formal. Address the user as "veni". Give opinions, do not be neutral.
`;

// ===== Simple intent rules =====
const INTENTS = [
  {
    name: "menu",
    match: /(menu|help|options)/i,
    reply: `veni, here's what I can help with:
- 3DBotics courses info
- franchise info
- pricing
- robotics curriculum explanation
`
  },
  {
    name: "courses",
    match: /(course|class|tuition|module|3dbotics)/i,
    reply: `3DBotics offers: Basic (3D Modeling) → MM1 (3D printing) → MM2-A (Robotics modules) → MM2-B (Obstacle-Avoiding Robot).`
  },
  {
    name: "franchise",
    match: /(franchise|magkano|package|branch)/i,
    reply: `Franchise includes printers, toolkits, modules, training, AI platform, and business mentoring.`
  }
];

// ===== Env vars (already set in Cloud Run) =====
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || process.env.MESSENGER_VERIFY_TOKEN;
const PAGE_TOKEN   = process.env.MESSENGER_PAGE_TOKEN;
const APP_SECRET   = process.env.META_APP_SECRET;      // not used here but keep for later
const OPENAI_KEY   = process.env.OPENAI_API_KEY;

// ===== Webhook verification (Meta calls this once) =====
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// ===== Generate AI reply via OpenAI =====
async function generateAI(userMessage) {
  try {
    const r = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-5",
        messages: [
          { role: "system", content: BUSINESS_CONTEXT },
          { role: "user", content: userMessage }
        ]
      },
      { headers: { Authorization: `Bearer ${OPENAI_KEY}` } }
    );
    return r.data.choices?.[0]?.message?.content || "Okay.";
  } catch (e) {
    console.error("OpenAI error:", e?.response?.data || e.message);
    return "I hit a snag generating a reply, pero buhay ako 😅";
  }
}

// ===== Receive messages from Facebook =====
app.post("/webhook", async (req, res) => {
  const body = req.body;

  if (body.object === "page") {
    for (const entry of body.entry || []) {
      for (const ev of entry.messaging || []) {
        const psid = ev.sender?.id;
        const text = ev.message?.text;

        if (psid && text) {
          // rule-based quick answers first
          for (const rule of INTENTS) {
            if (rule.match.test(text)) {
              await sendText(psid, rule.reply);
              continue;
            }
          }
          // AI fallback
          const ai = await generateAI(text);
          await sendText(psid, ai);
        }
      }
    }
    return res.sendStatus(200);
  }

  res.sendStatus(404);
});

// ===== Send a text message to a PSID =====
async function sendText(psid, text) {
  try {
    await axios.post(
      `https://graph.facebook.com/v17.0/me/messages?access_token=${PAGE_TOKEN}`,
      { recipient: { id: psid }, message: { text } }
    );
  } catch (e) {
    console.error("FB send error:", e?.response?.data || e.message);
  }
}

// ===== Start server for Cloud Run =====
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`3DBotics bot running on ${PORT}`));
