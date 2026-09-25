# AI Studio → Android: Complete Deployment Guide v4.0

> A professional, interactive, multi-page web guide for deploying Google AI Studio projects as installable Android PWAs — or as native Android apps.

**Live:** https://babatundeawo.github.io/ai-studio-android-guide/

## What This Is

A comprehensive step-by-step deployment guide that walks developers through the full pipeline:

- Setting up **Google AI Studio** and getting a Gemini API key
- Building an app with AI Studio's **Build mode** — now running on the **Antigravity Agent**, with an option to build a **native Android app** (Kotlin + Jetpack Compose) directly, no code editor required
- Configuring `manifest.json` and the entry script, then pushing to **GitHub**
- Deploying via **Vercel**, **Replit**, or AI Studio's own one-click **Publish to Cloud Run** shortcut (Google Cloud Starter Tier — 2 free apps, no billing setup)
- Installing the live web app as a **Progressive Web App (PWA)** on Android
- Managing updates, debugging common issues, and maintaining the deployment

Version 4.0 is a content and design refresh of the v3.0 multi-page site. It replaces everything that's changed since August 2026 — Build mode's move to the Antigravity Agent, the current Flash-only model limitation in Build mode, native Android app generation, AI Studio's direct-to-Cloud-Run Publish button, and corrected free-tier figures for Vercel — and adds a full alternative deployment path through **Replit**, with shorter notes on Netlify and Cloudflare Pages. The visual design has also been refreshed with a new colour system built specifically for this guide.

## Site Structure

```
ai-studio-android-guide/
├── index.html          ← Home / hub — hero, prerequisites, links to every page
├── accounts.html        ← Part 1 — Account Setup
├── build.html            ← Part 2 — Build in AI Studio
├── github.html           ← Part 3 — The GitHub Bridge
├── vercel.html            ← Part 4 — Deploy to Vercel
├── replit.html             ← Part 4B — Deploy to Replit (+ Netlify/Cloudflare Pages notes)
├── android.html            ← Part 5 — Install on Android
├── updates.html             ← Part 6 — Update Workflow / SOP
├── troubleshoot.html         ← Reference — Troubleshooting flowchart + 8 issues
├── tips.html                  ← Reference — Best practices + free-tier table
├── glossary.html               ← Reference — Glossary & appendix (19 terms)
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
| 🌗 Dark mode | Optional toggle in the sidebar (off by default — the guide is designed light-first), remembered for the session |
| 💻 Code blocks | Syntax-highlighted, dark terminal-style, one-click copy |
| 🔽 Accordion troubleshooting | 8 common issues with fixes, plus a visual diagnosis flowchart |
| 📊 Free-tier reference table | Current limits for AI Studio, Cloud Run, Vercel, Replit, Netlify, Cloudflare Pages, and GitHub |
| 📖 Glossary | 19 key terms defined |
| 📱 Fully responsive | Sidebar collapses to a mobile menu; hub cards and tables reflow on small screens |
| ↩️ Prev / next pagers | Every page links to the one before and after it |
| ⚡ Zero build step | Pure HTML/CSS/JS, no framework or bundler required |

## Tech Stack

- **HTML5 / CSS3 / Vanilla JS** — no frameworks
- **Geist / Geist Mono** — display, body, and monospace font (Google Fonts)
- Deployable as static files on GitHub Pages, Vercel, Netlify, Cloudflare Pages, or any static host

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
2. Keep shared styling in `css/style.css` and shared behaviour in `js/main.js` — the colour system lives entirely in the `:root` variables at the top of `style.css`, so a palette change there updates every page at once
3. If you add a new page, copy the `<head>`, sidebar, and footer blocks from an existing page for consistency, and add a link to it in every page's sidebar

## Author

**Babatunde Awoyemi** — Atmospheric Physicist & Lead Consultant
[Techbase Consultant Services](https://techbasengr.com.ng) · Ibadan, Nigeria
[github.com/babatundeawo](https://github.com/babatundeawo) · [x.com/ba_awoyemi](https://x.com/ba_awoyemi)

## Licence

© 2025–2026 Techbase Consultant Services. Published for educational reference. You may share and adapt it with attribution.
