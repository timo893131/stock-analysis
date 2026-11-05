"""Run once, or keep a singleton scheduler alive on a persistent cloud service."""
import argparse
import datetime as dt
import json
import time
from market import sync, TZ

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--loop', action='store_true')
    args = parser.parse_args()
    if not args.loop:
        results = sync()
        print(json.dumps(results))
        raise SystemExit(0 if all(x == 'ok' for x in results.values()) else 1)
    # Poll hourly after 16:00 Taipei on weekdays, retrying provider publication lag.
    # Persistent upserts make restarts/repeated runs safe; only one scheduler required.
    last = None
    while True:
        now = dt.datetime.now(TZ)
        slot = now.strftime('%Y-%m-%d-%H')
        if now.weekday() < 5 and now.hour >= 16 and slot != last:
            print(json.dumps(sync()), flush=True)
            last = slot
        time.sleep(30)
