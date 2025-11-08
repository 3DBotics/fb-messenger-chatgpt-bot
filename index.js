// index.js — 3DBotics Tech Dojo Messenger Bot
import express from "express";
import crypto from "crypto";
import fetch from "node-fetch";

// ==== ENV ====
const PAGE_TOKEN   = process.env.MESSENGER_PAGE_TOKEN;
const VERIFY_TOKEN = process.env.MESSENGER_VERIFY_TOKEN;
const APP_SECRET   = process.env.META_APP_SECRET;
const OPENAI_KEY   = process.env.OPENAI_API_KEY;

// ==== EXPRESS ====
const app = express();
app.use(express.json({ verify: verifySignature }));

function verifySignature(req, res, buf) {
  const sig = req.get("x-hub-signature-256");
  if (!sig) return;
  const expected = "sha256=" + crypto.createHmac("sha256", APP_SECRET).update(buf).digest("hex");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) throw new Error("Invalid signature");
}

// ===== STATIC SHORT CONTEXT =====
const SYSTEM_CONTEXT = `
You are the 3DBotics Tech Dojo messenger bot. Tone: 70% casual 30% formal, opinionated (not neutral). Address user as "veni".
Tech Dojo tuition is ₱3,995/month unlimited attendance. Default branch if unspecified = Nuvali.
Enrollment CTA: "To enroll immediately, call the Nuvali Branch Head at 0985-383-3878. Or reply your contact details here and we will call you."
Franchise CTA: "To finalize a franchise, call our executive at 0995-836-2249. Or reply your contact details here and we will call you."
Teacher Workshop CTA: "To reserve your slot for the One-Day Teacher Certification Workshop, call the Nuvali Branch Head at 0985-383-3878."
Keep replies short (3–4 lines max). Always close softly, not aggressive.
`;

// ==== GPT CALL FUNCTION ====
async function askGPT(user) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "Authorization":"Bearer "+OPENAI_KEY
    },
    body:JSON.stringify({
      model:"gpt-4o",
      messages:[
        {role:"system",content:SYSTEM_CONTEXT},
        {role:"user",content:user}
      ]
    })
  });
  const data = await response.json();
  return data?.choices?.[0]?.message?.content || "Ok.";
}

// send back to FB
async function sendText(psid, text) {
  await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_TOKEN}`,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({recipient:{id:psid},message:{text}})
  });
}

// ===== WEBHOOK VERIFY =====
app.get("/webhook",(req,res)=>{
  if(req.query["hub.mode"]==="subscribe" && req.query["hub.verify_token"]===VERIFY_TOKEN){
    return res.status(200).send(req.query["hub.challenge"])
  }
  res.sendStatus(403);
});

// ===== RECEIVE =====
app.post("/webhook", async (req,res)=>{
  if(req.body.object!=="page") return res.sendStatus(404);
  for(const entry of req.body.entry){
    const evt = entry.messaging[0];
    const sender = evt?.sender?.id;
    const text   = evt?.message?.text;
    if(sender && text){
      try{
        const reply = await askGPT(text);
        await sendText(sender, reply);
      }catch(e){ console.log("err",e); }
    }
  }
  res.sendStatus(200);
});

app.get("/",(_req,res)=>res.status(200).send("3DBotics bot running"));
app.listen(process.env.PORT||8080,()=>console.log("up"));