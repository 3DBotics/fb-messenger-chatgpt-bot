// index.js — 3DBotics Messenger Bot (GPT-4o conversational + smart rule intents)
// © 3DBotics 2025 — runs on Cloud Run buildpacks

import express from "express";
import crypto from "crypto";

// ====== ENV ======
const PAGE_TOKEN   = process.env.MESSENGER_PAGE_TOKEN;
const VERIFY_TOKEN = process.env.MESSENGER_VERIFY_TOKEN;
const APP_SECRET   = process.env.META_APP_SECRET;
const OPENAI_KEY   = process.env.OPENAI_API_KEY;

if (!PAGE_TOKEN || !VERIFY_TOKEN || !APP_SECRET) {
  console.error("❌ Missing Facebook environment variables");
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
    { city: "Nuvali (Sta. Rosa Laguna)", phone: "0985 383 3878", addr: "2F Laguna Central, Sta. Rosa" },
    { city: "Makati City", phone: "0917 672 6871", addr: "Unit 127, Mile Long Bldg., Legazpi Village" },
    { city: "Imus City (Cavite)", phone: "0956 895 0278", addr: "RCJ Commercial Bldg., Bayan Luma 1" },
    { city: "Las Piñas", phone: "0998 530 9437", addr: "Unit 115 Vatican Bldg., BF Resort" },
    { city: "Bacoor (Cavite)", phone: "0917 872 3189", addr: "2F Main Square Mall, Bayanan" },
    { city: "Cabuyao City", phone: "0920 276 1204", addr: "Unit 3C RLI Bldg., Banay-Banay" },
    { city: "Los Baños", phone: "0936 213 9211", addr: "Batong Malake (UPLB area)" },
    { city: "Mandaluyong", phone: "0917 578 1611", addr: "6F MG Tower II, Shaw Blvd." },
    { city: "Ortigas", phone: "0918 964 4285", addr: "GF Goldloop Towers, Ortigas Center" },
    { city: "Taguig", phone: "0917 557 2078 / 0927 647 8955", addr: "2F #72 MRT Ave., Central Signal" }
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
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  }
}

