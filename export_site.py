"""Build GitHub Pages files. Default requires successfully synchronized prices."""
import argparse
import hashlib
import re
import json
import shutil
from pathlib import Path
from ai_analysis import stored as ai_stored
from market import quotes
from fundamentals import reports, make_report
from market import STOCKS
from catalog import stored as catalog_stored, fallback as catalog_fallback
from universe import FOCUS


def build(output, demo=False):
    rows = [] if demo else quotes()
    if not demo and (not rows or any('error' in q or q.get('sync', {}).get('error') for q in rows)):
        raise ValueError('行情同步不完整；停止發布以保留現有網站。')
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    for source in Path('static').iterdir():
        if source.is_file():
            shutil.copy2(source, output / source.name)
    index = output / 'index.html'
    index.write_text(index.read_text().replace('<script src="./app.js">', '<script>window.STOCKROOM_STATIC=true;</script><script src="./app.js">'))
    data = output / 'data'
    data.mkdir(exist_ok=True)
    (data / 'catalog.json').write_text(json.dumps(catalog_fallback() if demo else catalog_stored(),ensure_ascii=False))
    (output / 'universe.js').write_text('window.STOCKROOM_UNIVERSE='+json.dumps([{'symbol':s,'name':n,'sector':sector} for s,n,sector in FOCUS],ensure_ascii=False)+';')
    (data / 'quotes.json').write_text(json.dumps({'quotes': rows}, ensure_ascii=False))
    (data / 'fundamentals.json').write_text(json.dumps({'reports': [make_report(s,{}) for s in STOCKS] if demo else reports()}, ensure_ascii=False, allow_nan=False))
    (data / 'ai.json').write_text(json.dumps({'reports': []} if demo else ai_stored(),ensure_ascii=False))
    (data / 'news.json').write_text(json.dumps({'items': []}))
    def version_asset(match):
        name=match.group(2)
        digest=hashlib.sha256((output/name).read_bytes()).hexdigest()[:12]
        return match.group(1)+'?v='+digest+'"'
    index.write_text(re.sub(r'((?:src|href)="\./([^"?]+\.(?:js|css)))"',version_asset,index.read_text()))
    (output / '.nojekyll').touch()

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--demo', action='store_true', help='Publish clearly labelled demonstration UI without fetching data')
    parser.add_argument('--output', default='site')
    args = parser.parse_args()
    build(args.output, args.demo)
