// index.js — 3DBotics Messenger Bot (GPT-4o + smart franchise intent)
// Cloud Run buildpacks ready

import express from "express";
import crypto from "crypto";

// ====== ENV ======
const PAGE_TOKEN   = process.env.MESSENGER_PAGE_TOKEN;
const VERIFY_TOKEN = process.env.MESSENGER_VERIFY_TOKEN;
const APP_SECRET   = process.env.META_APP_SECRET;
const OPENAI_KEY   = process.env.OPENAI_API_KEY;

if (!PAGE_TOKEN || !VERIFY_TOKEN || !APP_SECRET) {
  console.error("❌ Missing FB envs");
}

// ====== STATIC BUSINESS FACTS ======
const FACTS = {
  brand: "3DBotics",
  program: "Tech Dojo",
  tuition: "₱3,995/month (unlimited daily time-slot attendance).",
  materials: {
    onetime: "₱1,100 one-time kit (labgown uniform, robot toolset, bag, notebook, pencil).",
    monthly: "Around ₱700/month for consumables and next robot’s toolset."
  },
  slots: [
    "3:00–4:00 PM",
    "4:15–5:15 PM",
    "5:15–6:30 PM",
    "6:45–7:45 PM (Adults)"
  ],
  tracks: [
    "Tue: Battle Kick Bot (Kids) — 3:00 / 4:15 / 5:15 • Adults 6:45",
    "Wed: RoboRacers (Kids) — 3:00 / 4:15 / 5:15 • Adults 6:45",
    "Thu: Battle Kick Bot (Kids) — 3:00 / 4:15 / 5:15 • Adults 6:45",
    "Fri: RoboRacers (Kids & Teens) — 3:00 / 4:15 / 5:15 • Adults 6:45",
    "Sat: RoboRacers Weekly Track Race (All ages)",
    "Sun: BattleKick Bot Weekly Field Match (All ages)"
  ],
  positioning:
    "Like a Cobra Kai for technology: continuous practice in AI, 3D printing and robotics. " +
    "Students build RoboRacers and Soccer KickBots month after month; skills compound fast.",
  cta: {
    enroll: "Enroll now: call Nuvali Branch Head at 0985-383-3878. Or send your name + phone here.",
    franchise: "Franchise now: call 0995-836-2249. Or send your name + phone here.",
    workshop: "Teacher Certification (One-Day): call 0985-383-3878 to reserve."
  },
  teacherWorkshop: {
    price: "₱3,995 (with take-home robot, snacks & certificate)",
    schedule: [
      "10:00–10:30 Overview (Keychain experience)",
      "10:30–12:00 3D Modelling",
      "12:00–1:00 Lunch",
      "1:00–2:00 3D Printing your model",
      "2:00–3:00 Basic Mod-Robotics via AI",
      "3:00–4:00 Robot assembly",
      "Q&A"
    ]
  },
  franchise: {
    opt1: "OPTION-1 — ₱880,000 (Promo: ₱695,000 for first 30 branches): 10 printers, 15kg filament, 43” TV, 10 toolkits & USBs, 3 major apps, display robots, best-selling printable files, HD logos/posters. Intensive training, full manuals, lifetime tech & business support, AI web platform. FREE round signage if confirmed within 7 days.",
    opt2: "OPTION-2 — ₱660,000 (Promo: ₱495,000 for first 30 branches): 5 printers, 7kg filament, 43” TV, 5 toolkits & USBs, 3 major apps, display robots, best-selling printable files, HD logos/posters. Intensive training, full manuals, lifetime tech & business support, AI web platform. FREE round signage if confirmed within 7 days.",
    steps: [
      "1) Reserve promo slot (10%) to secure your city (one branch per city).",
      "2) 40% after target opening set (order equipment ~45 days before opening).",
      "3) Final 50% two weeks before delivery (one week before opening).",
      "FREE training runs between milestones.",
      "CORE-30 perks: lifetime no royalty & no renewal, core-group status, VIP benefits."
    ],
    multiBiz: [
      "Tech Playschool (3D Printing + Robotics-AI)",
      "3D Printing Services / Farm",
      "Co-Maker Space (rent your space per hour)",
      "Retail: printers, materials, robotics components via 3DBotics",
      "Create & sell your own 3D products online; we train you",
      "We set up equipment, train staff, provide AI ops platform, marketing & branding kits.",
      "Target monthly potential: ₱300,000+ (execution-dependent)."
    ]
  },
  branches: [
    { city: "Nuvali (Sta. Rosa Laguna) — DEFAULT", phone: "0985 383 3878", addr: "2F Laguna Central (near Shopwise), Sta. Rosa, Laguna" },
    { city: "Makati City", phone: "0917 672 6871", addr: "Unit 127, Mile Long Bldg., Legazpi Village" },
    { city: "Imus City (Cavite)", phone: "0956 895 0278", addr: "189 RCJ Commercial Bldg., Bayan Luma 1" },
    { city: "Las Piñas", phone: "0998 530 9437", addr: "Unit 115 Vatican Bldg., BF Resort" },
    { city: "Bacoor (Cavite)", phone: "0917 872 3189", addr: "2F Main Square Mall, Bayanan" },
    { city: "Cabuyao City", phone: "0920 276 1204", addr: "Unit 3C RLI Bldg., Southpoint, Banay-Banay" },
    { city: "Los Baños", phone: "0936 213 9211", addr: "Batong Malake (UPLB area)" },
    { city: "Mandaluyong", phone: "0917 578 1611", addr: "6F MG Tower II, Shaw Blvd." },
    { city: "Ortigas", phone: "0918 964 4285", addr: "GF Goldloop Towers, Ortigas Center" },
    { city: "Taguig", phone: "0917 557 2078 / 0927 647 8955", addr: "2F #72 MRT Ave., Central Signal Village" }
  ]
};