// ====== Text Canonicalizer (Synonym Normalizer) ======
function canonicalize(text = "") {
  const t = text.toLowerCase().trim();

  if (/(hiring|job|trabaho|apply|resume|cv)/.test(t)) return { t, gate: "JOBS" };

  const openBranchSyn = /(open(ing)?|start|setup|set up|mag[- ]?open|magbukas)\s+(a\s+)?branch/;
  const bringToCitySyn = /(bring|open)\s+(3dbotics|a\s+branch)\s+(to|in|sa)\s+([a-z .'-]+)/;
  if (openBranchSyn.test(t)) return { t: t.replace(openBranchSyn, "franchise"), gate: "FRANCHISE" };
  if (bringToCitySyn.test(t)) return { t: t.replace(bringToCitySyn, "franchise in $4"), gate: "FRANCHISE" };

  const otherFrSyn = /(franchise|franchising|mag[- ]?franchise|partner with 3dbotics|become a partner)/;
  if (otherFrSyn.test(t)) return { t: t.replace(otherFrSyn, "franchise"), gate: "FRANCHISE" };

  return { t, gate: null };
}

// ====== RULE ENGINE ======
function ruleReply(text) {
  const { t, gate } = canonicalize(text || "");

  if (/(tuition|price|magkano|3995|3,?995)/.test(t)) {
    return `${FACTS.tuition}\nDaily slots: ${FACTS.slots.join(" • ")}\n${FACTS.cta.enroll}`;
  }

  if (/(material|kit|uniform|labgown|consumable|bayad)/.test(t)) {
    return `${FACTS.materials.onetime}\n${FACTS.materials.monthly}\n${FACTS.cta.enroll}`;
  }

  if (/(workshop|teacher|cert)/.test(t)) {
    return `Teacher Certification — ${FACTS.teacherWorkshop.price}\n${FACTS.cta.workshop}`;
  }

  // Unified Franchise or "Open a Branch"
  if (gate === "FRANCHISE" || /(franchise|package)/.test(t)) {
    const m = t.match(/franchise(?:\s+in|\s+sa)\s+([a-z .'-]+)/);
    const city = m && m[1] ? m[1].trim() : null;
    if (city) {
      const hit = FACTS.branches.find(b => b.city.toLowerCase().includes(city));
      const cityLine = hit
        ? `\nWe can reserve **${hit.city}** now (one branch per city).`
        : `\nWe can reserve **${city}** now (one branch per city).`;
      return `${FACTS.franchise.opt1}\n\n${FACTS.franchise.opt2}\n\n${FACTS.franchise.steps.join("\n")}${cityLine}\n${FACTS.cta.franchise}`;
    }
    return `${FACTS.franchise.opt1}\n\n${FACTS.franchise.opt2}\n\n${FACTS.franchise.steps.join("\n")}\n${FACTS.cta.franchise}`;
  }

  if (/franchise step|paano mag start/.test(t)) {
    return FACTS.franchise.steps.join("\n") + `\n${FACTS.cta.franchise}`;
  }

  // Branch info lookup
  if (/branch\s+\w+/.test(t)) {
    const m = t.match(/branch\s+(.+)/i);
    const city = m && m[1] ? m[1].trim() : "";
    const hit = FACTS.branches.find(b => b.city.toLowerCase().includes(city));
    if (hit) return `${hit.city}\nContact: ${hit.phone}\nAddress: ${hit.addr}\n${FACTS.cta.enroll}`;
  }

  if (/(branch|address|location|saan|where)/.test(t)) {
    const list = FACTS.branches
      .slice(0, 10)
      .map(b => `• ${b.city} — ${b.phone}`)
      .join("\n");
    return `Branches (sample):\n${list}\nAsk: “branch Makati” or “branch Nuvali”.`;
  }

  return null; // pass to GPT
}

// ====== GPT-4o ======
async function gptReply(userText) {
  if (!OPENAI_KEY) return null;

  const systemPrompt = `
You are the official ${FACTS.brand} Messenger assistant.
Tone: warm, concise, persuasive, 70% casual / 30% formal. Address the user as "veni".
Stay factual and limited to this data — do not invent.

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
- Treat “open a branch”, “start/setup a branch”, or Tagalog equivalents (mag-open/magbukas ng branch), and “open 3DBotics in <city>” as FRANCHISING. Always respond with the franchise packages + CTA.
- If user mentions a city, show that branch contact if available.
- Always end with the most relevant CTA line.
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

    const mid = event.message && event.message.mid;
    if (mid && dedupe(mid)) continue;

    const sender = event.sender && event.sender.id;
    const text = event.message && event.message.text;

    if (sender && text) {
      try {
        // Hiring filter first
        if (/(hiring|job|trabaho|apply|resume|cv)/i.test(text)) {
          await sendText(sender, "We’re not hiring through this bot right now. For opportunities, message your nearest 3DBotics branch or email careers@3dbotics.ph.");
          continue;
        }

        // Rule-based reply
        const ruled = ruleReply(text);
        if (ruled) { await sendText(sender, ruled); continue; }

        // GPT-4o fallback
        const gen = await gptReply(text);
        await sendText(sender, gen || "I can help with Tech Dojo, schedules, tuition, materials, branches, and franchise details. Try typing “franchise” or “schedule”.");
      } catch (e) {
        console.error("Send error:", e);
      }
    }
  }
  res.sendStatus(200);
});

// ====== HEALTH CHECK ======
app.get("/", (_req, res) => res.status(200).send("🤖 3DBotics Messenger Bot (GPT-4o) running smoothly."));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("✅ 3DBotics Bot listening on port " + PORT));