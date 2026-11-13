# GitHub Pages deployment

Target: https://pandamn16-blip.github.io/llama-knight/

## Local repository location — resolve before committing

At configuration time the working game is in:

`/Users/ianjeeves/Desktop/llama-knight/`

The GitHub Desktop repository is one folder deeper:

`/Users/ianjeeves/Desktop/llama-knight/llama-knight/`

Its origin is `https://github.com/pandamn16-blip/llama-knight.git`, and its current
commit contains only `.gitattributes`. The game files and deployment changes are
outside that repository, so GitHub Desktop will not detect them there yet.
No files or Git metadata have been moved automatically.

Before committing, ensure the repository root contains `package.json`,
`package-lock.json`, `index.html`, `tsconfig.json`, `src/`, `public/`, `vite/`,
`tests/`, `.github/workflows/deploy-pages.yml` and `.gitignore`. Include the docs,
README and license too. Copy those project files/folders into the repository
folder, preserving its `.git/` and `.gitattributes`, or correct the repository
location separately. Do not copy `node_modules/`, `dist/` or the nested repository
folder into itself. The workflow must be at the repository root's `.github/`,
not inside an extra project subdirectory.

## GitHub settings and first deployment

1. In the GitHub repository, open **Settings → Pages**.
2. Under **Build and deployment → Source**, select **GitHub Actions**.
3. Ensure GitHub Actions is enabled under **Settings → Actions → General**, with
   the official `actions/*` actions permitted if an allowlist is configured.
4. Commit the complete project and workflow using GitHub Desktop, then push to
   `main`. The workflow will build and deploy automatically. Its manual
   **Run workflow** option also supports deployment from `main`.
5. Watch **Actions → Deploy Llama Knight to GitHub Pages**. Once deployment
   succeeds, visit the target URL. Leave custom domain blank for this address.

No personal access token, deploy key or separate `gh-pages` branch is needed.
The workflow sets `contents: read` for building and `pages: write` / `id-token:
write` for deploying to the `github-pages` environment. There is no need to grant
all workflows general repository write access. If custom environment protection
rules exist, allow deployments from `main` and satisfy their approval requirements.

Official references: [Vite's GitHub Pages guide](https://vite.dev/guide/static-deploy#github-pages)
and [GitHub custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Build and assets

- `vite/config.prod.mjs` uses `base: '/llama-knight/'`.
- Local development configuration is unchanged: `npm run dev-nolog` at
  http://localhost:8080/.
- Phaser's global loader `baseURL` uses Vite's `import.meta.env.BASE_URL`, so Boot,
  Preloader, character strips, the combined fallback and sword effects all use the
  correct prefix. Existing relative asset filenames remain unchanged.
- Vite prefixes generated JavaScript/module links and public CSS/favicon links.
  `public/` contents are copied into `dist/` without artwork modification.
- The workflow uses Node 24, `npm ci`, `npx tsc --noEmit`, the reliability suite and
  the existing `npm run build-nolog` production command. Only `dist/` is uploaded.
  The alternative `build` script still exists unchanged; `build-nolog` avoids the
  Phaser template's optional external telemetry process.
- Failed checks prevent deployment. Concurrent runs are serialized to avoid
  interrupting an in-progress Pages deployment. Deployment is restricted to `main`.

Local verification:

```sh
npx tsc --noEmit
node tests/reliability.cjs
npm run build-nolog
npx vite preview --config vite/config.prod.mjs --port 4173
```

Open http://localhost:4173/llama-knight/ for the production preview. Keep the
trailing slash. Check both heroes, Crunch's animations, sword effects, upgrades,
restart and mobile landscape layout. Browser Network should show no missing
assets; game resources should use `/llama-knight/`, not the domain root.

No commit, push, GitHub settings change or remote deployment was performed by the
configuration task. The workflow only runs on GitHub after you push it.
