# BitDocumenter – Basic Webpage

A minimal static starter you can open directly in your browser.

## Getting started

1. Open the project folder.
2. Double‑click `index.html` to open it in your default browser.
3. Edit `index.html`, `styles.css`, and `script.js` as needed.

## Files

- `index.html` – Main page markup and sections.
- `styles.css` – Site styles with a dark, modern theme.
- `script.js` – Small enhancements (year auto-fill, smooth scroll).

## Optional: local server

You can also use a simple local server for nicer reloading and correct relative paths:

```bash
# Python 3
python -m http.server 8000
# then open http://localhost:8000
```

## Deploying to GitHub Pages

This repo is configured to deploy with GitHub Pages via Actions.

1. Commit and push to the `main` branch.
2. The workflow `.github/workflows/deploy-pages.yml` builds and uploads the site contents.
3. The Pages deployment publishes to the `gh-pages` environment.
4. In the repository settings, go to Pages and ensure:
	- Source: “GitHub Actions”.
	- Custom domain (optional): add your domain and set DNS records.
5. Wait for the action to complete; your site URL will appear in the workflow summary and in the Pages settings.

Notes:
- The `.nojekyll` file disables default Jekyll processing so all files are served as-is.
- The workflow uploads the repo root (`.`). If you later add a build step (e.g., bundler), change the `path:` to your output directory.


