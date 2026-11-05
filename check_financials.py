"""Probe real financial API access/schema; never publish raw reports or credentials."""
import json
import os
import urllib.error
from fundamentals import DATASETS, DatasetError, fetch_statement, make_report

EXPECTED = {'income': ('Revenue','GrossProfit','EPS'),
            'balance': ('TotalAssets','Liabilities','CurrentAssets','CurrentLiabilities'),
            'cash': ('CashFlowsFromOperatingActivities',)}


def inspect(fetcher=fetch_statement):
    data, results = {}, {}
    for kind in DATASETS:
        try:
            rows = fetcher('2330.TW',kind)
            data[kind] = rows
            latest = max(row['date'] for row in rows)
            if kind == 'revenue':
                missing = [key for key in ('revenue_year','revenue_month','revenue') if any(key not in r for r in rows)]
            else:
                types = {r.get('type') for r in rows if r['date']==latest}
                missing = [field for field in EXPECTED[kind] if field not in types]
            results[kind] = {'status':'schema_missing' if missing else 'ok','rows':len(rows), 'latestPeriod':latest,'missingFields':missing}
        except urllib.error.HTTPError as error:
            results[kind] = {'status':'failed','reason':'http_'+str(error.code)}
        except DatasetError as error:
            results[kind] = {'status':'failed','reason':error.reason}
        except urllib.error.URLError:
            results[kind] = {'status':'failed','reason':'network_or_tls_error'}
        except Exception:
            results[kind] = {'status':'failed','reason':'invalid_or_unexpected_response'}
    report = make_report('2330.TW',data)
    return {'tokenConfigured':bool(os.environ.get('FINMIND_TOKEN')), 'datasets':results,
        'availableMetrics':report['coverage'], 'totalMetrics':report['total'],
        'ready':all(x['status']=='ok' for x in results.values()) and report['coverage']==report['total']}


def summary(result):
    lines=['## 真實財報 API 檢查（台積電 2330）','',
        'FINMIND_TOKEN：'+('已設定' if result['tokenConfigured'] else '未設定，使用匿名請求'),'',
        '| 資料集 | 結果 | 最新來源日期 | 筆數 | 缺少欄位／錯誤 |','|---|---|---|---|---|']
    for kind,item in result['datasets'].items():
        # Only controlled keys/status codes and ISO dates are included, never response bodies.
        lines.append(f"| {DATASETS[kind]} | {item['status']} | {item.get('latestPeriod','—')} | {item.get('rows','—')} | {', '.join(item.get('missingFields',[])) or item.get('reason','—')} |")
    lines += ['',f"可計算指標：{result['availableMetrics']} / {result['totalMetrics']}。",'',
        '財報來源日期是期間截止日，不是公告日；月營收另以營收年月判定期間。',
        '401/403 或 provider_400 等拒絕可能涉及金鑰、權限、額度或請求條件，不能僅憑此判定需要付費。',
        'schema_missing 代表需要調整欄位對照，不能直接以零補值。',
        '連線成功不代表公開展示授權；此檢查不發布報表數值或修改網站。']
    return '\n'.join(lines)+'\n'

if __name__ == '__main__':
    result = inspect()
    print(json.dumps(result,ensure_ascii=False))
    path = os.environ.get('GITHUB_STEP_SUMMARY')
    if path:
        with open(path,'a') as out:out.write(summary(result))
    raise SystemExit(0 if result['ready'] else 1)
