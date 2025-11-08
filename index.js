// index.js — 3DBotics Messenger Bot (Tech Dojo + Franchise)
// Runs on Cloud Run buildpacks (no Dockerfile needed)

import express from "express";
import crypto from "crypto";

// ====== ENV (already set in Cloud Run) ======
const PAGE_TOKEN   = process.env.MESSENGER_PAGE_TOKEN;
const VERIFY_TOKEN = process.env.MESSENGER_VERIFY_TOKEN;   // e.g., "3dboticsbot"
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

// ====== CONFIG / CONSTANTS ======
const CTA = {
  ENROLL:  "Enroll now: call Nuvali Branch Head at 0985-383-3878. Or send your name + phone here.",
  FRANCH:  "Franchise now: call 0995-836-2249. Or send your name + phone here.",
  WORKSHOP: "Teacher Certification (One-Day): call 0985-383-3878 to reserve."
};

// Tech Dojo program
const ABOUT_TECH_DOJO = [
  "Tech Dojo = continuous robotics + 3D printing + AI practice (like Cobra Kai, but tech).",
  "Monthly builds: RoboRacers and Soccer KickBot — kids innovate new features every month.",
  "Tuition: ₱3,995/month — unlimited attendance within daily time slots.",
].join("\n");

// Materials / fees
const MATERIALS_FEES = [
  "One-time ₱1,100 kit (labgown uniform, robot toolset, bag, notebook, pencil).",
  "Monthly consumables ~₱700 (materials + next robot’s toolset).",
  "Tuition remains ₱3,995/month (unlimited time-slots).",
].join("\n");

// Daily time slots
const DOJO_SLOTS =
  "Daily time slots (all branches):\n• 3:00–4:00 PM\n• 4:15–5:15 PM\n• 5:15–6:30 PM\n• 6:45–7:45 PM (Adults)";

// Weekly tracks
const WEEK_TRACKS = [
  "Weekly tracks:",
  "• Tue: Battle Kick Bot (Kids) — 3:00 / 4:15 / 5:15 • Adults 6:45",
  "• Wed: RoboRacers (Kids) — 3:00 / 4:15 / 5:15 • Adults 6:45",
  "• Thu: Battle Kick Bot (Kids) — 3:00 / 4:15 / 5:15 • Adults 6:45",
  "• Fri: RoboRacers (Kids & Teens) — 3:00 / 4:15 / 5:15 • Adults 6:45",
  "• Sat: RoboRacers Weekly Track Race (All ages)",
  "• Sun: BattleKick Bot Weekly Field Match (All ages)",
].join("\n");

// Teacher Certification (One-Day) details
const TEACHER_CERT = [
  "One-Day Teacher Certification (10am–5pm) — ₱3,995 with take-home robot, snacks & certificate.",
  "Schedule:",
  "• 10:00–10:30 Overview (Keychain experience)",
  "• 10:30–12:00 3D Modelling",
  "• 12:00–1:00 Lunch",
  "• 1:00–2:00 3D Printing your model",
  "• 2:00–3:00 Basic Mod-Robotics via AI",
  "• 3:00–4:00 Robot assembly",
  "• Q&A",
  CTA.WORKSHOP,
].join("\n");

// Tuition (single source of truth)
const TUITION = "Tuition: ₱3,995/month (unlimited daily time-slot attendance).";

// Franchise packages (short, non-flooding)
const FRAN_OPT1 = [
  "🥇 OPTION-1 — ₱880,000 (Promo: ₱695,000 for first 30 branches)",
  "Includes: 10 printers, 15kg filament, 43” TV, 10 toolkits & USBs, 3 major apps, display robots, best-selling printable files, HD logos/posters.",
  "Plus: Intensive owner + facilitator training (F2F + weekly Zoom), full modules & manuals, lifetime tech & business support, AI web platform.",
  "Bonus: FREE round signage if confirmed within 7 days of message.",
].join("\n");

const FRAN_OPT2 = [
  "🥇 OPTION-2 — ₱660,000 (Promo: ₱495,000 for first 30 branches)",
  "Includes: 5 printers, 7kg filament, 43” TV, 5 toolkits & USBs, 3 major apps, display robots, best-selling printable files, HD logos/posters.",
  "Plus: Intensive owner + facilitator training (F2F + weekly Zoom), full modules & manuals, lifetime tech & business support, AI web platform.",
  "Bonus: FREE round signage if confirmed within 7 days of message.",
].join("\n");

