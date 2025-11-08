// index.js — 3DBotics Messenger Bot (Tech Dojo only)
// Runs on Cloud Run buildpacks (no Dockerfile needed)

import express from "express";
import crypto from "crypto";

// ====== ENV (already set in Cloud Run) ======
const PAGE_TOKEN   = process.env.MESSENGER_PAGE_TOKEN;
const VERIFY_TOKEN = process.env.MESSENGER_VERIFY_TOKEN; // e.g. "3dboticsbot"
const APP_SECRET   = process.env.META_APP_SECRET;

if (!PAGE_TOKEN || !VERIFY_TOKEN || !APP_SECRET) {
  console.error("❌ Missing env: MESSENGER_PAGE_TOKEN / MESSENGER_VERIFY_TOKEN / META_APP_SECRET");
}

const app = express();
app.use(express.json({ verify: verifySignature }));

function verifySignature(req, res, buf) {
  const sig = req.get("x-hub-signature-256");
  if (!sig) return;
  const expected = "sha256=" + crypto.createHmac("sha256", APP_SECRET).update(buf).digest("hex");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    throw new Error("Invalid request signature");
  }
}

// ====== STATIC KNOWLEDGE (edit here only) ======

// Tech Dojo: one program, continuous creation & promotion
const ABOUT_TECH_DOJO = `
Tech Dojo = the new 3DBotics program.
• Monthly builds: RoboRacers + Soccer KickBot (kids iterate new features every month)
• Skills grow continuously: 3D design → 3D printing → AI-assisted robotics
• Tuition: ₱3,995/month — unlimited attendance within daily time slots (all branches)
`;

// Daily time slots (from your board)
const DOJO_SLOTS = `
Daily time slots (all branches):
• 3:00–4:00 PM
• 4:15–5:15 PM
• 5:15–6:30 PM
• 6:45–7:45 PM (Adults)
`;

// Weekly tracks by day
const WEEK_TRACKS = `
Weekly tracks:
• Tue:  Battle Kick Bot (Kids) — 3:00 / 4:15 / 5:15 • Adults 6:45
• Wed:  RoboRacers (Kids)    — 3:00 / 4:15 / 5:15 • Adults 6:45
• Thu:  Battle Kick Bot (Kids) — 3:00 / 4:15 / 5:15 • Adults 6:45
• Fri:  RoboRacers (Kids & Teens) — 3:00 / 4:15 / 5:15 • Adults 6:45
• Sat:  RoboRacers Weekly Track Race (All ages)
• Sun:  BattleKick Bot Weekly Field Match (All ages)
`;

// Tuition (single truth)
const TUITION = `Tuition: ₱3,995/month (unlimited daily time-slot attendance across the week).`;

// 👉 BRANCHES: add/edit freely. Keep it short per bubble.
// If you want *all* branches from 3DBotics.ph, paste them here as objects.
const BRANCHES = [
  // EXAMPLES — replace/expand with your official list
  { name: "Makati",   contact: "0917 672 6871", note: "Mile Long Bldg., Legazpi Village" },
  { name: "Imus",     contact: "0956 895 0278", note: "RCJ Commercial Bldg., Bayan Luma 1" },
  { name: "Las Piñas",contact: "0998 530 9437", note: "Unit 115 Vatican Bldg., BF Resort" },
  { name: "Los Baños",contact: "0936 213 9211", note: "Batong Malake (UPLB area)" },
  { name: "Bacoor",   contact: "0917 872 3189", note: "Main Square Mall" },
  // …add the rest from 3DBotics.ph
];

// ====== UTIL ======
const handledMIDs = new Map(); // mid -> timestamp; prevents duplicate sends
const MID_TTL_MS = 10 * 60 * 1000;

function dedupe(mid) {
  const now = Date.now();
  // cleanup
  for (const [k, t] of handledMIDs) if (now - t > MID_TTL_MS) handledMIDs.delete(k);
  if (handledMIDs.has(mid)) return true;
  handledMIDs.set(mid, now);
  return false;
}

async function sendText(psid, text) {
  const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_TOKEN}`;
  const body = {
    messaging_type: "RESPONSE",
    recipient: { id: psid },
    message: { text }
  };
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

function normalize(s="") {
  return s.toLowerCase();
}

function replyFor(text) {
  const t = normalize(text);

  // tuition / price
  if (/(tuition|price|magkano|fee|3,?995|3995)/i.test(t)) {
    return `${TUITION}\n\n${DOJO_SLOTS}\n${WEEK_TRACKS}`;
  }

  // schedule / time / slots / dojo
  if (/(schedule|time|slot|oras|tech\s*dojo|dojo)/i.test(t)) {
    return `${ABOUT_TECH_DOJO}\n${DOJO_SLOTS}\n${WEEK_TRACKS}`;
  }

  // branches / address / where
  if (/(branch|saan|address|location|where)/i.test(t)) {
    const list = BRANCHES.map(b => `• ${b.name} — ${b.contact}${b.note ? " — " + b.note : ""}`).join("\n");
    return `Branches (sample list — ask for a specific city to get details):\n${list}\n\nNeed a branch not listed? Type: "branch + city" (e.g., "branch Makati").`;
  }

  // branch + city (e.g., "branch Makati")
  const m = text.match(/branch\s+(.+)/i);
  if (m) {
    const city = m[1].trim().toLowerCase();
    const hit = BRANCHES.find(b => b.name.toLowerCase().includes(city));
    if (hit) {
      return `${hit.name} — ${hit.contact}${hit.note ? " — " + hit.note : ""}\n${TUITION}`;
    }
    return `I can't find that branch yet. Tell me the city name and I'll check.`;
  }

  // what is 3dbotics / explain
  if (/(^hi$|hello|hey|ano ang 3dbotics|what is 3dbotics|about)/i.test(t)) {
    return `3DBotics Tech Dojo helps kids and adults build **RoboRacers** and **Soccer KickBots** month-after-month — their robots get smarter and more capable each cycle.\n\n${TUITION}\n${DOJO_SLOTS}\nType "schedule", "tuition", or "branches".`;
  }

  // default narrow scope
  return `I can help with **Tech Dojo** schedule, tuition (₱3,995), and branches.\nTry: "schedule", "tuition", or "branches".`;
}

// ====== WEBHOOKS ======

// Verify
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// Receive
app.post("/webhook", async (req, res) => {
  const body = req.body;
  if (body.object !== "page") return res.sendStatus(404);

  for (const entry of body.entry || []) {
    const event = entry.messaging && entry.messaging[0];
    if (!event) continue;

    // Deduplicate
    const mid = event.message && event.message.mid;
    if (mid && dedupe(mid)) continue;

    const sender = event.sender && event.sender.id;
    const text = event.message && event.message.text;

    if (sender && text) {
      try {
        const reply = replyFor(text);
        await sendText(sender, reply);
      } catch (e) {
        console.error("send error", e);
      }
    }
  }
  res.sendStatus(200);
});

// Health
app.get("/", (_req, res) => res.status(200).send("3DBotics Tech Dojo bot up"));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("Bot listening on " + PORT));