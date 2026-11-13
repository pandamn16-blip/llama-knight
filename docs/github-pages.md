# GitHub Pages deployment

Target: https://ianswebsolutions.com/llamaknight/

Game repository: https://github.com/pandamn16-blip/llamaknight

## Local repository

The prepared GitHub Desktop repository is:

`/Users/ianjeeves/Desktop/llama-knight/llama-knight/`

Its `origin` is `https://github.com/pandamn16-blip/llamaknight.git`. The physical
folder name does not need to match the renamed GitHub repository. The full project
and deployment workflow are already present here; the outer folder remains an
independent, older copy. Run checks and commit game changes from this inner repo.

## Existing custom domain and the main website

The separate user-site repository `pandamn16-blip/pandamn16-blip.github.io`
already serves the main birthday website at `ianswebsolutions.com`. Its custom
domain is inherited by project sites without their own custom domain. The renamed
game repository therefore lives at `/llamaknight/` beneath that domain.

Leave the game repository's custom-domain field blank. Do not add a game `CNAME`,
copy game files into the user-site repository, change its DNS/domain settings or
replace its workflow. The game workflow deploys this project's artifact to this
project's Pages site; it does not publish into the main website's repository.

Reference: [GitHub's project-site custom-domain inheritance rules](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages).

## GitHub settings and deployment

1. In `pandamn16-blip/llamaknight`, open **Settings → Pages**.
2. Under **Build and deployment → Source**, select **GitHub Actions**.
3. Leave **Custom domain** blank. The main user site's existing domain stays as-is.
4. Ensure Actions is enabled and official `actions/*` actions are permitted if an
   allowlist is configured.
5. Commit and push game changes to `main` using GitHub Desktop. Watch **Actions →
   Deploy Llama Knight to GitHub Pages**, then visit the target URL after success.

The existing workflow is unchanged. It builds this repository, uploads `dist/`
and deploys on pushes to `main`; manual workflow runs on `main` also work. Its
repository context follows the rename automatically, so it needs no hardcoded
repository/domain change or separate token. Existing environment protection rules
for `github-pages`, if configured, must allow deployment from `main`.

## Build and assets

- `vite/config.prod.mjs` uses `base: '/llamaknight/'`.
- Phaser's global loader uses Vite's `import.meta.env.BASE_URL`, covering Boot,
  Preloader, character strips, combined fallback and sword effects automatically.
- Vite prefixes generated JavaScript/module links, CSS and favicon links.
  Existing filenames/artwork and relative sprite configuration are unchanged.
- The workflow still uses Node 24, `npm ci`, TypeScript checks, reliability tests
  and `npm run build-nolog`. Only `dist/` is uploaded.
- Local development is unchanged: `npm run dev-nolog` at http://localhost:8080/.

From the inner repository:

```sh
npx tsc --noEmit
node tests/reliability.cjs
npm run build-nolog
npx vite preview --config vite/config.prod.mjs --port 4173
```

Open http://localhost:4173/llamaknight/ (or the port printed by Vite if 4173 is
busy). Keep the trailing slash. Check both heroes, Crunch's animation sheets,
sword effects, upgrades and mobile landscape layout. Network requests should use
`/llamaknight/`, with no missing assets or old `/llama-knight/` URLs.

The path/remote update does not commit, push, change GitHub settings or publish
anything. Deployment happens only after you push the configuration yourself.
