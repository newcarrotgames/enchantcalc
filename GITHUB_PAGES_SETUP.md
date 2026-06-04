# Deploying a Vite app to GitHub Pages (runbook)

This document records how `enchantcalc` was deployed to GitHub Pages and how to
reproduce the same setup for any other static / Vite project. It is written so
another agent (or human) can follow it end to end.

Live site for this repo: https://newcarrotgames.github.io/enchantcalc/

---

## 1. What was set up

- **Hosting:** GitHub Pages, served as a *project site* at
  `https://<user>.github.io/<repo>/`.
- **Deploy method:** A GitHub Actions workflow (`.github/workflows/deploy.yml`)
  that builds the Vite app and publishes the `dist/` output on every push to
  `main`. Source is committed; build artifacts are **not** committed.
- **Result:** Push to `main` -> GitHub builds -> site redeploys automatically in
  ~1 minute. A failed build leaves the previously deployed site untouched.

### User site vs project site

- **User site:** repo named exactly `<user>.github.io`, served at the root
  `https://<user>.github.io`. Only one per account.
- **Project site:** any normal repo (e.g. `enchantcalc`), served at
  `https://<user>.github.io/<repo>/`. You can have many. This is what we used.

Because it is a project site served from a subpath (`/enchantcalc/`), the Vite
config uses relative asset paths:

```ts
// vite.config.ts
export default defineConfig({
  base: './',          // relative paths work on any subpath
  plugins: [react()],
})
```

---

## 2. Prerequisites

- A GitHub account.
- `git` installed.
- The **GitHub CLI** (`gh`). On Windows: `winget install --id GitHub.cli -e`.
- For a Vite project: a working `npm run build` that emits to `dist/`.

---

## 3. Reproduction steps

These are the generic steps. Run them from the project root.

### 3.1 Authenticate the GitHub CLI

```bash
gh auth login --hostname github.com --git-protocol https --web
```

Follow the device-code prompt (copy the one-time code, open
`https://github.com/login/device`, authorize).

> The token needs the **`workflow`** scope to push files under
> `.github/workflows/`. If you authenticated before adding it, run:
>
> ```bash
> gh auth refresh -h github.com -s workflow
> ```

### 3.2 Add the deploy workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

Make sure `dist/` is gitignored (Vite's default `.gitignore` already does this).

### 3.3 Initialize git, commit, create the repo, and push

```bash
git init
git checkout -b main          # or: git init -b main  (git >= 2.28)
git add -A
git commit -m "Initial commit: app with GitHub Pages deploy workflow"

# Creates the GitHub repo, wires up 'origin', and pushes in one step:
gh repo create <user>/<repo> --public --source . --remote origin --push
```

### 3.4 Enable Pages with the GitHub Actions source

```bash
gh api -X POST repos/<user>/<repo>/pages -f build_type=workflow
```

This sets Pages to build from the Actions workflow (not from a branch). The
first workflow run then publishes the site.

### 3.5 Verify

```bash
# Watch the most recent run to completion (non-zero exit if it fails):
RUN_ID=$(gh run list --repo <user>/<repo> --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$RUN_ID" --repo <user>/<repo> --exit-status --compact

# Confirm the site responds:
curl -I https://<user>.github.io/<repo>/
```

---

## 4. Day-to-day updates

```bash
git add -A
git commit -m "describe your change"
git push
```

That is the whole update flow. The push triggers a rebuild + redeploy. Check
status with `gh run watch --repo <user>/<repo>` (or the repo's Actions tab).
A red build does **not** take the live site down; the previous deploy stays up.

---

## 5. Environment-specific notes (Windows + WSL)

This project lives on the WSL filesystem
(`\\wsl.localhost\Ubuntu-20.04\home\david\gamedev\enchantcalc`) but was operated
from a Windows PowerShell shell. Things that bit us and how to handle them:

- **Two different `git` versions.** WSL had git `2.25.1` (no `git init -b`, no
  `git commit --trailer`). The Windows git was `2.32`. When a co-author trailer
  needs to be appended to commits, use the **Windows** git against the UNC path:

  ```powershell
  git -C "\\wsl.localhost\Ubuntu-20.04\home\david\gamedev\enchantcalc" commit -m "..."
  ```

- **`node` not on WSL's non-interactive PATH.** It was installed via nvm, which
  only loads in interactive shells. This did not matter here because **GitHub
  Actions does the build**, not the local machine. For local `npm run dev`, use
  an interactive WSL shell.

- **`gh` PATH after install.** A freshly `winget`-installed `gh` may not be on
  the current shell's PATH until a new shell starts. Prepend it if needed:

  ```powershell
  $env:PATH = "$env:ProgramFiles\GitHub CLI;$env:PATH"
  ```

- **Line endings.** Committing from Windows produced `LF -> CRLF` warnings.
  These are harmless (working tree keeps its endings); the repo stores LF. Add a
  `.gitattributes` with `* text=auto eol=lf` if you want to silence them.

- **`workflow` scope.** The first push was rejected with
  *"refusing to allow an OAuth App to create or update workflow ... without
  `workflow` scope"*. Fix with `gh auth refresh -h github.com -s workflow`
  (see 3.1), then push again.

---

## 6. Optional follow-ups

- **Silence the Node 20 deprecation warning:** bump the action versions /
  Node version in the workflow as newer releases land.
- **CI safety net:** add a job that runs `npm test` / typecheck before deploy.
- **SPA deep links:** add a `public/404.html` fallback if you adopt client-side
  routing.
- **Custom domain:** add a `CNAME` and configure DNS, then set the custom domain
  in the repo's Pages settings.
