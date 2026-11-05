# Free deployment: GitHub Pages + GitHub Actions

For a public repository on GitHub Free, Pages and standard GitHub-hosted Actions runners are available without a Google Cloud VM or billing account. Subject to GitHub's current plan terms and usage limits; no uptime or exact schedule guarantee. No paid API subscription is purchased by this workflow.

1. Put these files in the public `timo893131/stock-analysis` repository on the default branch, including `.github/workflows/pages.yml`. Review source before making it public; never include tokens, `.env`, `.venv` or data databases.
2. Repository Settings → Pages → Build and deployment → Source: GitHub Actions.
3. Actions → Publish Stockroom (free Pages) → Run workflow. Leave `demo` checked for the first deployment; this displays labelled demonstration data without API calls.
4. The successful deployment publishes to https://timo893131.github.io/stock-analysis/ (not live until deployment succeeds).
5. For real daily data, verify FinMind account/plan permissions for storing and publicly redistributing quotes. In Settings → Secrets and variables → Actions, add FINMIND_TOKEN as a secret if your plan needs it, and MARKET_DATA_PUBLIC_DISPLAY=true as a variable after confirming those rights. Rerun with demo unchecked.

Scheduled updates run weekdays at 18:20 and 22:20 Taipei. Each build fetches approximately 200 calendar days for six stocks, writes static JSON, and publishes only if all stocks sync successfully. Failed builds retain the previously deployed site; check Actions failures and the displayed trade date. This is a rolling historical window, not a permanent database. GitHub may delay schedules or disable them after prolonged repository inactivity; check Actions regularly. No browser needs to stay open.

Do not run demo mode over a live-data site unless you intend to replace it with a demonstration.

Limitations: browser-local portfolios, no server-side user accounts, no instant quotes/paper fills, no guaranteed trading-day calendar or corporate-action adjustment, no backtest engine yet. Public static JSON can be downloaded by anyone, which is why redistribution permission matters. Official announcement links remain available without copying news content.

The GCE scripts remain optional paid deployment examples; do not run them for this free path. If no DEPLOY confirmation was entered, that script has not created a VM. If it was entered earlier, inspect GCP for existing VMs/disks/IP resources; migrating to Pages does not delete them.
