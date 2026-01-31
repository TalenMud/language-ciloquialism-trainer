const path = require("path");
const { Readable } = require("stream");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || "";
const ELEVEN_MODEL_ID = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";
const ELEVEN_OUTPUT_FORMAT = process.env.ELEVENLABS_OUTPUT_FORMAT || "mp3_44100_128";
const HAS_ELEVENLABS_KEY = Boolean(ELEVENLABS_API_KEY);

const VOICE_IDS = {
  british: process.env.ELEVENLABS_VOICE_BRITISH || "onwK4e9ZLuTAKqWW03F9",
  irish: process.env.ELEVENLABS_VOICE_IRISH || "D38z5RcWu1voky8WS1ja",
  australian: process.env.ELEVENLABS_VOICE_AUSTRALIAN || "IKne3meq5aSn9XLyUdCD",
};

const SNIPPETS = {
  irish: [
    "That's grand altogether",
    "She's a wee legend",
    "We had some craic last night",
    "You're sound, thanks",
  ],
  british: [
    "That's proper brilliant",
    "Fancy a cuppa?",
    "He's having a laugh",
    "Queue up over there",
  ],
  australian: [
    "No worries, mate",
    "Grab some brekkie",
    "See you this arvo",
    "Chuck it in the esky",
  ],
};

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// Placeholder backend call to generate a snippet.
app.get("/api/snippet", (req, res) => {
  const dialect = String(req.query.dialect || "british").toLowerCase();
  const pool = SNIPPETS[dialect] || SNIPPETS.british;
  const text = pool[Math.floor(Math.random() * pool.length)];
  res.json({ text, dialect });
});

// ElevenLabs TTS proxy.
app.get("/api/tts", async (req, res) => {
  const text = String(req.query.text || "").trim();
  const accent = String(req.query.accent || "british").toLowerCase();
  console.log(`[TTS] request accent=${accent} elevenlabs=${HAS_ELEVENLABS_KEY}`);
  if (!text) {
    res.status(400).send("Missing ?text=");
    return;
  }
  if (!VOICE_IDS[accent]) {
    res.status(400).send("Invalid accent. Use british|irish|australian");
    return;
  }
  if (!ELEVENLABS_API_KEY) {
    console.warn("[TTS] Missing ELEVENLABS_API_KEY; cannot use ElevenLabs.");
    res.status(500).send("Missing ELEVENLABS_API_KEY");
    return;
  }

  const voiceId = VOICE_IDS[accent];
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=${encodeURIComponent(
    ELEVEN_OUTPUT_FORMAT
  )}`;

  try {
    const elevenRes = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: ELEVEN_MODEL_ID,
      }),
    });

    if (!elevenRes.ok || !elevenRes.body) {
      const errText = await elevenRes.text().catch(() => "");
      console.warn(`[TTS] ElevenLabs error ${elevenRes.status}`);
      res.status(502).send(`ElevenLabs error: ${elevenRes.status} ${errText}`);
      return;
    }

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("X-Accent", accent);

    const nodeStream = Readable.fromWeb(elevenRes.body);
    nodeStream.pipe(res);
  } catch (err) {
    console.warn("[TTS] ElevenLabs request failed");
    res.status(502).send("ElevenLabs request failed");
  }
});

app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`[TTS] ElevenLabs ${HAS_ELEVENLABS_KEY ? "enabled" : "disabled"}`);
});
