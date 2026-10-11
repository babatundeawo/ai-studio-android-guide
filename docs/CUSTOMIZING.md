# Customizing guide

Where to change things. Every file can be edited on the GitHub website with the pencil icon.

| To change | Edit |
|---|---|
| Text on a page | `src/pages/<page>.html` |
| Page title, description, or heading | the block between the `---` lines at the top of that page file |
| Colors (light and dark) | `src/css/00-tokens.css` |
| Fonts | `src/css/00-tokens.css` (the `@font-face` lines) and the files in `public/fonts/` |
| Version, update date, site address | `site.json` |
| Sidebar menu and page order | `site.json` (`nav` and `order`) |
| Logo mark | the `i-mark` symbol in `src/partials/icons.svg`, plus `public/icons/icon.svg` |
| Favicons and app icons | `public/icons/` and `public/favicon.ico` |
| Social preview image | `public/og-image.png` (1200 × 630) |
| Header, sidebar, or footer layout | `src/partials/layout.html` |

## Colors

The palette is a set of named values at the top of `src/css/00-tokens.css`. Change a value there and every page follows. Light colors are in `:root`; dark colors are in the `[data-theme="dark"]` block and again in the `prefers-color-scheme` block below it. Keep text colors dark enough on their backgrounds to stay readable.

## Add a page

1. Create `src/pages/example.html`. Start it with this header, then your content:

   ```
   ---
   title: Example page
   nav: Example
   part: Reference
   steps: 3 tips
   h1: Example page
   lead: One sentence that introduces the page.
   reviewed: Reviewed October 2026
   description: A sentence for search results.
   ---
   <p>Your content here.</p>
   ```

2. Open `site.json`, add `{ "page": "example", "label": "Example" }` under the right `nav` group, and add `"example"` to `order` where it should appear.
3. Commit. The next build creates `example.html`, adds it to search and the sitemap, and links it in the sidebar and pager.

## Content building blocks

Copy a block from an existing page and change the text: steps (`<ol class="steps">`), alerts (`alert a-info`, `a-warn`, `a-crit`, `a-ok`), code samples (`<figure class="code">`), tables, and expandable issues (`<details class="issue">`).

## Update the "last reviewed" date

Change the `reviewed:` line at the top of each page, and `version` and `updated` in `site.json`.