// ====== APP ======
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

// ====== Anti-flood + Chunking ======
const handledMIDs = new Map();
const MID_TTL_MS = 10 * 60 * 1000;
const CHUNK = 900;
function dedupe(mid) {
  const now = Date.now();
  for (const [k, t] of handledMIDs) if (now - t > MID_TTL_MS) handledMIDs.delete(k);
  if (handledMIDs.has(mid)) return true;
  handledMIDs.set(mid, now);
  return false;
}

async function sendText(psid, text) {
  const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_TOKEN}`;
  for (let i = 0; i < text.length; i += CHUNK) {
    const body = {
      messaging_type: "RESPONSE",
      recipient: { id: psid },
      message: { text: text.slice(i, i + CHUNK) }
    };
    await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  }
}

// ====== INTENT HELPERS ======
// Broad verb set for "open/start a branch"
const VERB_OPEN = /(open|opening|start|setup|set up|establish|build|launch|own|operate|magtayo|mag[- ]?open|mag[- ]?bukas|magbukas|mag-open|mag open)/;
const FRANCHISE_WORD = /(franchise|franchising|mag[- ]?franchise)/;

// Detect franchising intent even with words between "open" and "branch"
function isFranchiseIntent(t) {
  const text = t.toLowerCase();

  // obvious franchise words
  if (FRANCHISE_WORD.test(text)) return true;

  // verb + branch (allow up to 5 filler words between)
  if (VERB_OPEN.test(text) && /branch/.test(text)) return true;

  // verb + 3dbotics without 'branch'
  if (VERB_OPEN.test(text) && /(3dbotics)/.test(text)) return true;

  // phrases like "I want my own branch"
  if (/(my\s+own\s+branch|own\s+branch)/.test(text)) return true;

  // tagalog patterns: "paano magtayo/magbukas ng branch"
  if (/(paano|gusto|pwede).*(magtayo|magbukas|mag open).*(branch|3dbotics)/.test(text)) return true;

  return false;
}

// Detect branch locator (when user wants addresses/list, not franchise)
function isBranchLocator(t) {
  const text = t.toLowerCase();
  if (/branch\s+\w+/.test(text)) return true; // "branch Makati"
  if (/(address|location|saan|where|near|malapit|branches|branch list)/.test(text)) return true;
  return false;
}

function extractCity(t) {
  const m1 = t.match(/(?:in|sa)\s+([a-z .'-]+)/i);
  if (m1 && m1[1]) return m1[1].trim();
  const m2 = t.match(/branch\s+([a-z .'-]+)/i);
  if (m2 && m2[1]) return m2[1].trim();
  return null;
}

// ====== RULE ENGINE ======
function ruleReply(text) {
  const t = (text || "").toLowerCase().trim();

  // Hiring filter
  if (/(hiring|job|trabaho|apply|resume|cv)/.test(t)) {
    return "We’re not hiring through this bot right now. For opportunities, message your nearest 3DBotics branch or email careers@3dbotics.ph.";
  }

  // Tuition / materials / workshop
  if (/(tuition|price|magkano|3995|3,?995)/.test(t)) {
    return `${FACTS.tuition}\nDaily slots: ${FACTS.slots.join(" • ")}\n${FACTS.cta.enroll}`;
  }
  if (/(material|kit|uniform|labgown|consumable|bayad)/.test(t)) {
    return `${FACTS.materials.onetime}\n${FACTS.materials.monthly}\n${FACTS.cta.enroll}`;
  }
  if (/(workshop|teacher|cert)/.test(t)) {
    return `Teacher Certification — ${FACTS.teacherWorkshop.price}\n${FACTS.cta.workshop}`;
  }

  // ✅ Franchise intent (captures “open my own branch”, Taglish, etc.)
  if (isFranchiseIntent(t)) {
    const city = extractCity(t);
    if (city) {
      const hit = FACTS.branches.find(b => b.city.toLowerCase().includes(city.toLowerCase()));
      const cityLine = hit
        ? `\nWe can reserve **${hit.city}** now (one branch per city).`
        : `\nWe can reserve **${city}** now (one branch per city).`;
      return `${FACTS.franchise.opt1}\n\n${FACTS.franchise.opt2}\n\n${FACTS.franchise.steps.join("\n")}${cityLine}\n${FACTS.cta.franchise}`;
    }
    return `${FACTS.franchise.opt1}\n\n${FACTS.franchise.opt2}\n\n${FACTS.franchise.steps.join("\n")}\n${FACTS.cta.franchise}`;
  }

  // Explicit steps
  if (/franchise step|paano mag start/.test(t)) {
    return FACTS.franchise.steps.join("\n") + `\n${FACTS.cta.franchise}`;
  }

  // 📍 Branch locator (only when truly looking for addresses/list)
  if (isBranchLocator(t)) {
    // “branch Makati”
    const m = t.match(/branch\s+(.+)/i);
    if (m && m[1]) {
      const city = m[1].trim();
      const hit = FACTS.branches.find(b => b.city.toLowerCase().includes(city.toLowerCase()));
      if (hit) return `${hit.city}\nContact: ${hit.phone}\nAddress: ${hit.addr}\n${FACTS.cta.enroll}`;
    }
    const list = FACTS.branches.slice(0, 10).map(b => `• ${b.city} — ${b.phone}`).join("\n");
    return `Branches (sample):\n${list}\nAsk: “branch Makati” or “branch Nuvali”.`;
  }

  return null; // let GPT handle it
}

// ====== GPT-4o ======
async function gptReply(userText) {
  if (!OPENAI_KEY) return null;

  const systemPrompt = `
