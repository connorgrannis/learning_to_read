# Local server for the reader: like `python3 -m http.server`, but tells browsers
# not to cache, so edits to app.js / style.css show up on the iPad after a reload.
#
#   python3 serve.py          (port 8000)
#   python3 serve.py 8080     (another port)

import http.server
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
with http.server.ThreadingHTTPServer(("0.0.0.0", port), NoCacheHandler) as server:
    print(f"Serving on http://localhost:{port}/ (Ctrl+C to stop)")
    server.serve_forever()
