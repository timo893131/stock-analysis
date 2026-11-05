"""Local development only. Production: gunicorn wsgi:application."""
import os
from wsgiref.simple_server import make_server
from wsgi import application

if __name__ == '__main__':
    make_server('0.0.0.0', int(os.environ.get('PORT', '8000')), application).serve_forever()
