#!/usr/bin/env bash
# Run via sudo on a dedicated Ubuntu 24.04 GCE VM after copying the checkout.
set -euo pipefail
: "${APP_SOURCE:?Set APP_SOURCE to the uploaded checkout path}"
apt-get update
apt-get install -y python3-venv nginx
id stockroom >/dev/null 2>&1 || useradd --system --home /opt/stockroom --shell /usr/sbin/nologin stockroom
install -d -o root -g root /opt/stockroom
install -d -o stockroom -g stockroom -m 750 /var/lib/stockroom
# Explicit source files only: never copy .env, credentials, databases, or local venv.
cp "$APP_SOURCE"/{market.py,fundamentals.py,ai_analysis.py,wsgi.py,sync_market.py,requirements.txt} /opt/stockroom/
cp -r "$APP_SOURCE/static" /opt/stockroom/
chmod -R a+rX /opt/stockroom
python3 -m venv /opt/stockroom/.venv
/opt/stockroom/.venv/bin/pip install -r /opt/stockroom/requirements.txt
install -m 644 "$APP_SOURCE"/deploy/stockroom-{web.service,sync.service,sync.timer} /etc/systemd/system/
# Local-only HTTP preview; expose publicly only after configuring HTTPS/domain.
cat >/etc/nginx/sites-available/stockroom <<'NGINX'
server {
  listen 127.0.0.1:8080;
  server_name _;
  location / {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
NGINX
ln -sf /etc/nginx/sites-available/stockroom /etc/nginx/sites-enabled/stockroom
nginx -t
systemctl daemon-reload
systemctl enable --now stockroom-web.service stockroom-sync.timer
systemctl restart stockroom-web.service
systemctl reload nginx
curl --fail http://127.0.0.1:8080/healthz
