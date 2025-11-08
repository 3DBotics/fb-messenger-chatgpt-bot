// index.js — 3DBotics Messenger Bot (stable, anti-loop, intents + Tech Dojo context)
// Node 18+ (Cloud Run). No extra deps beyond express.
// ENV required: MESSENGER_PAGE_TOKEN, VERIFY_TOKEN, OPENAI_API_KEY (optional)

const express = require("express");
const crypto = require("crypto");

// ---------- ENV ----------
const PAGE_TOKEN   = process.env.MESSENGER_PAGE_TOKEN;  // from Meta → Generate token
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;          // the exact phrase you put in Meta (e.g., "3dboticsbot")
const OPENAI_KEY   = process.env.OPENAI_API_KEY || "";  // optional

if (!PAGE_TOKEN || !VERIFY_TOKEN) {
  console.warn("[BOOT] Missing PAGE_TOKEN or VERIFY_TOKEN. Set env vars in Cloud Run.");
}

// ---------- SERVER ----------
const app = express();
app.use(express.json({ verify: rawBodySaver }));
function rawBodySaver(req, res, buf) { req.rawBody = buf; }

// ---------- SIMPLE DE-DUP so we don’t loop ----------
const handledMids = new Map(); // mid -> timestamp
const MID_TTL_MS = 5 * 60 * 1000; // keep for 5 minutes to avoid repeats

function seenMessage(mid) {
  const now = Date.now();
  // purge old
  for (const [k, v] of handledMids.entries()) if (now - v > MID_TTL_MS) handledMids.delete(k);
  if (!mid) return false;
  if (handledMids.has(mid)) return true;
  handledMids.set(mid, now);
  return false;
}

// ---------- 3DBotics knowledge (edit anytime) ----------
const BUSINESS_CONTEXT = `
You are the official assistant for 3DBotics (3D Designing, 3D Printing, AI-assisted coding, and AI “new age” Robotics).
Tone: 70% casual, 30% formal. Address the user as "veni". Give opinions when helpful; avoid neutral fluff.

TECH DOJO (Lab-Gown Progression):
- Gown colors: white → green → yellow → red → black.
- Promotion requires perfect attendance for a set block (e.g., 12 sessions) AND minimum wins in dojo contests/sparring.
- Two specialization tracks students can choose: RoboRacers or Battle KickBots.
- Flexible attendance: kids, teens, adults can mix & match daily time slots (no fixed weekly schedule).
- Branches can configure their own daily slots; students may attend any published slot.

COURSE LEVELS (core):
- Basic (3D Modeling): sketch → CAD → output 3D object files. Tools often AutoCAD/Tinkercad/Fusion.
  - Output: a 3D-printed car; includes an ESET so it can be remote-controlled at Basic.
- MM1 (3D Printing Ops): slicing, file prep, infill/perimeter config, durability, running printers A→Z.
  - Output: a robot arm.
- MM2-A (Intro Robotics): Arduino/ESP32 basics; LEDs, sensors, buzzers, servos; bring prints to life.
  - Output: a dancing robot (servos + lights + sound).
- MM2-B (Advanced Robotics): integrate DC/TT motors, servos, LEDs, MP3, sensors → full obstacle-avoiding robot.
- AI integration across all levels: codes (Python/C++) are generated with AI and learned through understanding.

SCHEDULING MODEL:
- Default message: “Flexible daily slots; confirm today’s times with your branch.”
- If a branch uploads set slots, show them. Otherwise do not invent times.

FRANCHISE (short):
- Package includes printers, toolkits, modules, training, marketing assets, AI operations platform, and lifetime support.
- For franchise training/enrollment, contact John Villamil (COO) for next steps.

Rules:
- Don’t discuss politics or unrelated personal advice.
- If a asked question is outside 3DBotics/LalaSpa scope, say you’re focused on 3DBotics and offer the main menu.
`;

// Optional: per-branch schedules you can fill later (kept simple for now)
const SCHEDULES = {
  // Example: "Nuvali": ["10:00–12:00", "13:00–15:00", "16:00–18:00"],
};
const DEFAULT_SCHEDULE_LINE =
  "We run flexible daily slots. Please confirm today’s times with your chosen branch.";

