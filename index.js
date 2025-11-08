import express from "express"
import axios from "axios"

const app = express()
app.use(express.json())

// ===== BUSINESS CONTEXT =====
const BUSINESS_CONTEXT = `
You are the official assistant for 3DBotics (3D Designing, 3D Printing, AI-assisted coding, new age robotics).
Tone: 70% casual, 30% formal. Address the user as "veni". Give opinions, do not be neutral.
`

// ===== SIMPLE INTENT RULES =====
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
    reply: `3DBotics offers: Basic (3D Modeling) → MM1 (3D printing) → MM2-A (Robotics modules) → MM2-B (Obstacle Avoiding Robot).`
  },
  {
    name: "franchise",
    match: /(franchise|magkano|package|branch)/i,
    reply: `Franchise includes printers, toolkits, modules, training, AI platform and business mentoring.`
  },
]

// ===== ENV VARS =====
const VERIFY_TOKEN = process.env.VERIFY_TOKEN
const PAGE_TOKEN = process.env.MESSENGER_PAGE_TOKEN
const APP_SECRET = process.env.META_APP_SECRET
const OPENAI_KEY = process.env.OPENAI_API_KEY

// ===== VERIFY WEBHOOK =====
app.get("/webhook", (req,res)=>{
  const mode = req.query["hub.mode"]
  const token = req.query["hub.verify_token"]
  const challenge = req.query["hub.challenge"]

  if(mode === "subscribe" && token === VERIFY_TOKEN){
    return res.status(200).send(challenge)
  }
  return res.sendStatus(403)
})

// ===== OPENAI REPLY GENERATOR =====
async function generateAI(userMessage){
  try{
    const completion = await axios.post("https://api.openai.com/v1/chat/completions", {
      model: "gpt-5",
      messages: [
        {role:"system", content: BUSINESS_CONTEXT},
        {role:"user", content: userMessage}
      ]
    },{
      headers:{Authorization:`Bearer ${OPENAI_KEY}`}
    })
    return completion.data.choices[0].message.content
  }catch(e){
    return "Something went wrong but I'm still here."
  }
}

// ===== INCOMING MESSAGES =====
app.post("/webhook", async (req,res)=>{

  const body = req.body

  if(body.object === "page"){
    for(const entry of body.entry){
      for(const msgEvent of entry.messaging){
        const senderId = msgEvent.sender.id
        if(msgEvent.message && msgEvent.message.text){

          const userMsg = msgEvent.message.text

          for(const rule of INTENTS){
            if(rule.match.test(userMsg)){
              await sendText(senderId, rule.reply)
              return res.sendStatus(200)
            }
          }

          const aiReply = await generateAI(userMsg)
          await sendText(senderId, aiReply)
        }
      }
    }
    return res.sendStatus(200)
  }
  res.sendStatus(404)
})

// ===== SEND FB MSG =====
async function sendText(psid, text){
  await axios.post(`https://graph.facebook.com/v17.0/me/messages?access_token=${PAGE_TOKEN}`, {
    recipient:{id:psid},
    message:{text}
  })
}

// ===== CLOUD RUN PORT =====
const PORT = process.env.PORT || 8080
app.listen(PORT, ()=> console.log("3DBotics bot running on "+PORT))
