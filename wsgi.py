"""Production WSGI entry point; no remote API calls in web request paths."""
import json
import mimetypes
from pathlib import Path
from market import quotes
from fundamentals import reports

STATIC = Path(__file__).parent / 'static'

def application(environ, start_response):
    path = environ.get('PATH_INFO', '/')
    headers = [('X-Content-Type-Options', 'nosniff'), ('X-Frame-Options', 'DENY'), ('Referrer-Policy', 'strict-origin-when-cross-origin')]
    status = '200 OK'
    if environ.get('REQUEST_METHOD') not in ('GET', 'HEAD'):
        status, content, kind = '405 Method Not Allowed', b'Method not allowed', 'text/plain'
    elif path in ('/healthz', '/api/quotes', '/api/news', '/api/fundamentals'):
        data = {'status': 'ok'} if path == '/healthz' else {'quotes': quotes()} if path == '/api/quotes' else {'reports': reports()} if path == '/api/fundamentals' else {'items': [], 'error': '目前提供官方公告入口；新聞 API 待選定授權來源。'}
        content, kind = json.dumps(data, ensure_ascii=False).encode(), 'application/json; charset=utf-8'
        headers.append(('Cache-Control', 'no-store'))
    else:
        target = (STATIC / ('index.html' if path == '/' else path.lstrip('/'))).resolve()
        if target.is_relative_to(STATIC.resolve()) and target.is_file() and target.suffix in ('.html', '.css', '.js', '.svg', '.png', '.ico'):
            content = target.read_bytes()
            kind = mimetypes.guess_type(target.name)[0] or 'application/octet-stream'
        else:
            status, content, kind = '404 Not Found', b'Not found', 'text/plain'
    headers += [('Content-Type', kind), ('Content-Length', str(len(content)))]
    start_response(status, headers)
    return [b'' if environ.get('REQUEST_METHOD') == 'HEAD' else content]
