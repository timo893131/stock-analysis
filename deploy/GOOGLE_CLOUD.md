# Google Cloud deployment — daily close research

Target: one Ubuntu 24.04 Compute Engine VM (e2-small, asia-east1-b) with a persistent boot disk. Web + systemd timer share a local SQLite database. No Cloud Run: its disposable local filesystem is unsuitable for this SQLite deployment. Scaling later requires managed PostgreSQL and an independent scheduler/job.

## Before creating resources

Provide project ID, billing-enabled project, authorized Google Cloud identity, and a domain if public HTTPS is required. No resources have been created by this repository. Commands below incur Google Cloud charges; review pricing and your project first. Use a dedicated VM because bootstrap configures system packages/services.

## Create and upload (run in an authenticated Cloud Shell)

```sh
export PROJECT_ID=your-project-id
export ZONE=asia-east1-b

gcloud compute instances create stockroom --project="$PROJECT_ID" --zone="$ZONE" \
  --machine-type=e2-small --image-family=ubuntu-2404-lts-amd64 \
  --image-project=ubuntu-os-cloud --boot-disk-size=20GB --no-boot-disk-auto-delete \
  --no-service-account --no-scopes
```

Upload only application files, `requirements.txt`, `static/`, and `deploy/` via gcloud compute scp; exclude .git, .env, .venv, and data/. On the VM run `sudo APP_SOURCE=/path/to/uploaded/stock-analysis bash /path/to/uploaded/stock-analysis/deploy/gce-bootstrap.sh`.

Bootstrap binds the app and proxy to loopback. Use an authorized SSH tunnel for review. It does not create public firewall rules or configure a domain. For publication, configure an HTTPS load balancer with a managed certificate or an HTTPS reverse proxy and domain, then restrict firewall access appropriately. Never expose the Python development server. The VM may have a public IP, but the app remains loopback-only until configured.

## Data access

The FinMind TaiwanStockPrice adapter is implemented against its documented v4 shape. Review https://finmind.github.io/ and current account/plan terms. Availability of an API does not grant public redistribution rights. Confirm your plan permits storage, research, and public display. No API contract or commercial licence has been verified in this environment.

Set FINMIND_TOKEN in `/etc/stockroom.env` via a secure administrative channel if required by your plan. File owner root, mode 600. Never commit or send token values in chat. Only the sync service loads the token; the browser and web service do not need it. For a larger deployment migrate the token to Secret Manager with a narrowly scoped service account.

Run `sudo systemctl start stockroom-sync.service` for initial backfill (~200 calendar days). Check `journalctl -u stockroom-sync.service` and `/api/quotes` for persisted trade dates and last-success timestamps. `sync_failed` is a failure, not successful data readiness. The timer retries at 16:10, 18:10, 20:10 and 22:10 Taipei on weekdays; closed-market dates are not fabricated. Page views do not call the vendor. Repeated runs upsert the same day rather than duplicate records.

## Operations and updates

- Health: `/healthz` checks the web process only. `/api/quotes` separately reports per-symbol sync errors and dates. Monitor both; do not infer freshness from health alone.
- Data: `/var/lib/stockroom/market.sqlite3`; retained across process/VM restarts, provided the disk remains. Disk deletion is data deletion.
- Backup: use SQLite's backup API to generate a consistent backup and store it in a private Cloud Storage bucket with retention. Test restore before production. Backup automation is not yet configured.
- Update: upload reviewed files, rerun bootstrap, then check health, sync status and frontend. Do not overwrite the database or token file. Take a database backup before schema changes.
- One timer and one VM only in this version. Avoid concurrent schedulers or shared SQLite over network filesystems.
- Browser portfolios still use localStorage: cloud persistence/login for user portfolios is a separate feature.
- Daily close data cannot drive instant paper fills. A proper backtest must use a later bar for fills, include costs and corporate actions, and avoid look-ahead bias; this release does not implement a backtest engine.