const FRAN_STEPS = [
  "Steps to Start (one branch per city):",
  "1) Reserve your promo slot (10% of promo cost) to secure your city.",
  "2) 40% after target opening set (order equipment ~45 days before opening).",
  "3) Final 50% two weeks before delivery (one week before opening).",
  "Training runs between milestones (FREE).",
  "CORE-30 perks (first 30): lifetime no royalty & no renewal, core-group status, VIP benefits, big discounts, freebies. (28 taken; last slots going.)",
  CTA.FRANCH,
].join("\n");

const FRAN_MULTI_BIZ = [
  "Multiple income streams in one package:",
  "• Tech Playschool (3D Printing + Robotics-AI)",
  "• 3D Printing Services / Farm",
  "• Co-Maker Space (rent your space per hour)",
  "• Retail: printers, materials, robotics components via us",
  "• Create & sell your own 3D products online (Shopee/Lazada) — we train you",
  "We set up equipment, train your team, give you AI-assisted ops platform, marketing support, branding kits, and social assets.",
  "Target monthly potential: ₱300,000+ (depends on execution).",
  CTA.FRANCH,
].join("\n");

// Branch directory (subset for speed; add more anytime)
const BRANCHES = [
  { name: "Nuvali (Sta. Rosa Laguna) — DEFAULT", contact: "0985 383 3878", addr: "2F Laguna Central (near Shopwise), Sta. Rosa, Laguna" },
  { name: "Makati City", contact: "0917 672 6871", addr: "Unit 127, Mile Long Bldg., Legazpi Village" },
  { name: "Imus City (Cavite)", contact: "0956 895 0278", addr: "Robofab 3DBotics Imus, 189 RCJ Commercial Bldg., Bayan Luma 1" },
  { name: "Las Piñas", contact: "0998 530 9437", addr: "Unit 115 Vatican Bldg., BF Resort" },
  { name: "Bacoor (Cavite)", contact: "0917 872 3189", addr: "2F Main Square Mall, Bayanan" },
  { name: "Cabuyao City", contact: "0920 276 1204", addr: "Unit 3C RLI Bldg., Southpoint, Banay-Banay" },
  { name: "Los Baños", contact: "0936 213 9211", addr: "Batong Malake (UPLB area)" },
  { name: "Mandaluyong", contact: "0917 578 1611", addr: "6F MG Tower II, Shaw Blvd." },
  { name: "Ortigas", contact: "0918 964 4285", addr: "GF Goldloop Towers, Ortigas Center" },
  { name: "Taguig", contact: "0917 557 2078 / 0927 647 8955", addr: "2F #72 MRT Ave., Central Signal Village" },
  { name: "Pasay City", contact: "0929 374 3932 / 0976 149 2525", addr: "722 P. Santos St., Brgy. 169, Malibay" },
  { name: "San Fernando (Pampanga)", contact: "0956 886 9739", addr: "#7 Residenza Townhomes, Don Ramon Ave., San Agustin" },
  { name: "San Pablo City", contact: "0945 289 0343", addr: "Tech Wiz Club-3DBotics, 4 Lt. R. Brion St." },
  { name: "San Pedro (Laguna)", contact: "0993 728 6308", addr: "28 Amorsolo, Brgy. Chrysanthemum" },
  { name: "Sto. Tomas (Batangas)", contact: "0945 289 0343", addr: "#19 A. Bonifacio St., Poblacion 2" },
  { name: "Tarlac", contact: "0943 134 9368", addr: "Bayanihan Institute, St. Mary’s Subd., Matatalaib" },
  { name: "Urdaneta City", contact: "0908 224 6367", addr: "3F RjR Bldg., San Vicente" },
  { name: "Bacolod", contact: "0919 065 2600", addr: "2F Mayfair Plaza, 12th Lacson St." },
  { name: "Bohol (Tagbilaran)", contact: "0905 225 1088", addr: "G/F Konnichiwa Bldg., J.B. Gallares St., Dampas" },
  { name: "Tacloban", contact: "0917 850 2008", addr: "GF Primark Town Center, Caibaan" },
  { name: "Ormoc City", contact: "0969 648 2744", addr: "UG 113, Chinatown Eastgate, Lilia Ave., Brgy. Cogon" },
  { name: "Cagayan de Oro", contact: "0976 176 5241", addr: "Room 3D, H Building, Masterson Miles, Upper Carmen" },
  // Add remaining branches anytime…
];

