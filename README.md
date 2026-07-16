# Dinner Decider

Nobody has to pick. The game decides.

A multiplayer "pick where we eat" game: a 5-step setup (location → cuisines →
preferences → deal-breakers → restaurant pool), three game modes (Pure Fate,
Smart Random weighted draw, pass-the-phone Group Elimination), a one-shot Veto
Token, a countdown/confetti reveal, share-via-URL, localStorage persistence,
and a host panel for managing the restaurant list.

Vanilla HTML/CSS/JS. No framework, no build step, no backend. Ships as a
PWA — installable on iPhone and Android, works fully offline after the first
load. Restaurant data is a curated Houston demo set; everything is labeled as
sample data and should be verified before you rely on it (hours, addresses,
etc. are illustrative, not live).

## Run locally

Any static file server works, since the app makes no server calls. Pick one:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

```bash
npx serve .
```

Or just open `index.html` directly in a browser — everything except the
service worker (which requires http/https, not `file://`) will work.

## Project layout

```
index.html              app shell / markup
styles.css               all styling
app.js                    game logic, state, rendering
manifest.webmanifest      PWA manifest
sw.js                      service worker (cache-first, offline support)
icons/                       app icons (192, 512, apple-touch-icon)
scripts/gen_icons.py         regenerates icons/ (pure Python, no deps)
.github/workflows/deploy.yml GitHub Pages auto-deploy on push to main
```

## Deploy (GitHub Pages)

1. Push this repo to GitHub.
2. In the repo settings → **Pages**, set **Source** to **GitHub Actions**.
3. Push to `main` — the included workflow (`.github/workflows/deploy.yml`)
   builds nothing (there's no build step) and just publishes the repo as-is.
4. Your app will be live at `https://<username>.github.io/<repo>/`.

Every push to `main` redeploys automatically.

### Bumping the offline cache

`sw.js` uses a cache-first strategy so the app works offline after the first
visit. Bump `CACHE_NAME` in `sw.js` on every deploy that changes any cached
file, so returning visitors actually pick up the new build instead of a
stale cached copy.

## Regenerating icons

```bash
python3 scripts/gen_icons.py
```

Writes `icons/icon-192.png`, `icons/icon-512.png`, and
`icons/apple-touch-icon.png`. No dependencies beyond the Python standard
library — safe to re-run any time the icon design changes.
