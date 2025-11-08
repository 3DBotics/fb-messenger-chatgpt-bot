// index.js — FB Messenger Chatbot for 3DBotics (Cloud Run friendly)
// Requirements (set in Cloud Run > Variables & Secrets):
// MESSENGER_PAGE_TOKEN = your Page Access Token (Generate Token in Messenger API Settings)
// VERIFY_TOKEN         = any secret phrase you choose (use the same in Meta "Verify token")
// OPENAI_API_KEY       = (optional) to use AI fallback
// META_APP_SECRET      = (optional) adds signature verification

const express = require("express");
const crypto = require("crypto");

const app = express();
app.use(express.json({ verify: rawBodySaver }));

// ======== ENV ========
const PAGE_TOKEN = process.env.MESSENGER_PAGE_TOKEN || "";
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "";
const META_APP_SECRET = process.env.META_APP_SECRET || "";
const PORT = process.env.PORT || 8080;

// ======== Optional signature verification ========
function rawBodySaver(req, res, buf) {
  req.rawBody = buf;
}
function verifySignature(req) {
  if (!META_APP_SECRET) return true; // skip if not configured
  const sig = req.get("x-hub-signature-256") || "";
  if (!sig.startsWith("sha256=")) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", META_APP_SECRET)
    .update(req.rawBody || Buffer.from(""))
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

// ======== Business context (used in replies/AI fallback) ========
const BUSINESS_CONTEXT = `
You are the official assistant for 3DBotics (3D Designing, 3D Printing, AI-assisted coding, and AI “new age” Robotics).
Tone: 70% casual, 30% formal. Give opinions, be concise, and be helpful. Call the user "veni" if name is known.
If asked outside scope (politics, random trivia, unrelated personal advice), politely steer back to 3DBotics topics.
`;

// ======== TECH DOJO knowledge ========
const DOJO_OVERVIEW = `
TECH DOJO = ongoing, dojo-style robotics training with lab gown promotions
(white → green → blue → yellow → red → black).

Promotion is earned by:
• Attendance streaks (e.g., 12 straight sessions) and
• Points/wins in in-class sparring/tournaments.

Two specialization tracks (students can switch later):
• RoboRacers — speed/control, line-tracking, obstacles, chassis & gear ratios
• KickBots — combat basics, torque vs speed, armor design, servo/linkage durability

Core skills across all ranks:
• 3D Modeling → 3D Printing → Assembly/Tuning → AI-assisted coding → Testing/Iteration
• Safety checklist, tool discipline, troubleshooting logs

Promotion Day: twice a month. Judges check build quality, wiring neatness, reliability,
and code understanding (even if AI-generated). Mixed-age classes (kids ~6+, teens, adults).
`;

const DOJO_SCHEDULE_TEXT = `
TECH DOJO — NATIONAL DEFAULT WEEKLY SCHEDULE
Mon–Fri: 10:00–12:00 • 13:00–15:00 • 16:00–18:00 • 18:00–20:00
Sat:     09:00–11:00 • 13:00–15:00 • 16:00–18:00
Sun:     09:00–11:00 • 13:00–15:00 • 16:00–18:00

Rules:
• Flexible attendance — come to any open slot; check in at the desk.
• Bring your logbook each session; missing a session resets the streak.
• Promotion Day: 2× monthly (ask staff for next date).
• Branch holidays/events may adjust times.
`;

// Optional per-branch overrides (fill these as you finalize local timetables)
const DOJO_BRANCH_SCHEDULES = {
  // "Nuvali": "Mon–Fri 1–3 • 4–6 • 6–8\nSat–Sun 9–11 • 1–3 • 4–6",
  // "Makati": "Weekdays 10–12 • 2–4 • 6–8\nWeekends 9–11 • 1–3 • 4–6"
};
function getDojoSchedule(branch) {
  if (!branch) return DOJO_SCHEDULE_TEXT.trim();
  const key = branch.trim().toLowerCase();
  const hit = Object.keys(DOJO_BRANCH_SCHEDULES).find(b => b.toLowerCase() === key);
  return (hit ? DOJO_BRANCH_SCHEDULES[hit] : null) || DOJO_SCHEDULE_TEXT.trim();
}

// ======== Simple intent rules ========
const INTENTS = [
  {
    name: "greet",
    match: /^(hi|hello|hey|kumusta|good (am|pm)|yo)\b/i,
    reply: "Hey veni! Great to see you here. What are you building today?\n\nType:\n• menu — see what I can help with\n• tech dojo — learn the dojo system\n• dojo schedule — see training times"
  },
  {
    name: "menu",
    match: /(menu|help|options)$/i,
    reply:
      "Here’s what I can help with right now:\n• 3DBotics courses & pricing\n• Tech Dojo info & schedule\n• Franchise basics\n\nTry: “tech dojo”, “dojo schedule”, or “franchise”."
  },
  {
    name: "courses_basic",
    match: /(course|class|tuition|module|3dbotics).*/i,
    reply:
      "3DBotics trains students in 3D Modeling, 3D Printing, and AI-assisted robotics — fast, hands-on, and project-based. Ask me about **Tech Dojo** to see our continuous promotion system."
  },

  // ======= New: Tech Dojo overview =======
  {
    name: "tech_dojo_overview",
    match: /(tech\s*dojo|dojo|lab\s*gown|belt system|roboracers?|kickbots?)/i,
    reply: DOJO_OVERVIEW.trim()
  },

  // ======= New: Tech Dojo schedule (detects optional "in/at <branch>") =======
  {
    name: "tech_dojo_schedule",
    match: /(dojo).*(schedule|time|hours)|^(dojo\s*sched(ule)?|schedule)$/i,
    reply: (text) => {
      const m = text.match(/(?:at|in)\s+([a-zA-Z\s.\-]{3,40})$/i);
      const branch = m ? m[1] : null;
      const body = getDojoSchedule(branch);
      const header = branch ? `Branch: ${branch}\n\n` : "";
      return `${header}${body}\n\nNeed a specific day? Say “dojo schedule in <your city>”.`;
    }
  },

  {
    name: "franchise",
    match: /(franchise|magkano|package|branch)/i,
    reply:
      "Franchise includes printers, toolkits, training, AI web platform, and marketing assets. We support ops end-to-end so a trainable facilitator can run the dojo. Want a quick call?"
  }
];

// ======== Utilities ========
function chooseIntent(text) {
  const t = (text || "").trim();
  for (const intent of INTENTS) {
    if (intent.match.test(t)) {
      if (typeof intent.reply === "function") return intent.reply(t);
      return intent.reply;
    }
  }
  // default steer
  return "I can help with Tech Dojo, schedules, and franchise info. Try: “tech dojo” or “dojo schedule”.";
}

async function sendText(psid, text) {
  if (!PAGE_TOKEN) {
    console.error("PAGE_TOKEN missing. Set MESSENGER_PAGE_TOKEN in Cloud Run.");
    return;
  }
  const url = `https://graph.facebook.com/v18.0/me/messages?access_token=${encodeURIComponent(PAGE_TOKEN)}`;
  const body = {
    recipient: { id: psid },
    message: { text: text }
  };
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!r.ok) {
    const err = await r.text().catch(() => "");
    console.error("FB send error:", r.status, err);
  }
}

// ======== Webhook: Verify (GET) ========
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// ======== Webhook: Receive (POST) ========
app.post("/webhook", async (req, res) => {
  try {
    if (!verifySignature(req)) return res.sendStatus(403);

    const body = req.body;
    if (body.object !== "page") return res.sendStatus(404);

    for (const entry of body.entry || []) {
      for (const event of entry.messaging || []) {
        const sender = event.sender && event.sender.id;
        const text =
          (event.message && event.message.text) ||
          (event.postback && event.postback.title) ||
          "";

        if (!sender) continue;

        const reply = chooseIntent(text);
        await sendText(sender, reply);
      }
    }
    return res.sendStatus(200);
  } catch (e) {
    console.error("Webhook error:", e);
    return res.sendStatus(200); // acknowledge to avoid retries
  }
});

// ======== Health/Root ========
app.get("/", (req, res) => res.status(200).send("3DBotics Messenger bot is alive."));
app.get("/healthz", (req, res) => res.status(200).send("ok"));

// ======== Start server (Cloud Run listens on PORT) ========
app.listen(PORT, () => {
  console.log(`Bot server on :${PORT}`);
});
