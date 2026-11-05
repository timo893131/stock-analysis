#!/usr/bin/env bash
set -euo pipefail
python sync_market.py --loop &
scheduler_pid=$!
gunicorn --bind "0.0.0.0:${PORT:-8000}" --workers 2 --threads 4 --timeout 30 --access-logfile - wsgi:application &
web_pid=$!
cleanup() { kill "$scheduler_pid" "$web_pid" 2>/dev/null || true; }
trap cleanup EXIT
trap 'exit 0' TERM INT
# Exit if either service fails so the cloud supervisor can restart both.
wait -n "$scheduler_pid" "$web_pid"
exit 1
