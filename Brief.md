# Read-Along Reader — Build Brief

Oct 20, 2026 · @Connor

> **Status note:** Discovery covered problem, user, core interaction, and platform. Detailed flow, edge cases, and the speech-engine choice were *not* discussed — those appear as **\[inferred\]** defaults or Open Questions. Resolve the Open Questions before building the parts they touch.

## Project Title

Read-Along Reader (v1 of a reading game for my son)

## One-Sentence Summary

A browser-based reader that shows simple sentences in large text, speaks any word the child taps, and can read a whole sentence aloud while highlighting each word as it's spoken.

## Problem & Context

- My 6-year-old son is an early decoder: he sounds out simple words and knows a few sight words, reading roughly 5 words per minute.
- He needs support that lets him do the reading himself but get help the moment he's stuck — rather than passively listening.
- This is the first step toward a reading *game*; v1 deliberately ships the reader alone.
- Starting from scratch. It is a sibling of my other hobby browser games but does not need the three.js/Rapier stack.
- **Constraint carried over from my other projects \[inferred\]:** all project files should be plain, readable/editable text (HTML/CSS/JS/JSON), suited to AI-assisted coding.

## Target User(s)

- **Primary:** my son, age 6, early decoder, using a touchscreen (iPad/iPhone) or Mac.
- **Secondary:** me (parent) — sets up the text and settings.

## Core Features (v1)

- **Tap-to-hear:** tap any word to hear it spoken aloud; the word highlights while it's spoken.
- **Read it to me:** a button that reads the current sentence aloud with each word highlighted as it's spoken.
- **Slow pacing:** speech pacing must be slow enough for a 5-wpm reader to follow the highlight.
- **Cross-device:** runs in the browser on iPhone, iPad, and Mac.

## Design Approach

**Chosen direction:** browser-first, using the built-in Web Speech API (`speechSynthesis`) for v1.

Why, versus alternatives considered:

- **Native iOS/Mac app (Swift + Personal Voice):** the only way to use my own Personal Voice and gets reliable word-timing callbacks — but locks it to Apple devices and requires Xcode. Rejected for v1 because cross-device flexibility was preferred; my voice is nice-to-have, not essential.
- **Live Speech directly:** not possible — other apps can't send text into Live Speech.
- **Recorded clips of my own voice:** viable future path to get my voice in the browser for tap-to-hear. Deferred.
- **Neural TTS in the browser (e.g. Kokoro):** better-sounding voices, but heavier and word timing is less straightforward. Deferred.

**Pacing/highlighting approach \[inferred — confirm\]:** for "Read it to me," speak **one word at a time** (one utterance per word) with a configurable pause between words, highlighting each word just before it's spoken. This sidesteps unreliable word-boundary events across browsers and naturally produces the slow, follow-able pace he needs. A smoother "natural sentence" mode using `boundary` events can be added later.

## User Stories / Actions

- As a child reader, I can tap a word I'm stuck on and hear it, so I can keep reading on my own.
- As a child reader, I can press "Read it to me" and watch each word light up as it's said.
- As a child reader, I can move to the next or previous sentence. **\[inferred\]**
- As a parent, I can change the sentences he reads by editing a text file. **\[inferred\]**
- As a parent, I can adjust speech speed / pause length and choose the voice. **\[inferred\]**

## Step-by-Step Flow

1. Open the page. A large "Start" button appears (needed so the first speech happens after a user tap — iOS requirement). **\[inferred\]**
2. The first sentence displays in large type, each word a separate tappable element.
3. He reads silently or aloud on his own.
4. **Tap a word** → any current speech stops → the word highlights → it is spoken → highlight clears.
5. **Tap "Read it to me"** → words highlight and speak one at a time, left to right, with a pause between each.
6. **Tap Next / Back** → move between sentences. **\[inferred\]**

## Rules & Logic

