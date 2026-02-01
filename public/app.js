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
  let currentAudioUrl = "";
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
    return response.json();
  };

  const makeOptionsPlaceholder = (correctText, count) => {
    // Placeholder option generator; returns clearly different options (not paraphrases).
    const wrongPool = [
      "I missed the bus this morning",
      "The shop closes at six",
      "We met by the river",
      "She left her keys at home",
      "The weather looks stormy",
      "Dinner is in the oven",
      "He paid with cash",
      "They moved last summer",
      "The train is delayed",
      "I found it on the table",
      "We took a different route",
      "The concert starts soon",
      "He forgot his wallet",
      "The cafe is busy today",
      "We need more chairs",
      "She called a taxi",
      "The meeting ran late",
      "I spilled my coffee",
      "The lights went out",
      "We watched a movie",
    ];

    const normalize = (value) =>
      value
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .trim();

    const tooSimilar = (candidate) => {
      const a = normalize(correctText);
      const b = normalize(candidate);
      if (!a || !b) return false;
      if (a === b) return true;

      const aTokens = new Set(a.split(/\s+/).filter(Boolean));
      const bTokens = new Set(b.split(/\s+/).filter(Boolean));
      let intersection = 0;
      aTokens.forEach((token) => {
        if (bTokens.has(token)) intersection += 1;
      });
      const union = aTokens.size + bTokens.size - intersection;
      const score = union ? intersection / union : 0;
      return score > 0.45;
    };

    const options = new Set([correctText]);
    const shuffledPool = shuffle([...wrongPool]);
    for (const phrase of shuffledPool) {
      if (options.size >= count) break;
      if (!tooSimilar(phrase)) options.add(phrase);
    }

    const wrongWords = [
      "bananas",
      "tickets",
      "windows",
      "shoes",
      "snow",
      "bikes",
      "letters",
      "kittens",
    ];

    let attempts = 0;
    while (options.size < count && attempts < 24) {
      attempts += 1;
      const parts = correctText.split(" ");
      if (!parts.length) break;
      const index = Math.floor(Math.random() * parts.length);
      const replacement = wrongWords[Math.floor(Math.random() * wrongWords.length)];
      const candidate = parts.map((word, i) => (i === index ? replacement : word)).join(" ");
      if (!tooSimilar(candidate)) options.add(candidate);
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
    if (!currentAudioUrl) {
      speakLocal(currentSnippet);
      return;
    }

    if (audio) {
      audio.pause();
    }

    audio = new Audio(currentAudioUrl);
    audio.onerror = () => {
      console.warn("[Audio] Clip failed; falling back to SpeechSynthesis.");
      speakLocal(currentSnippet);
    };

    try {
      await audio.play();
    } catch (err) {
      console.warn("[Audio] Playback failed; falling back to SpeechSynthesis.");
      speakLocal(currentSnippet);
    }
  };

  const loadRound = async () => {
    const data = await fetchSnippet();
    currentSnippet = data.text;
    currentAudioUrl = data.audioUrl || "";
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
