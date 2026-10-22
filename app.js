// Read-Along Reader — v1
// Plain JS, no build step. Text comes from sentences.json, settings from config.json.

"use strict";

// ---------- Defaults (overridden by config.json) ----------

const DEFAULT_CONFIG = {
  rate: 0.8,                  // speech rate (1 = normal)
  pitch: 1,
  pauseMs: 600,               // pause between words in "Read it to me"
  lang: "en-US",
  voiceName: "",              // part of a voice name, e.g. "Samantha"; empty = auto-pick
  readToMeDelaySeconds: 20,   // show "Read it to me" after this long, or once a word is tapped
  pronunciations: { a: "uh" } // word -> what to actually say
};

const STORAGE_KEY = "readAlongReader.v1";
const TAPS_KEY = "readAlongReader.taps.v1"; // also read by stats.html
const TAP_DEBOUNCE_MS = 300;
const STATS_HOLD_MS = 1500; // parent shortcut: hold the page counter to open stats.html

// ---------- State ----------

let config = { ...DEFAULT_CONFIG };
let pages = [];
let pageIndex = 0;
let tokens = [];        // [{ el, speak }] for the current page
let voice = null;
let runId = 0;          // bumps on every new speech request; stale runs stop themselves
let currentUtterance = null; // keep a reference so Chrome doesn't garbage-collect it mid-speech
let readBtnTimer = null;
let lastTap = { index: -1, time: 0 };

const $ = (id) => document.getElementById(id);
const els = {
  startScreen: $("start-screen"),
  startBtn: $("start-btn"),
  startHint: $("start-hint"),
  startError: $("start-error"),
  readerScreen: $("reader-screen"),
  pageCount: $("page-count"),
  text: $("text"),
  readerError: $("reader-error"),
  prevBtn: $("prev-btn"),
  readBtn: $("read-btn"),
  nextBtn: $("next-btn")
};

const synth = "speechSynthesis" in window ? window.speechSynthesis : null;

// ---------- Storage (per-device; may be unavailable) ----------

function loadSaved() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function save(patch) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...loadSaved(), ...patch }));
  } catch {
    // Private mode or blocked storage — not important.
  }
}

// Count each word he taps (the words he's stuck on): { word: { count, first, last } }.
// Only taps are counted, not "Read it to me".
function recordTap(word) {
  try {
    const taps = JSON.parse(localStorage.getItem(TAPS_KEY)) || {};
    const now = new Date().toISOString();
    const entry = taps[word] || { count: 0, first: now };
    entry.count += 1;
    entry.last = now;
    taps[word] = entry;
    localStorage.setItem(TAPS_KEY, JSON.stringify(taps));
  } catch {
    // Storage unavailable — tracking is best-effort.
  }
}

// ---------- Loading ----------

async function fetchJson(path) {
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

async function loadContent() {
  try {
    const userConfig = await fetchJson("config.json");
    config = {
      ...DEFAULT_CONFIG,
      ...userConfig,
      pronunciations: { ...DEFAULT_CONFIG.pronunciations, ...(userConfig.pronunciations || {}) }
    };
  } catch (err) {
    console.warn("Using default config:", err);
  }

  // sentences.json may be a plain array or { "pages": [...] }.
  // Each entry is a string; use "\n" inside a string for a line break.
  const data = await fetchJson("sentences.json");
  const list = Array.isArray(data) ? data : data.pages;
  pages = (list || []).map(String).filter((s) => s.trim());
  if (!pages.length) throw new Error("sentences.json has no sentences.");
}

// ---------- Voices ----------

function pickVoice() {
  if (!synth) return null;
  const voices = synth.getVoices();
  if (!voices.length) return null;

  if (config.voiceName) {
    const wanted = config.voiceName.toLowerCase();
    const match = voices.find((v) => v.name.toLowerCase().includes(wanted));
    if (match) return match;
  }

  const lang = config.lang.toLowerCase();
  const english = voices.filter((v) => v.lang.toLowerCase().replace("_", "-").startsWith("en"));
  const exact = english.filter((v) => v.lang.toLowerCase().replace("_", "-") === lang);
  const pool = exact.length ? exact : english;
  return (
    pool.find((v) => v.localService && v.default) ||
    pool.find((v) => v.localService) ||
    pool[0] ||
    voices[0]
  );
}

function refreshVoice() {
  voice = pickVoice();
}

// ---------- Speech ----------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Speak one piece of text. Resolves when it finishes, errors, or is cancelled.
function speakWord(text) {
  return new Promise((resolve) => {
    if (!synth) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.lang = voice ? voice.lang : config.lang;
    u.rate = config.rate;
    u.pitch = config.pitch;

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(safety);
      if (currentUtterance === u) currentUtterance = null;
      resolve();
    };
    // Safari occasionally never fires `end`; don't let the reader hang.
    const safety = setTimeout(finish, 1500 + (text.length * 250) / config.rate);

    u.onend = finish;
    u.onerror = finish;
    currentUtterance = u;
    synth.speak(u);
  });
}

