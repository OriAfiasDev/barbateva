# ברבא טבע – Barbateva

Scrollytelling site for a kosher coffee cart in a eucalyptus grove on the banks
of Nahal Sorek (Road 3, Yesodot / Netzer Hazani junction). Hand-built static
HTML/CSS/JS, RTL Hebrew, a scroll-scrubbed hero video whose giant type lands in
step with the desserts being set on the board — no framework, no build step.

## Local preview

```bash
python3 serve.py 8766
```

then open `http://localhost:8766`. (`serve.py` adds HTTP Range support, which
the hero `<video>` needs — Safari refuses to load a video without it.)

## Structure

- `index.html` — markup, JSON-LD, all copy
- `assets/css/style.css` — palette/scale as custom properties, every section
- `assets/js/main.js` — hero scrub + type choreography, word reveal, sticky
  steps, background travel, nav state
- `assets/video/` — `hero.mp4` (1280×720, short GOP for scrubbing) and
  `hero-sm.mp4` (4:3 centre crop for phones)
- `assets/img/` — poster frames, logo, `ig/` photos from the business's Instagram

Source video (`hero.mp4` at the root) and `brief.md` are git-ignored.
