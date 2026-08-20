# ATLAS Cloud setup

ATLAS Web stays public. Firmware dumps are never committed to Git.

## Architecture

1. Browser uploads the firmware to a Cloudflare Worker.
2. The Worker stores it temporarily in a private R2 bucket and triggers the `ATLAS Cloud Analysis` GitHub Action.
3. GitHub Actions checks out the private `bruno97418/desktop-tutorial` repository at `agent/atlas-v9` with a read-only fine-grained token.
4. `ATLAS_V9/src/atlas_v9_analyzer.py` analyzes the firmware and returns JSON to the Worker.
5. The Worker deletes the transient firmware object after success or failure.
6. ATLAS Web polls the Worker with a random per-job token and displays the result.

## Required secrets

### Cloudflare Worker secrets

- `GITHUB_TOKEN`: fine-grained PAT restricted to `bruno97418/atlas-web`, permission **Actions: read/write**.
- `WORKER_SHARED_SECRET`: a long random secret used only between the Worker and GitHub Actions.

### GitHub repository secrets in `bruno97418/atlas-web`

- `ATLAS_ENGINE_TOKEN`: fine-grained PAT restricted to `bruno97418/desktop-tutorial`, permission **Contents: read-only**.
- `WORKER_SHARED_SECRET`: exactly the same random value as the Worker secret.

No secret is stored in `index.html`, `app.js`, GitHub Pages, or browser local storage.

## Cloudflare

Create an R2 bucket named `atlas-web-jobs`. Deploy the Worker from `worker/` using `worker/wrangler.toml`, then add the two Worker secrets.

After deployment, open ATLAS Web, choose **API Cloud**, and enter the Worker URL, for example `https://atlas-web-api.<account>.workers.dev`. This URL is not secret.

The default maximum upload size configured by ATLAS is 32 MiB.
