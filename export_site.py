"""Build GitHub Pages files. Default requires successfully synchronized prices."""
import argparse
import json
import shutil
from pathlib import Path
from market import quotes


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
    (data / 'quotes.json').write_text(json.dumps({'quotes': rows}, ensure_ascii=False))
    (data / 'news.json').write_text(json.dumps({'items': []}))
    (output / '.nojekyll').touch()

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--demo', action='store_true', help='Publish clearly labelled demonstration UI without fetching data')
    parser.add_argument('--output', default='site')
    args = parser.parse_args()
    build(args.output, args.demo)
