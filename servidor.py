#!/usr/bin/env python3
"""Fiction Studio — servidor local opcional (só biblioteca padrão do Python 3.8+).

O que ele faz:
  * serve os arquivos do aplicativo em http://localhost:8000
  * baixa imagens de um endereço web que você mesmo colar no app ("Importar por endereço web"),
    quando o site de origem bloqueia o download direto pelo navegador (CORS)

Ele NÃO pesquisa imagens na internet e não usa chaves de API.

Uso:  python servidor.py            (porta 8000)
      python servidor.py 8080       (outra porta)
"""
import http.server, json, os, sys, ssl, threading, webbrowser, ipaddress, socket
import urllib.request, urllib.parse

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = next((int(a) for a in sys.argv[1:] if a.isdigit()), 8000)
MAX_IMAGE = 25 * 1024 * 1024
UA = 'FictionStudio/1.2 (+ferramenta local de referências)'
CTX = ssl.create_default_context()


def is_public_host(host):
    """Impede que o download seja usado para acessar a rede interna."""
    try:
        for info in socket.getaddrinfo(host, None):
            ip = ipaddress.ip_address(info[4][0])
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
                return False
        return True
    except (socket.gaierror, ValueError):
        return False


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, fmt, *args):
        if '/api/' in (args[0] if args else ''):
            sys.stderr.write('  ' + (fmt % args) + '\n')

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store' if self.path.startswith('/api/') else 'no-cache')
        super().end_headers()

    def send_json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        if u.path == '/api/status':
            return self.send_json(200, {'ok': True, 'version': 2, 'features': ['image-download']})
        if u.path == '/api/image':
            return self.api_image(urllib.parse.parse_qs(u.query))
        return super().do_GET()

    def api_image(self, qs):
        url = (qs.get('url') or [''])[0]
        p = urllib.parse.urlparse(url)
        if p.scheme not in ('http', 'https') or not p.hostname or not is_public_host(p.hostname):
            return self.send_json(400, {'error': 'endereço não permitido'})
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'image/*', 'Referer': f'{p.scheme}://{p.hostname}/'})
            with urllib.request.urlopen(req, timeout=20, context=CTX) as r:
                ctype = r.headers.get('Content-Type', '').split(';')[0].strip()
                if not ctype.startswith('image/'):
                    return self.send_json(415, {'error': 'o endereço não é um arquivo de imagem'})
                data = r.read(MAX_IMAGE + 1)
                if len(data) > MAX_IMAGE:
                    return self.send_json(413, {'error': 'imagem maior que 25 MB'})
        except Exception as e:
            return self.send_json(502, {'error': 'não foi possível baixar: %s' % e})
        self.send_response(200)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def main():
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Handler)
    url = f'http://localhost:{PORT}/'
    print('Fiction Studio rodando em ' + url)
    print('Feche esta janela (ou Ctrl+C) para encerrar.')
    if '--sem-navegador' not in sys.argv:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
