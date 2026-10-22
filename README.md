# Read-Along Reader

Large-type sentences. Tap a word to hear it; tap the speaker button to hear the whole page word by word. See `Brief.md` for the design.

## Run it

It must be served (not opened as a file) so it can load the JSON files. Use the included server, which stops browsers caching old copies of the code:

```bash
python3 serve.py
```

If a device still runs old code after an update (e.g. on GitHub Pages, which caches for ~10 minutes), bump the `?v=` number on `app.js` / `style.css` in `index.html` and `stats.html`.

Then open http://localhost:8000. To use it on the iPad, open `http://<your-mac's-IP>:8000` on the same Wi-Fi, or host the folder on GitHub Pages.

## Put it on the home screen

In Safari on the iPad: Share → **Add to Home Screen**. It then opens full screen with its own icon. The icon is drawn by `tools/make_icons.py` (run `python3 tools/make_icons.py` after editing it).

## Change the text — `sentences.json`

One entry per page. Use `\n` inside an entry for a line break, so a page can be a sentence or a short story:

```json
{ "pages": ["The cat sat.", "Mom and I go to the park.\nWe sit on the grass."] }
```

## Change the settings — `config.json`

| Key | Meaning |
| --- | --- |
| `rate` | Speech speed (1 = normal, 0.8 = a bit slower). |
| `pitch` | Voice pitch (1 = normal). |
| `pauseMs` | Pause between words in "Read it to me", in milliseconds. |
| `lang` | Preferred voice language, e.g. `en-US`, `en-GB`. |
| `voiceName` | Part of a voice's name to force it, e.g. `"Samantha"`. Empty = auto-pick a local English voice. |
| `readToMeDelaySeconds` | The "Read it to me" button appears once he taps any word, or after this many seconds on a page. |
| `pronunciations` | Word → what to say instead, e.g. `"a": "uh"` so "a" isn't said as the letter name. |

The current page is remembered on each device.

## Tapped words — `stats.html`

Every word he taps is counted on the device (not "Read it to me"). Open `stats.html` (e.g. http://localhost:8000/stats.html) to see the words he's needed help with, most-tapped first, with a "Clear all" button. Nothing leaves the device.

**From the home-screen app** (no address bar): press and hold the page counter at the top ("1 / 6") for about 1.5 seconds to open the stats page. On iPad/iPhone the home-screen app keeps its own counts, separate from Safari's.

Counts are kept per device *and* per address: the iPad's counts at `http://10.x.x.x:8000` are separate from the ones on a GitHub Pages URL, so open `stats.html` at the same address he reads from.