You are the official ${FACTS.brand} Messenger assistant.
Tone: warm, concise, persuasive, 70% casual / 30% formal. Address the user as "veni".
Answer in ≤ 900 characters. Stick to facts below.

PROGRAM
- ${FACTS.positioning}
- Tuition: ${FACTS.tuition}
- Materials: ${FACTS.materials.onetime} | ${FACTS.materials.monthly}
- Time slots: ${FACTS.slots.join(" • ")}
- Weekly tracks: ${FACTS.tracks.join(" / ")}

CTAs
- Enroll: ${FACTS.cta.enroll}
- Franchise: ${FACTS.cta.franchise}
- Workshop: ${FACTS.cta.workshop}

FRANCHISE
- ${FACTS.franchise.opt1}
- ${FACTS.franchise.opt2}
- Steps: ${FACTS.franchise.steps.join(" ")}
- Multi-business: ${FACTS.franchise.multiBiz.join(" | ")}

BRANCHES
${FACTS.branches.map(b => `- ${b.city} | ${b.phone} | ${b.addr}`).join("\n")}

Behavior rules:
- Treat any “open/start/setup/launch/own/magtayo/magbukas … + (branch or 3DBotics)” as FRANCHISING; reply with franchise packages + steps + CTA. If a city is present, mention reservation for that city.
- Only return the branch list when the user is clearly asking for locations (where/saan/address/branch <city>/near me).
- If user asks costs/materials, always include ₱1,100 kit + ~₱700/month consumables.
- End with the most relevant CTA line.
`;

  const payload = {
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userText }
    ],
    temperature: 0.3,
    max_tokens: 400
  };

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!resp.ok) {
    console.error("OpenAI error", await resp.text());
    return null;
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content?.trim() || null;
}

// ====== WEBHOOKS ======
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === VERIFY_TOKEN) return res.status(200).send(challenge);
  return res.sendStatus(403);
});

app.post("/webhook", async (req, res) => {
  const body = req.body;
  if (body.object !== "page") return res.sendStatus(404);

  for (const entry of body.entry || []) {
    const event = entry.messaging && entry.messaging[0];
    if (!event) continue;

    const mid    = event.message && event.message.mid;
    if (mid && dedupe(mid)) continue;

    const sender = event.sender && event.sender.id;
    const text   = event.message && event.message.text;

    if (sender && text) {
      try {
        const ruled = ruleReply(text);
        if (ruled) { await sendText(sender, ruled); continue; }

        const gen = await gptReply(text);
        await sendText(sender, gen || "I can help with Tech Dojo, schedules, tuition, materials, branches, and franchise details. Try “franchise” or “schedule”.");
      } catch (e) {
        console.error("send error", e);
      }
    }
  }
  res.sendStatus(200);
});

// ====== HEALTH ======
app.get("/", (_req, res) => res.status(200).send("🤖 3DBotics Tech Dojo bot (GPT-4o) up"));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("Bot listening on " + PORT));
