import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";

const app = express();
app.use(bodyParser.json());

const VERIFY_TOKEN = process.env.MESSENGER_VERIFY_TOKEN;
const PAGE_TOKEN = process.env.MESSENGER_PAGE_TOKEN;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

// webhook verification
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token && mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  } else {
    return res.sendStatus(403);
  }
});

// handling messages
app.post("/webhook", async (req, res) => {
  const body = req.body;

  if (body.object === "page") {
    for (let entry of body.entry) {
      for (let event of entry.messaging) {
        if (event.message && event.sender) {
          const sender = event.sender.id;
          const text = event.message.text || "";

          // send to OpenAI
          const replyText = await getChatGPTReply(text);

          // reply to messenger
          await callSendAPI(sender, replyText);
        }
      }
    }
    return res.sendStatus(200);
  } else {
    return res.sendStatus(404);
  }
});

async function getChatGPTReply(message) {
  const completion = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-5",
      messages: [
        { role: "system", content: "You are ChatGPT replying as if talking casually to a Filipino business owner named Veni. You are 70% casual, 30% formal, and you give your personal opinion, not neutral."},
        { role: "user", content: message }
      ]
    })
  });
  const data = await completion.json();
  return data.choices?.[0]?.message?.content || "I cannot think right now haha.";
}

async function callSendAPI(sender, response) {
  await fetch(`https://graph.facebook.com/v17.0/me/messages?access_token=${PAGE_TOKEN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: sender },
      message: { text: response }
    })
  });
}

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("server running on port", PORT));