- Only one thing speaks at a time: any new tap cancels in-progress speech (`speechSynthesis.cancel()`) before starting. **\[inferred\]**
- Punctuation is displayed but not spoken as part of the word, and is not tappable on its own. **\[inferred\]**
- Highlight state always reflects the word currently being spoken; it clears when speech ends or is cancelled. **\[inferred\]**
- Settings (rate, pause length, voice) persist on the device via `localStorage`, wrapped in try/catch. **\[inferred\]**

## Edge Cases & Error Handling

All of these are **\[inferred\]** — none were discussed.

- **Tap during "Read it to me":** cancel the sentence reading and speak the tapped word.
- **Voices load late:** `speechSynthesis.getVoices()` can return empty at first; listen for `voiceschanged` and pick a default English voice once available.
- **No speech support or no voices:** show a clear message; the text stays readable.
- **iPhone silent switch:** web speech may be muted when the ringer switch is off — verify on device and add a hint if so.
- **Single-letter / ambiguous words:** isolated "a" may be pronounced as the letter name ("ay"); provide a small pronunciation-override map (e.g. `a` → "uh").
- **Rapid repeated taps:** debounce so taps don't queue up a backlog of speech.

## Non-Functional Requirements

- **Devices:** iPhone, iPad, Mac browsers (Safari primary, Chrome secondary).
- **Child-friendly UI \[inferred\]:** very large text and tap targets, high contrast, minimal UI, no reading required to operate controls (icons).
- **Privacy \[inferred\]:** fully local — no accounts, no network calls, no data leaves the device.
- **Plain-text project files \[inferred\]:** no build step required.

## Out of Scope / Future Ideas

- Game layer: story progress, collecting/rewards, challenges (find-the-word, picture matching, levels) — deferred, not cut.
- My own voice: via recorded word clips (browser) or Personal Voice (native app).
- Higher-quality neural voices (e.g. Kokoro).
- Natural-flow sentence reading with boundary-synced highlighting.

## Open Questions

1. **Where does the text come from?** Proposed default: a hand-edited `sentences.json` using decodable words he's working on. Alternatives: built-in leveled sets, or typing/pasting text in a parent screen.
   1. Answer: a hand-edited `sentences.json` file that I will populate.
2. **One sentence per screen, or a short page/story?** Proposed default: one sentence per screen.
   1. Variable. One sentence for now but longer paragraphs/stories as he gets better.
3. **Word-by-word reading confirmed?** Or should "Read it to me" sound like natural speech from the start?
   1. word-by-word is fine.
4. **Should "Read it to me" always be available,** or appear only after he's tried (or tapped a word)?
   1. Only after he's tried.
5. **Is a parent settings screen needed in v1,** or are settings fine hard-coded in a config file?
   1. config file.
6. **Primary device** for testing — iPad?
   1. Sure.

## Implementation Notes

- **Files:** `index.html`, `style.css`, `app.js`, `sentences.json` (and optional `config.json`). Vanilla JS, no framework, no build step. Serve locally with any static server; host on GitHub Pages or similar for use on iPad/iPhone.
- **Rendering:** split each sentence on whitespace into tokens; render each as `<span class="word" data-i="n">` holding the display text; store a cleaned `speak` value (punctuation stripped, lowercased, override-mapped).
- **Speech:** one helper — `speakWord(text) → Promise` wrapping a `SpeechSynthesisUtterance`, resolving on `end`/`error`. "Read it to me" = `for` loop over tokens: highlight → `await speakWord` → `await sleep(pauseMs)`; abort via a cancellation token if anything else is tapped.
- **Defaults \[inferred\]:** rate ≈ 0.8, pause between words ≈ 600 ms; both adjustable.
- **Voice:** prefer a local English voice (`localService === true`); expose a picker later.
- **Highlight:** toggle a `.speaking` class; use a large, high-contrast background, not just a color change on the text.
- **Unlock:** first speech call must originate from the Start tap.
- **Build order:** (1) static sentence rendering → (2) tap-to-hear → (3) Read it to me with word-by-word highlighting → (4) next/back navigation → (5) settings + persistence → (6) device testing on iPad/iPhone/Mac.