// Stop anything currently speaking and clear highlights. Returns the new run id.
function stopAll() {
  runId += 1;
  if (synth && (synth.speaking || synth.pending)) synth.cancel();
  clearHighlight();
  els.readBtn.classList.remove("active");
  return runId;
}

function clearHighlight() {
  for (const t of tokens) t.el.classList.remove("speaking", "echo");
}

// Highlights the spoken word, and softly marks every other copy of it on the page.
async function sayToken(i, myRun) {
  const t = tokens[i];
  if (!t || myRun !== runId) return;
  clearHighlight();
  t.el.classList.add("speaking");
  const echoes = tokens.filter((o) => o !== t && o.key === t.key);
  for (const o of echoes) o.el.classList.add("echo");
  await speakWord(t.speak);
  if (myRun !== runId) return;
  t.el.classList.remove("speaking");
  for (const o of echoes) o.el.classList.remove("echo");
}

async function speakTapped(i) {
  const now = Date.now();
  if (lastTap.index === i && now - lastTap.time < TAP_DEBOUNCE_MS) return;
  lastTap = { index: i, time: now };
  if (tokens[i]) recordTap(tokens[i].key);

  const myRun = stopAll();
  showReadButton(); // he's tried — offer the full read-along now
  // Some browsers drop an utterance spoken immediately after cancel().
  await sleep(40);
  await sayToken(i, myRun);
}

async function readItToMe() {
  const myRun = stopAll();
  els.readBtn.classList.add("active");
  await sleep(40);
  for (let i = 0; i < tokens.length; i++) {
    if (myRun !== runId) return;
    await sayToken(i, myRun);
    if (myRun !== runId) return;
    if (i < tokens.length - 1) await sleep(config.pauseMs);
  }
  if (myRun === runId) els.readBtn.classList.remove("active");
}

// ---------- Rendering ----------

