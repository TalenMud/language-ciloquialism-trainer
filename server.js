const path = require("path");
const fs = require("fs");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

const AUDIO_ROOT = path.join(__dirname, "public", "voice clips");
const DIALECT_DIRS = {
  irish: "Irish",
  british: "brit",
  australian: "aussie",
};

const PREFIXES = {
  irish: [/^Irish\s*-\s*/i],
  british: [/^British \(northern\)\s*-\s*/i, /^British\s*-\s*/i],
  australian: [/^Aussie\s*-\s*/i, /^Australian\s*-\s*/i],
};

const cleanText = (baseName, dialect) => {
  let text = baseName;
  (PREFIXES[dialect] || []).forEach((pattern) => {
    text = text.replace(pattern, "");
  });
  return text.replace(/\s+/g, " ").trim();
};

const loadClips = () => {
  const result = {};
  Object.entries(DIALECT_DIRS).forEach(([dialect, dirName]) => {
    const dirPath = path.join(AUDIO_ROOT, dirName);
    if (!fs.existsSync(dirPath)) {
      result[dialect] = [];
      return;
    }
    const files = fs
      .readdirSync(dirPath)
      .filter((file) => file.toLowerCase().endsWith(".mp3"));

    result[dialect] = files.map((file) => {
      const baseName = path.parse(file).name;
      return {
        text: cleanText(baseName, dialect),
        audioUrl: encodeURI(`/voice clips/${dirName}/${file}`),
      };
    });
  });
  return result;
};

const CLIPS = loadClips();

const getRandomClip = (dialect) => {
  const list = CLIPS[dialect] && CLIPS[dialect].length ? CLIPS[dialect] : CLIPS.british;
  if (!list || !list.length) return null;
  return list[Math.floor(Math.random() * list.length)];
};

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/api/snippet", (req, res) => {
  const dialect = String(req.query.dialect || "british").toLowerCase();
  const clip = getRandomClip(dialect);
  if (!clip) {
    res.status(500).json({ error: "No clips available" });
    return;
  }
  res.json({ text: clip.text, dialect, audioUrl: clip.audioUrl });
});

app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(
    `[Clips] irish=${CLIPS.irish?.length || 0} british=${CLIPS.british?.length || 0} australian=${
      CLIPS.australian?.length || 0
    }`
  );
});
