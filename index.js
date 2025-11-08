// index.js
// 3DBotics FB Messenger Chatbot — Cloud Run (Node/Express)
// Uses VERIFY_TOKEN = env, must match the one you typed in Meta (“3dboticsbot”)

import express from "express";
import crypto from "node:crypto";
import fetch from "node-fetch";

// ====== ENV (must be set in Cloud Run > Variables) ======
const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "3dboticsbot"; // keep in sync with Meta
const PAGE_ACCESS_TOKEN = process.env.MESSENGER_PAGE_TOKEN;     // from Meta > Generate token
const APP_SECRET = process.env.META_APP_SECRET;                 // Meta App Settings > Basic
const OPENAI_KEY = process.env.OPENAI_API_KEY;                  // OpenAI API key
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

// ====== Business context (keeps replies on-brand) ======
const BUSINESS_CONTEXT = `
You are the official assistant for 3DBotics (3D Designing, 3D Printing, AI-assisted coding, and New-Age Robotics).
Tone: 70% casual, 30% formal. Address the user as "veni" when appropriate. Give opinions; don't be neutral.
Courses and outputs:
- Basic: 3D modeling → output: 3D-printed car (+ ESET can make it move)
- MM1: 3D printing ops (slicing, settings, durability)
- MM2-A: basic robotics (Arduino Uno, LEDs, sensors, servos)
- MM2-B: full obstacle-avoid robot (DC/TT motors, servos, LEDs, MP3, sensors)
Franchise support includes training, modules, marketing assets, and our AI web platform.
LalaSpa note (if asked): home-service massage marketplace; therapists keep 81%; affiliate tiers exist.
If question is off-scope (politics, random trivia, unrelated personal advice), politely steer back to 3DBotics or LalaSpa topics.
Keep answers concise but helpful. Offer next action (link instructions, how to enroll, franchise contact: COO John Villamil).
`;

// ====== Simple intent rules (fast answers without calling OpenAI) ======
const INTENTS = [
  {
    name: "menu",
    match: /(menu|help|options)$/i,
    reply:
      "Here’s what I can help with right now:\n" +
      "• 3DBotics courses & pricing\n" +
      "• Franchise info\n" +
      "• Class schedules & branches\n" +
      "• Robotics kits & demos\n" +
      "Ask me in plain English, e.g., “courses” or “how to franchise”.",
  },
  {
    name: "courses",
    match: /(course|class|tuition|module|3dbotics)/i,
    reply:
      "3DBotics has: Basic (3D modeling) → MM1 (3D printing ops) → MM2-A (basic robotics) → MM2-B (full obstacle-avoid robot).\n" +
      "Want a quick price sheet or the nearest branch?",
  },
  {
    name: "franchise",
    match: /(franchise|magkano|package|branch)/i,
    reply:
      "Franchise includes printers, toolkits, modules, training, and our AI platform. OJT + weekly Zoom support. " +
      "Want the latest package deck or to talk to John Villamil (COO) for a walkthrough?",
  },
  {
    name: "contact",
    match: /(contact|phone|email|message|talk to|john)/i,
    reply:
      "Best next step: message our COO **John Villamil** for franchise/course ops. I can prep a quick intro script for you—just say “intro me to John.”",
  },
];

// ====== Express app ======
const app = express();
// Verify request signatures from Meta (X-Hub-Signature-256)
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

// Health check
app.get("/", (_req, res) => res.status(200).send("3DBotics Messenger bot up ✅"));

// ====== Webhook Verification (GET) ======
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// ====== Signature Check ======
function isFromMeta(req) {
  try {
    const sig = req.headers["x-hub-signature-256"] || "";
    if (!sig || !APP_SECRET || !req.rawBody) return false;
    const expected =
      "sha256=" +
      crypto
        .createHmac("sha256", APP_SECRET)
        .update(req.rawBody)
        .digest("hex");
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ====== Incoming messages (POST) ======
app.post("/webhook", async (req, res) => {
  if (!isFromMeta(req)) return res.sendStatus(403);

  const entry = req.body?.entry?.[0];
  const messageEvent = entry?.messaging?.[0];
  const psid = messageEvent?.sender?.id;
  const text = messageEvent?.message?.text;

  if (!psid) {
    return res.sendStatus(200);
  }

  try {
    // Simple intent first (fast, no tokens)
    let reply = matchIntent(text);
    if (!reply) {
      reply = await askOpenAI(text);
    }
    await sendText(psid, reply);
  } catch (e) {
    console.error("handler error", e);
    await sendText(
      psid,
      "Sorry, nagka-issue ako saglit. Try mo ulit in a moment. 🙂"
    );
  }

  return res.sendStatus(200);
});

// ====== Intent matcher ======
function matchIntent(text = "") {
  const t = (text || "").trim();
  if (!t) return null;
  for (const rule of INTENTS) {
    if (rule.match.test(t)) return rule.reply;
  }
  return null;
}

// ====== OpenAI fallback ======
async function askOpenAI(userText) {
  if (!OPENAI_KEY) {
    return "I’m missing my OpenAI key. Please set OPENAI_API_KEY in Cloud Run.";
  }

  const system = BUSINESS_CONTEXT;
  const messages = [
    { role: "system", content: system },
    {
      role: "user",
      content: `User said: "${userText}". Reply in 70% casual, 30% formal. Offer a next action.`,
    },
  ];

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      temperature: 0.6,
      max_tokens: 300,
    }),
  });

  if (!resp.ok) {
    const errTxt = await resp.text();
    console.error("OpenAI error:", resp.status, errTxt);
    return "I couldn’t reach our AI brain right now. Try again in a bit.";
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content?.trim() || "Ok!";
}

// ====== Send text back to the user ======
async function sendText(psid, text) {
  if (!PAGE_ACCESS_TOKEN) {
    console.error("Missing MESSENGER_PAGE_TOKEN");
    return;
  }
  const url = `https://graph.facebook.com/v21.0/me/messages?access_token=${encodeURIComponent(
    PAGE_ACCESS_TOKEN
  )}`;

  const payload = {
    recipient: { id: psid },
    messaging_type: "RESPONSE",
    message: { text },
  };

  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!r.ok) {
    const err = await r.text();
    console.error("FB send error:", r.status, err);
  }
}

app.listen(PORT, () => {
  console.log(`3DBotics bot listening on :${PORT}`);
});
