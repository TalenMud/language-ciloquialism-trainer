(() => {
  const DIFFICULTY = {
    easy: { label: "Easy", options: 3 },
    medium: { label: "Medium", options: 4 },
    hard: { label: "Hard", options: 5 },
  };

  const DIALECTS = {
    irish: "Irish",
    british: "British",
    australian: "Australian",
  };

  const HIGH_SCORE_COOKIE = "dialect_dash_high_score";

  const startScreen = document.getElementById("startScreen");
  const playScreen = document.getElementById("playScreen");
  const startBtn = document.getElementById("startBtn");
  const dialectOptions = document.getElementById("dialectOptions");
  const difficultyOptions = document.getElementById("difficultyOptions");
  const highScoreEl = document.getElementById("highScore");
  const highScorePlayEl = document.getElementById("highScorePlay");

  const dialectValue = document.getElementById("dialectValue");
  const difficultyValue = document.getElementById("difficultyValue");
  const scoreValue = document.getElementById("scoreValue");
  const playSnippetBtn = document.getElementById("playSnippet");
  const optionsEl = document.getElementById("options");
  const endBtn = document.getElementById("endBtn");

  let difficultyKey = "easy";
  let dialectKey = "";
  let currentSnippet = "";
  let score = 0;
  let audio = null;

  const getCookie = (name) => {
    const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
    return match ? decodeURIComponent(match[2]) : null;
  };

  const setCookie = (name, value, days = 365) => {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
  };

  const shuffle = (arr) => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const getHighScore = () => {
    const stored = Number(getCookie(HIGH_SCORE_COOKIE));
    return Number.isFinite(stored) ? stored : 0;
  };

  const setHighScore = (value) => {
    setCookie(HIGH_SCORE_COOKIE, value);
    highScoreEl.textContent = value;
    highScorePlayEl.textContent = value;
  };

  const renderDialects = () => {
    dialectOptions.innerHTML = "";
    Object.keys(DIALECTS).forEach((key) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `option-btn ${dialectKey === key ? "active" : ""}`;
      btn.textContent = DIALECTS[key];
      btn.addEventListener("click", () => {
        dialectKey = key;
        renderDialects();
        startBtn.disabled = !dialectKey;
      });
      dialectOptions.appendChild(btn);
    });
  };

  const renderDifficulty = () => {
    difficultyOptions.innerHTML = "";
    Object.keys(DIFFICULTY).forEach((key) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `option-btn ${difficultyKey === key ? "active" : ""}`;
      btn.textContent = DIFFICULTY[key].label;
      btn.addEventListener("click", () => {
        difficultyKey = key;
        renderDifficulty();
      });
      difficultyOptions.appendChild(btn);
    });
  };

  const setScreen = (screen) => {
    if (screen === "play") {
      startScreen.classList.add("hidden");
      playScreen.classList.remove("hidden");
    } else {
      playScreen.classList.add("hidden");
      startScreen.classList.remove("hidden");
    }
  };

  const updateHud = () => {
    dialectValue.textContent = DIALECTS[dialectKey] || "";
    difficultyValue.textContent = DIFFICULTY[difficultyKey].label;
    scoreValue.textContent = score;
    const high = getHighScore();
    highScorePlayEl.textContent = high;
  };

  const fetchSnippet = async () => {
    const response = await fetch(`/api/snippet?dialect=${encodeURIComponent(dialectKey || "british")}`);
    if (!response.ok) throw new Error("snippet-failed");
    const data = await response.json();
    return data.text;
  };

  const makeOptionsPlaceholder = (correctText, count) => {
    // Placeholder option generator; replace with real logic later.
    const filler = [
      "placeholder phrase one",
      "placeholder phrase two",
      "placeholder phrase three",
      "placeholder phrase four",
      "placeholder phrase five",
    ];

    const options = new Set([correctText]);
    let index = 0;
    while (options.size < count) {
      options.add(filler[index % filler.length]);
      index += 1;
    }
    return shuffle(Array.from(options));
  };

  const renderOptions = (options) => {
    optionsEl.innerHTML = "";
    optionsEl.classList.remove("columns-3", "columns-4", "columns-5");
    optionsEl.classList.add(`columns-${options.length}`);
    options.forEach((option) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "option";
      btn.textContent = option;
      btn.addEventListener("click", () => handleChoice(option));
      optionsEl.appendChild(btn);
    });
  };

  const speakLocal = (text) => {
    if (!text || !("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-GB";
    utterance.rate = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const playSnippet = async () => {
    if (!currentSnippet) return;
    try {
      console.info(`[TTS] Requesting ElevenLabs for accent=${dialectKey || "british"}`);
      const res = await fetch(
        `/api/tts?text=${encodeURIComponent(currentSnippet)}&accent=${encodeURIComponent(
          dialectKey || "british"
        )}`
      );
      if (!res.ok) throw new Error("tts-failed");
      const blob = await res.blob();
      if (!blob.size) throw new Error("tts-empty");

      if (audio) {
        audio.pause();
        if (audio.src && audio.src.startsWith("blob:")) {
          URL.revokeObjectURL(audio.src);
        }
      }

      const url = URL.createObjectURL(blob);
      audio = new Audio(url);
      audio.onended = () => {
        URL.revokeObjectURL(url);
      };
      await audio.play();
    } catch (err) {
      console.warn("[TTS] ElevenLabs failed; falling back to SpeechSynthesis.");
      speakLocal(currentSnippet);
    }
  };

  const loadRound = async () => {
    currentSnippet = await fetchSnippet();
    const optionCount = DIFFICULTY[difficultyKey].options;
    const options = makeOptionsPlaceholder(currentSnippet, optionCount);
    renderOptions(options);
    playSnippet();
  };

  const handleChoice = (choice) => {
    if (choice === currentSnippet) {
      score += 10;
      updateHud();
      const high = getHighScore();
      if (score > high) setHighScore(score);
    }
    loadRound();
  };

  const startGame = async () => {
    if (!dialectKey) return;
    score = 0;
    updateHud();
    setScreen("play");
    await loadRound();
  };

  const endGame = () => {
    const high = getHighScore();
    if (score > high) setHighScore(score);
    setScreen("start");
  };

  startBtn.addEventListener("click", startGame);
  playSnippetBtn.addEventListener("click", playSnippet);
  endBtn.addEventListener("click", endGame);

  setHighScore(getHighScore());
  renderDialects();
  renderDifficulty();
  updateHud();
})();
