# DSH Plugin Stars

A static GitHub Pages site that lists popular DeepSeek Harness (DSH) plugins.

- **Live site**: `https://<owner>.github.io/dsh-plugin-stars/`
- **Data source**: GitHub public repositories tagged with topic `dsh-plugin`.
- **No backend**: the site is served as static files from GitHub Pages; there is no server-side runtime, no API proxy, and no token sent to the browser.

## Inclusion criteria

- Public GitHub repository.
- Repository topic contains `dsh-plugin`.
- Default minimum star count: `25` (configurable via `MIN_STARS` in the aggregation script or the workflow).
- Forks and archived repositories are excluded automatically.
- Specific repositories can be excluded manually by adding them to the `EXCLUDE_REPOS` environment variable (comma-separated `owner/repo` values) in the workflow.

The criteria exist to keep the list focused; being excluded does not imply anything about quality.

## Data refresh

A GitHub Actions workflow refreshes `data/plugins.json`:

- **Schedule**: every 30 minutes (`*/30 * * * *`).
- **Manual trigger**: `workflow_dispatch`.
- **API limit**: GitHub repository search returns at most 1,000 results, so the list is the most popular matches within that window, not a complete census.

The workflow uses a `GITHUB_TOKEN` secret for both repository search and the Pages deployment. The token is never written to logs, artifacts, or the generated JSON file.

## Local preview

No build step or dependency installation is required. Preview the site through a local static HTTP server; `fetch` does not work from `file://` URLs, so opening `index.html` directly is not supported.

```powershell
# Python 3
python -m http.server 8080 --directory G:\me\dsh-plugin-stars

# Node 18+ (if available)
npx serve G:\me\dsh-plugin-stars
```

Then open `http://localhost:8080/`.

## Manual data update

```powershell
# Optional: set a token to raise the GitHub API rate limit.
# Use a GitHub fine-grained token and do not commit it.
$env:GITHUB_TOKEN = '<GitHub fine-grained token>'
$env:MIN_STARS = "10"
node scripts/aggregate.mjs
```

The script only reads public repository metadata and writes `data/plugins.json`.

## Security notes

- The generated JSON contains only public metadata: repository name, description, homepage URL, topics, license, star count, and last update time.
- The site renders all external links with `target="_blank" rel="noopener noreferrer"` and validates every URL against an allow-list of `http:` and `https:` protocols.
- No cookies, analytics, or third-party resources are loaded.

## License

MIT
