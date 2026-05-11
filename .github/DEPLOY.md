# GitHub Pages Deployment Guide

This repository includes a GitHub Actions workflow that automatically builds and deploys the demo site to GitHub Pages.

## Setup

1. **Enable GitHub Pages** in your repository settings:
   - Go to **Settings** → **Pages**
   - Under "Build and deployment", select:
     - **Source:** GitHub Actions
     - (The workflow will handle everything else)

2. **The workflow runs automatically on:**
   - Every push to `main` branch
   - Manual trigger via **Actions** → **Deploy Demo to GitHub Pages** → **Run workflow**

## What the workflow does

1. Installs dependencies via pnpm
2. Builds the library (`pnpm build`)
3. Copies the demo and dist folders to a `public` folder
4. Deploys the `public` folder to GitHub Pages

## Access your demo

After the workflow completes successfully, your demo will be available at:

```
https://<your-username>.github.io/<repo-name>
```

For example, if your repo is `user/panorama-player`:

```
https://user.github.io/panorama-player
```

## Local testing

To test the build locally before pushing:

```sh
pnpm build
```

Then open `demo/index.html` in your browser.

## Troubleshooting

**Workflow fails:** Check the **Actions** tab for error details. Common issues:

- Node version mismatch (uses Node 24)
- pnpm version mismatch (uses pnpm 10)
- Missing build artifacts

**Demo doesn't load:** Ensure:

- GitHub Pages is enabled in repository settings
- The workflow ran successfully (check Actions tab)
- Your browser has JavaScript enabled
- The demo site URL is correct (watch for case-sensitivity)

**Import paths broken:** The demo imports from `/dist/index.js` relative to the site root. This is configured for GitHub Pages deployment.
