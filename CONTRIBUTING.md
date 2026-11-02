# Contributing

Thanks for helping keep this guide accurate. You can contribute using only the GitHub website.

## Report a problem or suggest an idea

1. Open the [issues page](https://github.com/babatundeawo/ai-studio-android-guide/issues/new/choose).
2. Choose **Content correction** for a wrong or outdated step, or **Bug report** for something broken on the site.
3. Say which page and step it concerns, what you expected, and what you saw.

## Fix something yourself

1. Open the page file in `src/pages/` and click the pencil icon.
2. Make your change and click **Commit changes**, then **Propose changes**.
3. Click **Create pull request**. A green tick on the pull request means the site still builds, every link works, and the colors pass the contrast check.

## Working on the code

The site is built with Node.js 22 or later and has no dependencies:

```bash
npm run build      # writes the site to dist/
npm run check      # checks links, titles, the manifest, and offline files in dist/
npm run contrast   # checks text colors against WCAG AA
```

`src/` is the source and `dist/` is generated, so never edit `dist/`. See [docs/CUSTOMIZING.md](docs/CUSTOMIZING.md) for where things live.
