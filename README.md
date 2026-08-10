# AI Studio → Android: Complete Deployment Guide v3.0

> A professional, interactive, multi-page web guide for deploying Google AI Studio projects as installable Android PWAs.

## What This Is

A comprehensive step-by-step deployment guide that walks developers through the full pipeline:

- Setting up **Google AI Studio** and getting a Gemini API key
- Building an app with AI Studio's **Build mode** (Gemini's agentic app builder)
- Configuring `manifest.json` and the entry script, then exporting to **GitHub**
- Deploying to **Vercel** via GitHub integration, with correct environment variables
- Installing the live web app as a **Progressive Web App (PWA)** on Android
- Managing updates, debugging common issues, and maintaining the deployment

Version 3.0 is a ground-up rebuild of the original single-file guide into a **fully separated, multi-page site** — every part of the pipeline gets its own page, with shared CSS and JS, a persistent sidebar, filterable navigation, dark mode, a reading-progress bar, and prev/next pagers between sections. Content has also been reviewed and updated to match how Google AI Studio, GitHub, and Vercel actually work as of August 2026 (Build mode's automatic server-side API keys, current Vercel Hobby limits, current GitHub Actions free-tier minutes, etc.).

## Site Structure

```
ai-studio-android-guide/
├── index.html          ← Home / hub — hero, prerequisites, links to every page
├── accounts.html        ← Part 1 — Account Setup
├── build.html            ← Part 2 — Build in AI Studio
├── github.html           ← Part 3 — The GitHub Bridge
├── vercel.html            ← Part 4 — Deploy to Vercel
├── android.html            ← Part 5 — Install on Android
├── updates.html             ← Part 6 — Update Workflow / SOP
├── troubleshoot.html         ← Reference — Troubleshooting flowchart + 7 issues
├── tips.html                  ← Reference — Best practices + free-tier table
├── glossary.html               ← Reference — Glossary & appendix
├── css/
│   └── style.css                ← Full design system, shared across every page
├── js/
│   └── main.js                   ← Shared behaviour: nav, progress bar, accordion,
│                                     copy-to-clipboard, dark mode, search, back-to-top
└── README.md
```

## Features

| Feature | Detail |
|---|---|
| 🧭 Multi-page architecture | Every section is its own HTML file with its own URL, so pages load fast and are easy to link to directly |
| 📋 Persistent sidebar | Fixed nav with current-page highlighting, filterable by keyword |
| 🌗 Dark mode | Toggle in the sidebar, remembered for the session |
| 💻 Code blocks | Syntax-highlighted, dark terminal-style, one-click copy |
| 🔽 Accordion troubleshooting | 7 common issues with fixes, plus a visual diagnosis flowchart |
| 📊 Free-tier reference table | Current limits for AI Studio, Vercel, and GitHub |
| 📖 Glossary | 14 key terms defined |
| 📱 Fully responsive | Sidebar collapses to a mobile menu; hub cards and tables reflow on small screens |
| ↩️ Prev / next pagers | Every page links to the one before and after it |
| ⚡ Zero build step | Pure HTML/CSS/JS, no framework or bundler required |

## Tech Stack

- **HTML5 / CSS3 / Vanilla JS** — no frameworks
- **Geist / Geist Mono** — display, body, and monospace font (Google Fonts)
- Deployable as static files on GitHub Pages, Vercel, Netlify, or any static host

## Local Preview

No build step needed. From the project folder:

```bash
python3 -m http.server 8080
# then visit http://localhost:8080
```

Opening `index.html` directly with `file://` also works, since all assets are relative.

## Updating the Guide

Each page is a self-contained HTML file that includes the same sidebar and footer markup. To add or edit content:

1. Edit the relevant page's `<section class="doc-section">` content
2. Keep shared styling in `css/style.css` and shared behaviour in `js/main.js`
3. If you add a new page, copy the `<head>`, sidebar, and footer blocks from an existing page for consistency, and add a link to it in every page's sidebar

## Author

**Babatunde Awoyemi** — Atmospheric Physicist & Lead Consultant
[Techbase Consultant Services](https://techbasengr.com.ng) · Ibadan, Nigeria
[github.com/babatundeawo](https://github.com/babatundeawo) · [x.com/ba_awoyemi](https://x.com/ba_awoyemi)

## Licence

© 2025–2026 Techbase Consultant Services. Published for educational reference. You may share and adapt it with attribution.
