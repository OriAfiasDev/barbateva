#!/usr/bin/env python3
"""Static preview server with HTTP Range support (Safari needs 206 for <video>).
Usage: python3 serve.py [port]"""
import os, re, sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

class RangeHandler(SimpleHTTPRequestHandler):
    def send_head(self):
        path = self.translate_path(self.path)
        rng = self.headers.get('Range')
        if not rng or os.path.isdir(path) or not os.path.exists(path):
            return super().send_head()
        m = re.match(r'bytes=(\d*)-(\d*)', rng)
        if not m:
            return super().send_head()
        size = os.path.getsize(path)
        start = int(m.group(1)) if m.group(1) else max(0, size - int(m.group(2)))
        end = int(m.group(2)) if m.group(1) and m.group(2) else size - 1
        end = min(end, size - 1)
        if start > end:
            self.send_error(416); return None
        f = open(path, 'rb'); f.seek(start)
        self.send_response(206)
        self.send_header('Content-Type', self.guess_type(path))
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.send_header('Content-Length', str(end - start + 1))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self._range_len = end - start + 1
        return f

    def copyfile(self, source, outputfile):
        n = getattr(self, '_range_len', None)
        if n is None:
            return super().copyfile(source, outputfile)
        while n > 0:
            chunk = source.read(min(65536, n))
            if not chunk: break
            outputfile.write(chunk); n -= len(chunk)

    def end_headers(self):
        if not any(h.lower() == 'accept-ranges' for h, _ in self._headers_buffer_names()):
            self.send_header('Accept-Ranges', 'bytes')
        if not any(h.lower() == 'cache-control' for h, _ in self._headers_buffer_names()):
            self.send_header('Cache-Control', 'no-store')   # dev server: always fresh
        super().end_headers()

    def _headers_buffer_names(self):
        for line in getattr(self, '_headers_buffer', []):
            try:
                k, v = line.decode('latin-1').split(':', 1); yield k, v
            except ValueError:
                continue

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    ThreadingHTTPServer(('127.0.0.1', port), RangeHandler).serve_forever()
