# Deployment guide

This guide is for the site owner. You never need a terminal: everything happens on the GitHub website.

## How it works

The site's source lives in `src/`. Each time something is merged into the `main` branch, a GitHub Action builds the site, checks it, and publishes it to GitHub Pages. You can watch this on the repository's **Actions** tab.

Pull requests are built and checked too, but never published. The live site changes only when you merge.

## One-time setup

1. Open the repository on GitHub and click **Settings**.
2. In the left menu, click **Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Right after, merge the pull request (see below). The first publish takes about a minute.

> **Order matters.** The old site was served straight from the repository files. Once the new version is merged, those files are no longer the finished site, so the Source setting must be **GitHub Actions**. Do steps 1 to 3 and the merge back to back to keep the gap short. If the first run shows a red cross because Pages wasn't switched yet, switch it and click **Re-run all jobs** on that run.

## Review and merge the redesign

1. Click **Pull requests** and open **Premium redesign**.
2. Click the **Checks** tab. A green tick next to **Build and check** means the site built and all links work. The Lighthouse step shows scores in its log; it never blocks anything.
3. To look at the result before publishing: on the same run page, scroll to **Artifacts**, download **site-preview**, unzip it, and open `index.html`. Search and offline mode only work on the live site.
4. Happy? Click **Merge pull request**, then **Confirm merge**. Not happy? Click **Close pull request**. Nothing changes on the live site.

## Update the content

1. Open the file on GitHub, for example `src/pages/vercel.html`.
2. Click the pencil icon, make your edit, then click **Commit changes**.
3. Choose **Create a new branch and start a pull request** to review first, or commit directly to `main` to publish straight away.

Text between `<p>` and `</p>` is a paragraph; leave the tags in place. The top of each page file (between the `---` lines) holds its title, description, and heading. See [CUSTOMIZING.md](CUSTOMIZING.md) for colors, fonts, and navigation.

## Check that a deployment worked

1. Click the **Actions** tab.
2. Open the newest run named **Build and deploy**.
3. A **green tick** means the site is live. A **red cross** means something failed.
4. Click the red run, then the step marked with a cross, to read the error. Lines starting with `ERROR:` come from the checker and name the page and the problem, for example a broken link. Fix that file and commit again; the site rebuilds automatically.

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
4. Open `site.json` on GitHub, change `"url"` to your new address (keep the trailing slash), and commit. This updates links used by search engines and social previews.

## Security scanning

- **Dependabot** opens a pull request when a newer version of a workflow action is available. Review and merge it like any other pull request.
- **CodeQL** scans the code weekly and on every change. Results appear under **Security → Code scanning**.
- **Secret scanning** catches passwords and keys committed by mistake. To turn it on: **Settings → Code security** (or **Advanced Security**), then switch on **Secret scanning** and **Push protection**.
- This site stores no passwords or keys. Never add any to the repository.
