import http.server
import json
import os
import re
import socketserver
import sys
import threading
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
LEVEL_DIR = os.path.join(ROOT, "关卡集")
MAX_LEVEL_BODY = 2 * 1024 * 1024
IDLE_TIMEOUT = 15.0
BYE_GRACE = 4.0
NEVER_LOADED_TIMEOUT = 300.0

os.makedirs(LEVEL_DIR, exist_ok=True)

start_ts = time.time()
last_beat = 0.0
beat_seen = False
bye_at = 0.0
lock = threading.Lock()


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def log_message(self, fmt, *args):
        pass

    def do_GET(self):
        global last_beat, beat_seen, bye_at
        if self.path.startswith("/__health"):
            self._json_response(200, {"ok": True, "version": 2, "save": True})
            return
        if self.path.startswith("/__hb"):
            with lock:
                last_beat = time.time()
                beat_seen = True
                bye_at = 0.0
            self.send_response(204)
            self.end_headers()
            return
        if self.path.startswith("/__bye"):
            with lock:
                bye_at = time.time()
            self.send_response(204)
            self.end_headers()
            return
        if self.path.startswith("/__shutdown"):
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(b"bye")
            self.close_connection = True
            threading.Thread(target=_exit_soon, daemon=True).start()
            return
        super().do_GET()

    def do_POST(self):
        if self.path.startswith("/__save_level"):
            self._save_level()
            return
        self.send_error(404)

    def _json_response(self, code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _save_level(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_LEVEL_BODY:
            self._json_response(400, {"ok": False, "error": "请求内容为空或过大"})
            return
        try:
            data = json.loads(self.rfile.read(length).decode("utf-8"))
            if not isinstance(data, dict) or data.get("v") != 1:
                raise ValueError("不是有效的关卡 JSON")
            cells = data.get("cells")
            if not isinstance(cells, list) or len(cells) != 51:
                raise ValueError("cells 必须是 51 个格子")
            enemies = data.get("enemies")
            if not isinstance(enemies, list) or len(enemies) > 51:
                raise ValueError("enemies 格式不正确")
            name = str(data.get("name") or "未命名关卡").strip() or "未命名关卡"
            safe = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", name).strip(" .") or "未命名关卡"
            reserved = {"con", "prn", "aux", "nul"}
            reserved.update(f"com{i}" for i in range(1, 10))
            reserved.update(f"lpt{i}" for i in range(1, 10))
            if safe.lower() in reserved:
                safe = "_" + safe
            safe = safe[:80]
            os.makedirs(LEVEL_DIR, exist_ok=True)
            filename = safe + ".json"
            path = os.path.join(LEVEL_DIR, filename)
            if os.path.commonpath([os.path.abspath(path), os.path.abspath(LEVEL_DIR)]) != os.path.abspath(LEVEL_DIR):
                raise ValueError("非法文件名")
            overwrote = os.path.exists(path)
            with open(path, "w", encoding="utf-8", newline="\n") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            rel = os.path.relpath(path, ROOT).replace(os.sep, "/")
            self._json_response(200, {"ok": True, "file": rel, "overwrote": overwrote})
        except Exception as exc:
            self._json_response(400, {"ok": False, "error": str(exc)})


def _exit_soon():
    time.sleep(0.4)
    os._exit(0)


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def watchdog():
    while True:
        time.sleep(1.0)
        now = time.time()
        with lock:
            beat, bye, seen = last_beat, bye_at, beat_seen
        if bye and now - bye > BYE_GRACE:
            os._exit(0)
        if seen and now - beat > IDLE_TIMEOUT:
            os._exit(0)
        if not seen and now - start_ts > NEVER_LOADED_TIMEOUT:
            os._exit(0)


if __name__ == "__main__":
    threading.Thread(target=watchdog, daemon=True).start()
    try:
        httpd = Server(("127.0.0.1", PORT), Handler)
    except OSError as exc:
        print(f"[ERROR] cannot bind 127.0.0.1:{PORT} -> {exc}", flush=True)
        sys.exit(2)
    with httpd:
        print(f"[OK] serving {ROOT}", flush=True)
        print(f"[OK] http://127.0.0.1:{PORT}/index.html", flush=True)
        print("[OK] server exits after the page is closed", flush=True)
        httpd.serve_forever()