// ---------- INTENTS (tight regex, no more 'match everything') ----------
const INTENTS = [
  {
    name: "menu",
    test: /^(menu|help|options|\?)$/i,
    reply: () =>
      "Here’s what I can help with right now:\n" +
      "• “courses” – full 3DBotics levels\n" +
      "• “tech dojo” – gown system + promotions\n" +
      "• “schedule <branch>” – today’s time slots\n" +
      "• “franchise” – franchise info\n" +
      "• “contact” – how to reach us\n" +
      "You can ask in Taglish, it’s okay."
  },
  {
    name: "courses",
    test: /\b(course|courses|class|tuition|modules?|levels?|3dbotics)\b/i,
    reply: () =>
      "3DBotics course ladder:\n" +
      "• **Basic (3D Modeling)** – sketch → CAD → 3D object files. Output: 3D-printed car with ESET so it moves.\n" +
      "• **MM1 (3D Printing Ops)** – slicing, infill/perimeter, durability, operations A→Z. Output: robot arm.\n" +
      "• **MM2-A (Intro Robotics)** – LEDs, sensors, buzzers, servos; AI-assisted coding. Output: dancing robot.\n" +
      "• **MM2-B (Advanced Robotics)** – DC/TT motors, servos, LEDs, MP3, sensors → obstacle-avoiding robot.\n" +
      "AI is used across all levels (we generate code via AI, students learn to understand and modify it)."
  },
  {
    name: "techdojo",
    test: /\b(tech\s*dojo|dojo|lab\s*gown|belt|promotion|rank)\b/i,
    reply: () =>
      "TECH DOJO system:\n" +
      "• Gowns: white → green → yellow → red → black\n" +
      "• To upgrade: perfect attendance for the block (e.g., 12 sessions) **and** a minimum number of wins in dojo contests/sparring\n" +
      "• Tracks: RoboRacers or Battle KickBots\n" +
      "• Flexible attendance: kids, teens, adults can mix & match daily slots (no fixed weekly schedule)\n" +
      "Ask me: “schedule <branch>” to view today’s slots."
  },
  {
    name: "schedule",
    test: /\bschedule(?:\s+for)?\s+(.+)\b/i, // e.g., "schedule nuvali"
    reply: (_text, match) => {
      const branch = (match && match[1] || "").trim();
      if (!branch) return DEFAULT_SCHEDULE_LINE;
      const key = branch.toLowerCase();
      const hit = Object.keys(SCHEDULES).find(
        b => b.toLowerCase() === key
      );
      if (hit) {
        const lines = SCHEDULES[hit].map(t => `• ${t}`).join("\n");
        return `Today’s ${hit} slots:\n${lines}\n\nTip: arrive 10 mins early.`;
      }
      return `${DEFAULT_SCHEDULE_LINE}\n(Branch mentioned: “${branch}”)`;
    }
  },
  {
    name: "franchise",
    test: /\b(franchise|magkano|package|branch|invest|partner)\b/i,
    reply: () =>
      "Franchise quick view:\n" +
      "• Includes printers, toolkits, modules, training, marketing assets, and our AI operations platform\n" +
      "• Lifetime tech & business support\n" +
      "• To enroll or ask pricing, ping **John Villamil (COO)** and we’ll guide you step-by-step"
  },
  {
    name: "contact",
    test: /\b(contact|call|phone|email|location|saan|reach)\b/i,
    reply: () =>
      "Best contact: message this page or coordinate with **John Villamil (COO)** for franchise/ops. " +
      "For class schedules, ask “schedule <branch>”."
  }
];

// fallback: OpenAI answer constrained by our context
async function answerWithOpenAI(userText) {
  if (!OPENAI_KEY) return null;
  try {
    const prompt = [
      { role: "system", content: BUSINESS_CONTEXT },
      {
        role: "user",
        content:
          `User asked: "${userText}". ` +
          "Answer concisely (3–6 lines). If question is outside scope, say you’re focused on 3DBotics and offer 'menu'."
      }
    ];
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: prompt,
        temperature: 0.4
      })
    });
    if (!res.ok) {
      const t = await res.text();
      console.warn("[OPENAI] Bad response:", res.status, t);
      return null;
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (e) {
    console.warn("[OPENAI] error", e.message);
    return null;
  }
}

// ---------- Messenger plumbing ----------
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

app.post("/webhook", async (req, res) => {
  try {
    const body = req.body;
    if (body.object !== "page") {
      return res.sendStatus(404);
    }

    for (const entry of body.entry || []) {
      const events = entry.messaging || [];
      for (const ev of events) {
        const mid = ev.message?.mid || ev.delivery?.watermark || ev.timestamp;
        if (seenMessage(mid)) continue; // stop loops/duplicates

        const senderId = ev.sender && ev.sender.id;
        if (!senderId) continue;

        // Only react to text messages (ignore echoes/postbacks here)
        const text = ev.message && !ev.message.is_echo ? ev.message.text : null;
        if (text) {
          await setTyping(senderId, true);
          const reply = await routeText(text);
          await sendText(senderId, reply);
          await setTyping(senderId, false);
        }
      }
    }
    res.sendStatus(200);
  } catch (e) {
    console.error("[WEBHOOK] error:", e);
    res.sendStatus(200);
  }
});

// ---------- Router ----------
async function routeText(text) {
  const clean = (text || "").trim();

  // 1) exact menu trigger
  if (/^(hi|hello|hey)\b/i.test(clean)) {
    return "Hey veni! Type any of these: “courses”, “tech dojo”, “schedule <branch>”, “franchise”, “contact”, or “menu”.";
  }

  // 2) intent match (first hit wins)
  for (const intent of INTENTS) {
    const m = clean.match(intent.test);
    if (m) return intent.reply(clean, m);
  }

  // 3) fallback to OpenAI (within context) else to menu
  const ai = await answerWithOpenAI(clean);
  if (ai) return ai;

  return "I can help with Tech Dojo, schedules, franchise, and courses. Type “menu” to see options.";
}

// ---------- FB send helpers ----------
async function sendText(psid, text) {
  const body = {
    recipient: { id: psid },
    messaging_type: "RESPONSE",
    message: { text: text.slice(0, 1999) } // safe length
  };
  const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${encodeURIComponent(PAGE_TOKEN)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const t = await res.text();
    console.warn("[SEND] FB error:", res.status, t);
  }
}

async function setTyping(psid, on = true) {
  const body = {
    recipient: { id: psid },
    sender_action: on ? "typing_on" : "typing_off"
  };
  const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${encodeURIComponent(PAGE_TOKEN)}`;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  } catch (e) {
    // ignore typing failures
  }
}

// ---------- START ----------
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`[BOOT] 3DBotics bot up on :${PORT}`);
});