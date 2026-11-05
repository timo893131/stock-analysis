"""Private Actions diagnostic: emit status/dates only, never tokens or response bodies."""
import datetime as dt
import json
import os
import urllib.error
from market import FinMindProvider, TZ


def check():
    start = (dt.datetime.now(TZ).date() - dt.timedelta(days=14)).isoformat()
    try:
        rows = FinMindProvider().daily('2330.TW', start)
        return {'status': 'ok', 'symbol': '2330.TW', 'rows': len(rows), 'latestTradeDate': max(row[0] for row in rows)}
    except urllib.error.HTTPError as error:
        return {'status': 'failed', 'reason': 'http_' + str(error.code)}
    except urllib.error.URLError:
        return {'status': 'failed', 'reason': 'network_or_tls_error'}
    except (ValueError, KeyError, TypeError):
        return {'status': 'failed', 'reason': 'provider_rejected_or_invalid_data'}
    except Exception:
        return {'status': 'failed', 'reason': 'unexpected_error'}

if __name__ == '__main__':
    result = check()
    print(json.dumps(result))
    summary = os.environ.get('GITHUB_STEP_SUMMARY')
    if summary:
        with open(summary, 'a') as out:
            out.write('## 行情 API 連線檢查\n\n')
            if result['status'] == 'ok':
                out.write(f"成功取得台積電近兩週 {result['rows']} 筆資料，最新交易日：{result['latestTradeDate']}。\n\n")
                out.write('連線成功不代表取得公開展示授權。請確認方案條款後，再啟用真實行情發布。\n')
            else:
                out.write(f"檢查失敗：`{result['reason']}`。請確認 FinMind 服務狀態、API 方案與 FINMIND_TOKEN secret。\n")
            out.write('\n已上線網站未變更；未上傳任何行情檔案。\n')
    raise SystemExit(0 if result['status'] == 'ok' else 1)