// Split a whitespace token into leading punctuation, the word, trailing punctuation.
// Apostrophes and hyphens inside a word stay with the word ("don't", "ice-cream").
const TOKEN_RE = /^([^\p{L}\p{N}]*)([\p{L}\p{N}](?:[\p{L}\p{N}'’-]*[\p{L}\p{N}])?)?([^]*)$/u;

// Case-insensitive identity of a word, so "The" and "the" count as the same word.
function wordKey(word) {
  return word.toLowerCase().replace(/’/g, "'");
}

function toSpeech(word) {
  const key = wordKey(word);
  return config.pronunciations[key] ?? key;
}

function renderPage() {
  stopAll();
  const raw = pages[pageIndex];
  tokens = [];
  els.text.textContent = "";

  const lines = raw.split(/\r?\n/);
  lines.forEach((line, lineNo) => {
    if (lineNo > 0) {
      const br = document.createElement("span");
      br.className = "line-break";
      els.text.appendChild(br);
    }
    for (const part of line.split(/\s+/).filter(Boolean)) {
      const [, lead = "", word = "", trail = ""] = part.match(TOKEN_RE);
      const wrap = document.createElement("span");
      wrap.className = "token";

      if (lead) wrap.appendChild(punct(lead));
      if (word) {
        const w = document.createElement("span");
        w.className = "word";
        w.textContent = word;
        w.dataset.i = String(tokens.length);
        tokens.push({ el: w, key: wordKey(word), speak: toSpeech(word) });
        wrap.appendChild(w);
      }
      if (trail) wrap.appendChild(punct(trail));
      els.text.appendChild(wrap);
    }
  });

  // Step the type size down for longer passages.
  const count = tokens.length;
  els.text.classList.toggle("medium", count > 12 && count <= 30);
  els.text.classList.toggle("long", count > 30);

  els.pageCount.textContent = pages.length > 1 ? `${pageIndex + 1} / ${pages.length}` : "";
  els.prevBtn.disabled = pageIndex === 0;
  els.nextBtn.disabled = pageIndex === pages.length - 1;

  hideReadButton();
  clearTimeout(readBtnTimer);
  if (config.readToMeDelaySeconds >= 0) {
    readBtnTimer = setTimeout(showReadButton, config.readToMeDelaySeconds * 1000);
  }
}

function punct(text) {
  const s = document.createElement("span");
  s.className = "punct";
  s.textContent = text;
  return s;
}

function showReadButton() {
  clearTimeout(readBtnTimer);
  els.readBtn.hidden = false;
}

function hideReadButton() {
  els.readBtn.hidden = true;
}

function goTo(index) {
  if (index < 0 || index >= pages.length || index === pageIndex) return;
  pageIndex = index;
  save({ pageIndex });
  renderPage();
}

// ---------- Errors ----------

function showError(el, message) {
  el.textContent = message;
  el.hidden = false;
}

// ---------- Startup ----------

async function start() {
  // This runs inside the Start tap, which unlocks speech on iOS.
  if (synth) {
    const unlock = new SpeechSynthesisUtterance(" ");
    unlock.volume = 0;
    synth.speak(unlock);
  }

  els.startScreen.hidden = true;
  els.readerScreen.hidden = false;
  renderPage();

  if (!synth) {
    showError(els.readerError, "This browser can't speak words out loud. Try Safari or Chrome.");
  } else {
    // Voices can load late; give them a moment before declaring there are none.
    setTimeout(() => {
      if (!synth.getVoices().length) {
        showError(els.readerError, "No voices found on this device, so words can't be spoken.");
      }
    }, 2500);
  }
}

async function init() {
  if (synth) {
    refreshVoice();
    synth.addEventListener?.("voiceschanged", refreshVoice);
  }

  try {
    await loadContent();
  } catch (err) {
    console.error(err);
    els.startBtn.disabled = true;
    showError(
      els.startError,
      location.protocol === "file:"
        ? "Open this through a web server (not by double-clicking the file) so it can load sentences.json."
        : `Couldn't load the sentences: ${err.message}`
    );
    return;
  }
  refreshVoice(); // config may have named a voice

  const saved = loadSaved();
  if (Number.isInteger(saved.pageIndex) && saved.pageIndex < pages.length) {
    pageIndex = saved.pageIndex;
  }

  if (!/iPhone|iPad|iPod/.test(navigator.userAgent) && !(navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent))) {
    els.startHint.hidden = true; // ringer-switch hint only matters on iPhone/iPad
  }

  els.startBtn.addEventListener("click", start);

  els.text.addEventListener("click", (e) => {
    const w = e.target.closest(".word");
    if (w) speakTapped(Number(w.dataset.i));
  });

  els.readBtn.addEventListener("click", readItToMe);
  els.prevBtn.addEventListener("click", () => goTo(pageIndex - 1));
  els.nextBtn.addEventListener("click", () => goTo(pageIndex + 1));

  // Parent shortcut to the tapped-words page. Needed when it runs from the home
  // screen: there's no address bar, and that app keeps its own separate counts.
  let holdTimer = null;
  const cancelHold = () => clearTimeout(holdTimer);
  els.pageCount.addEventListener("pointerdown", () => {
    cancelHold();
    holdTimer = setTimeout(() => {
      stopAll();
      location.href = "stats.html";
    }, STATS_HOLD_MS);
  });
  for (const type of ["pointerup", "pointerleave", "pointercancel"]) {
    els.pageCount.addEventListener(type, cancelHold);
  }

  // Stop talking if the app is backgrounded.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopAll();
  });
}

init();
