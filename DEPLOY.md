# GitHub Pages Deployment

## Setup (One-time)

1. Go to https://github.com/yantongggg/OceanMind_/settings/pages
2. Under **Build and deployment**:
   - Source: `Deploy from a branch`
   - Branch: `main` / `/(root)`
3. OR set up automatic deployment via Actions:
   - Go to **Actions** → create a new workflow
   - Use the template below

## Automatic Deployment (GitHub Actions)

Create `.github/workflows/deploy.yml`:

```yaml
name: Build & Deploy

on:
  push:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
      with:
        node-version: '20'
    - run: cd frontend && npm install && npm run build
    - uses: peaceiris/actions-gh-pages@v3
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        publish_dir: ./frontend/dist
```

## Manual Build & Deploy

```bash
# Build frontend
cd frontend
npm install
npm run build

# Built files are in frontend/dist/
# Deploy to GitHub Pages manually via the dashboard
```

## Access

Once deployed, the site will be live at:
https://yantongggg.github.io/OceanMind_/

---

**Frontend runs entirely standalone** — no backend required. All data is mock/golden-scenario based.