// ====== SENDING (anti-flood + chunking) ======
const handledMIDs = new Map();           // mid -> ts
const MID_TTL_MS  = 10 * 60 * 1000;      // 10 minutes
const CHUNK = 900;                        // safe Messenger chunk length

function dedupe(mid) {
  const now = Date.now();
  for (const [k, t] of handledMIDs) if (now - t > MID_TTL_MS) handledMIDs.delete(k);
  if (handledMIDs.has(mid)) return true;
  handledMIDs.set(mid, now);
  return false;
}

async function sendText(psid, text) {
  const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_TOKEN}`;
  const parts = [];
  for (let i = 0; i < text.length; i += CHUNK) parts.push(text.slice(i, i + CHUNK));
  for (const p of parts) {
    const body = { messaging_type: "RESPONSE", recipient: { id: psid }, message: { text: p } };
    await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  }
}

// ====== INTENT LOGIC ======
const HELP = "Try: “schedule”, “tuition”, “materials”, “branches”, “branch Makati”, “enroll”, “franchise”, “franchise steps”, “franchise income”, “workshop”.";

function normalize(s="") { return s.toLowerCase().trim(); }

function replyFor(textIn) {
  const t = normalize(textIn);

  // greetings / about
  if (/^(hi|hello|hey)\b|what is 3dbotics|about\b/.test(t)) {
    return `${ABOUT_TECH_DOJO}\n\n${TUITION}\n${DOJO_SLOTS}\n${CTA.ENROLL}\n\n${HELP}`;
  }

  // tuition / price
  if (/(tuition|price|magkano|fee|3,?995|3995)/.test(t)) {
    return `${TUITION}\n${DOJO_SLOTS}\n${CTA.ENROLL}`;
  }

  // materials / kit / uniform
  if (/(material|kit|uniform|labgown|consumable|bayad|magkano materials)/.test(t)) {
    return `${MATERIALS_FEES}\n${CTA.ENROLL}`;
  }

  // schedule / dojo / time / slots
  if (/(schedule|oras|time|slot|tech\s*dojo|dojo)/.test(t)) {
    return `${ABOUT_TECH_DOJO}\n${DOJO_SLOTS}\n${WEEK_TRACKS}\n${CTA.ENROLL}`;
  }

  // enroll
  if (/enroll|enrol|sign ?up|join/.test(t)) {
    return `${CTA.ENROLL}\n\n${TUITION}\n${MATERIALS_FEES}`;
  }

  // workshop / teacher certification
  if (/workshop|teacher|cert/i.test(t)) {
    return `${TEACHER_CERT}`;
  }

  // branches summary
  if (/(branch|branches|saan|address|location|where)/.test(t) && !/branch\s+\w+/.test(t)) {
    const list = BRANCHES.slice(0, 12).map(b => `• ${b.name} — ${b.contact}`).join("\n");
    return `Branches (sample):\n${list}\n\nAsk for a city: e.g., “branch Makati”.\nDefault enrollment: Nuvali — ${CTA.ENROLL}`;
  }

  // branch + city
  const m = t.match(/branch\s+(.+)/i);
  if (m) {
    const city = m[1].trim();
    const hit = BRANCHES.find(b => b.name.toLowerCase().includes(city.toLowerCase()));
    if (hit) {
      return `${hit.name}\nContact: ${hit.contact}\nAddress: ${hit.addr}\n\n${TUITION}\n${CTA.ENROLL}`;
    }
    return `I can’t find that branch yet. Tell me the exact city name, or enroll at Nuvali. ${CTA.ENROLL}`;
  }

  // franchise (packages)
  if (/franchise\b|package|investment|magkana franchise/.test(t)) {
    return `${FRAN_OPT1}\n\n${FRAN_OPT2}\n\n${FRAN_STEPS}`;
  }

  // franchise steps
  if (/franchise step|how to start|paano mag start/.test(t)) {
    return `${FRAN_STEPS}`;
  }

  // franchise income / multi-business
  if (/income|earn|roi|sources|business/.test(t) && /franchi|package|3dbotics/.test(t)) {
    return `${FRAN_MULTI_BIZ}`;
  }

  // default fallback (short, no flood)
  return `I can help with Tech Dojo (schedule, tuition, materials, branches) and Franchise details.\n${HELP}`;
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
      try { await sendText(sender, replyFor(text)); }
      catch (e) { console.error("send error", e); }
    }
  }
  res.sendStatus(200);
});

// Health
app.get("/", (_req, res) => res.status(200).send("3DBotics Tech Dojo + Franchise bot up"));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("Bot listening on " + PORT));