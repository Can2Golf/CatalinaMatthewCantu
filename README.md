# Matthew &amp; Catalina — Wedding Website

An interactive single-page wedding website. Pure HTML / CSS / vanilla JavaScript — no build step, deploys anywhere static.

## Run locally

Any static file server works. The simplest options:

```bash
# Python 3
python3 -m http.server 8000

# Node (npx, no install)
npx --yes serve .
```

Then open http://localhost:8000.

Or just double-click `index.html` — the site runs from `file://` too.

## Deploy

Any of these will work with zero config:

- **GitHub Pages** — push this branch, enable Pages in repo settings, point it at the branch root.
- **Netlify / Vercel** — drag-and-drop the folder or connect the repo.
- **Cloudflare Pages** — same.

## Customize

Things you'll probably want to tweak, all in obvious places:

| What | Where |
| --- | --- |
| Wedding date (countdown) | `js/countdown.js` → `WEDDING_DATE` |
| Registry button URL | `index.html` → `.btn--registry` `href` + `data-registry-url` |
| RSVP destination email | `index.html` → `#rsvp-form` `action` |
| Contact emails | `index.html` → `.contact-grid` section |
| Couple names / dates | `index.html` hero + footer |
| Colors / typography | `css/style.css` → `:root` variables at top |
| Photos | See `assets/images/README.md` |

## What's interactive

- Live countdown to 2:30 PM CT, May 21, 2027
- Scroll-triggered section reveals with stagger
- Parallax hero photo + drifting eucalyptus decorations
- Love-story tab timeline (keyboard accessible: ← → arrows)
- Hover-lift ceremony/reception cards
- Hover-underline schedule rows
- Accordion FAQ (one-open-at-a-time)
- Floating mini-nav appearing after hero
- Modal RSVP form with `mailto:` submission
- Respects `prefers-reduced-motion`
- Fully responsive down to 320px wide

## Branch

Development branch: `claude/party-website-interactive-lAAI4`
