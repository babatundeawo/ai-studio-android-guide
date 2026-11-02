# Deployment guide

This guide is for the site owner. You never need a terminal. Everything happens in GitHub Desktop, in File Explorer, and on the GitHub website.

## How it works

The site's source lives in `src/`. Each time something is merged into the `main` branch, a GitHub Action builds the site, checks it, and publishes it to GitHub Pages. You can watch this on the repository's **Actions** tab.

Pull requests are built and checked by a second workflow (`pr-check.yml`) but never published. The live site changes only when you merge.

## One-time setup

1. Open the repository on GitHub and click **Settings**.
2. In the left menu, click **Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Merge the pull request right after (see below). The first publish takes about a minute.

> **Order matters.** If the old site was served straight from the repository files, switch **Source** to **GitHub Actions** and merge back to back to keep the gap short. If the first run shows a red cross because Pages was not switched yet, switch it and click **Re-run all jobs** on that run.

## Review and merge a change

GitHub Pages has no built-in preview for pull requests. You have two options: merge and rely on easy rollback (below), or download the built site from the pull request and open it on your computer first.

1. Click **Pull requests** and open your pull request.
2. Click the **Checks** tab. A green tick next to **Build and check** means the site built, every link works, and the offline files are valid.
3. To look at the result before publishing: on the same run page, scroll to **Artifacts**, download **site-preview**, unzip it, and open `index.html`. Search, install, and offline mode only work on the live site.
4. Happy? Click **Merge pull request**, then **Confirm merge**. Not happy? Click **Close pull request**. Nothing changes on the live site.

## Update the content

From the GitHub website:

1. Open the file on GitHub, for example `src/pages/vercel.html`.
2. Click the pencil icon, make your edit, then click **Commit changes**.
3. Choose **Create a new branch and start a pull request** to review first, or commit directly to `main` to publish straight away.

From GitHub Desktop:

1. Click **Fetch origin**, then edit the file in any text editor and save it.
2. In GitHub Desktop, tick the changed files, type a short summary, and click **Commit to main**.
3. Click **Push origin**. The site rebuilds automatically.

Text between `<p>` and `</p>` is a paragraph. Leave the tags in place. The top of each page file (between the `---` lines) holds its title, description, and heading. Step numbers are added automatically, so never type them. See [CUSTOMIZING.md](CUSTOMIZING.md) for colors, fonts, and navigation.

## Check that a deployment worked

1. Click the **Actions** tab.
2. Open the newest run named **Build and deploy**.
3. A **green tick** means the site is live. A **red cross** means something failed.
4. Click the red run, then the step marked with a cross, to read the error. Lines starting with `ERROR:` come from the checker and name the page and the problem, for example a broken link. A line starting with `FAIL` in the colour step means a colour pair is too low in contrast. Fix that file and commit again. The site rebuilds automatically.

## Roll back

Every change is saved in Git, so nothing is lost.

1. Click **Pull requests**, then **Closed**, and open the one you want to undo.
2. Click **Revert**. GitHub creates a new pull request.
3. Merge it. The site rebuilds without that change.

For a change committed directly to `main`: click **Commits**, open the commit, and click **Revert**.

## Use a custom domain

1. In **Settings → Pages → Custom domain**, type your domain (for example `guide.example.com`) and click **Save**.
2. At your domain provider's DNS settings, add a record. For a subdomain, add a **CNAME** record pointing to `babatundeawo.github.io`. For a bare domain, add four **A** records: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, and `185.199.111.153`.
3. Wait for DNS to update (minutes to a few hours), then tick **Enforce HTTPS**.
4. Nothing else needs editing. The build asks GitHub Pages for the address, so links, the sitemap, and the app manifest follow the custom domain automatically.

## Updating the app on phones

Anyone who installed the guide gets new versions quietly. After you publish, the next time they open the guide a message says "A new version of the guide is ready" with a **Refresh** button. Pages are always fetched fresh when the phone is online, so nobody is stuck on old content.

## Security scanning

- **Dependabot** opens a pull request when a newer version of a workflow action is available. Review and merge it like any other pull request.
- **CodeQL** scans the code weekly and on every change. Results appear under **Security → Code scanning**.
- **Secret scanning** catches passwords and keys committed by mistake. To turn it on: **Settings → Code security** (or **Advanced Security**), then switch on **Secret scanning** and **Push protection**.
- This site stores no passwords or keys and has no accounts, forms, or database. Never add any to the repository.
- GitHub Pages cannot send custom security headers. The site applies a Content Security Policy and a referrer policy through `<meta>` tags instead. A few protections, such as `frame-ancestors`, can only be set by a server header and are not available on this host.
