const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.MESSENGER_PAGE_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token && mode === 'subscribe' && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

app.post('/webhook', async (req, res) => {
  if (req.body.object === 'page') {

    req.body.entry.forEach(async (entry) => {
      const webhook_event = entry.messaging[0];
      const sender_psid = webhook_event.sender.id;

      if (webhook_event.message && webhook_event.message.text) {
        const userMessage = webhook_event.message.text;

        const gptRes = await axios.post("https://api.openai.com/v1/chat/completions",
          {
            model: "gpt-5",
            messages: [
              { role: "system", content: "You are 3DBotics assistant. Talk 70% casual, 30% formal, address user as veni, give opinions not neutral." },
              { role: "user", content: userMessage }
            ]
          },
          { headers: { Authorization: `Bearer ${OPENAI_API_KEY}` } }
        );

        const reply = gptRes.data.choices[0].message.content;

        await axios.post(`https://graph.facebook.com/v17.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
          {
            recipient: { id: sender_psid },
            message: { text: reply }
          }
        );
      }
    });

    return res.sendStatus(200);
  }
  return res.sendStatus(404);
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Bot running on port ${PORT}`));
