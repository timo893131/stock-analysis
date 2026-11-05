#!/usr/bin/env bash
# Run from this extracted application directory in Google Cloud Shell.
set -euo pipefail
PROJECT_ID=stock-analysis-513806
ZONE=asia-east1-b
INSTANCE=stockroom
ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
command -v gcloud >/dev/null || { echo '請在 Google Cloud Shell 執行。'; exit 1; }
echo "部署至 $PROJECT_ID / $ZONE，建立 e2-small VM 與 20GB 持久磁碟；會產生 Google Cloud 費用。"
read -r -p '輸入 DEPLOY 確認建立資源：' answer
[[ "$answer" == DEPLOY ]] || exit 1
gcloud services enable compute.googleapis.com --project="$PROJECT_ID"
# Refuse to overwrite any existing VM with the same name.
existing="$(gcloud compute instances list --project="$PROJECT_ID" --filter="name=$INSTANCE" --format='value(name)')"
if [[ -n "$existing" ]]; then
  echo '已有 stockroom 主機；請先檢查既有服務。此首次部署腳本不覆寫主機。'
  exit 1
fi
gcloud compute instances create "$INSTANCE" --project="$PROJECT_ID" --zone="$ZONE" \
  --machine-type=e2-small --image-family=ubuntu-2404-lts-amd64 \
  --image-project=ubuntu-os-cloud --boot-disk-size=20GB --no-boot-disk-auto-delete \
  --no-service-account --no-scopes
stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT
mkdir -p "$stage/stock-analysis"
cp market.py fundamentals.py wsgi.py sync_market.py requirements.txt "$stage/stock-analysis/"
cp -r static deploy "$stage/stock-analysis/"
# Wait for SSH readiness before transferring. Host-key verification stays enabled.
ready=false
for attempt in {1..12}; do
  if gcloud compute ssh "$INSTANCE" --project="$PROJECT_ID" --zone="$ZONE" --command='true' --quiet; then ready=true; break; fi
  sleep 5
done
if [[ "$ready" != true ]]; then
  echo '主機已建立但 SSH 尚未可用，請檢查專案防火牆與 SSH 權限。主機仍會計費。'
  exit 1
fi
gcloud compute scp --recurse "$stage/stock-analysis" "$INSTANCE:~/" --project="$PROJECT_ID" --zone="$ZONE"
gcloud compute ssh "$INSTANCE" --project="$PROJECT_ID" --zone="$ZONE" \
  --command='sudo APP_SOURCE="$HOME/stock-analysis" bash "$HOME/stock-analysis/deploy/gce-bootstrap.sh"'
echo '網站已安裝；啟動初次資料同步（若來源需要金鑰，請依 GOOGLE_CLOUD.md 安全設定）。'
gcloud compute ssh "$INSTANCE" --project="$PROJECT_ID" --zone="$ZONE" \
  --command='sudo systemctl start stockroom-sync.service' || echo '同步失敗，請檢查來源授權、金鑰或連線。網站安裝仍保留。'
echo '開啟下列 SSH 通道後，在 Cloud Shell 選「網頁預覽 → 預覽通訊埠 8080」：'
echo "gcloud compute ssh $INSTANCE --project=$PROJECT_ID --zone=$ZONE -- -N -L 8080:127.0.0.1:8080"
echo '這是登入後的檢閱預覽，正式公開網址仍需要網域與 HTTPS 設定。'
echo '停止 VM 仍有磁碟費用；刪除 VM 時本腳本設定保留磁碟。'
