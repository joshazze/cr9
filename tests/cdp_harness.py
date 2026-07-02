#!/usr/bin/env python3
"""Harness headless Chrome + CDP do CR9 (padrão do projeto).

Uso: importar `Harness` ou rodar tests/cdp_smoke.py.
Requer: Chrome instalado, `python3 -m pip install websocket-client`.
Sobe o próprio http.server e o Chrome headless; derruba tudo no exit.
"""
import json
import subprocess
import time
import urllib.request
import os
import signal
import socket

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


class Harness:
    def __init__(self):
        self.http_port = _free_port()
        self.cdp_port = _free_port()
        self.procs = []
        self.ws = None
        self._id = 0
        self.console = []

    def start(self):
        import websocket
        self.procs.append(subprocess.Popen(
            ["python3", "-m", "http.server", str(self.http_port), "--directory", ROOT],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
        self.procs.append(subprocess.Popen(
            [CHROME, "--headless=new", "--disable-gpu", "--no-sandbox",
             f"--remote-debugging-port={self.cdp_port}", "--remote-allow-origins=*",
             f"--user-data-dir=/tmp/cr9_cdp_{self.cdp_port}", "about:blank"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
        deadline = time.time() + 15
        tabs = None
        while time.time() < deadline:
            try:
                tabs = json.loads(urllib.request.urlopen(
                    f"http://localhost:{self.cdp_port}/json", timeout=2).read())
                if any(t.get("type") == "page" for t in tabs):
                    break
            except Exception:
                time.sleep(0.3)
        tab = next(t for t in tabs if t.get("type") == "page")
        self.ws = websocket.create_connection(tab["webSocketDebuggerUrl"], timeout=30)
        self.call("Runtime.enable")
        self.call("Page.enable")
        self.call("Log.enable")
        # iPhone viewport + light mode, como o vault documenta
        self.call("Emulation.setDeviceMetricsOverride",
                  {"width": 390, "height": 844, "deviceScaleFactor": 3, "mobile": True})
        self.call("Emulation.setEmulatedMedia",
                  {"media": "screen", "features": [{"name": "prefers-color-scheme", "value": "light"}]})
        return self

    def call(self, method, params=None):
        self._id += 1
        self.ws.send(json.dumps({"id": self._id, "method": method, "params": params or {}}))
        while True:
            msg = json.loads(self.ws.recv())
            if msg.get("method") == "Runtime.consoleAPICalled":
                typ = msg["params"].get("type")
                if typ in ("error", "warning"):
                    args = [a.get("value", a.get("description", "")) for a in msg["params"].get("args", [])]
                    self.console.append(f"console.{typ}: {args}")
            elif msg.get("method") == "Runtime.exceptionThrown":
                det = msg["params"]["exceptionDetails"]
                desc = (det.get("exception") or {}).get("description") or det.get("text")
                self.console.append(f"exception: {desc}")
            elif msg.get("method") == "Log.entryAdded":
                e = msg["params"]["entry"]
                if e.get("level") in ("error",):
                    self.console.append(f"log.{e['level']}: {e.get('text')}")
            if msg.get("id") == self._id:
                return msg

    def goto(self, path="index.html"):
        self.call("Page.navigate", {"url": f"http://localhost:{self.http_port}/{path}"})
        time.sleep(1.2)

    def ev(self, expr):
        r = self.call("Runtime.evaluate",
                      {"expression": expr, "returnByValue": True, "awaitPromise": True})
        res = r.get("result", {})
        if "exceptionDetails" in res or "exceptionDetails" in r:
            det = res.get("exceptionDetails") or r.get("exceptionDetails")
            raise RuntimeError(f"eval falhou: {json.dumps(det)[:400]}")
        return res.get("result", {}).get("value")

    def set_state(self, fixture):
        """Substitui o localStorage e recarrega o app."""
        self.ev("localStorage.clear()")
        self.ev(f"localStorage.setItem('cr9-v1', {json.dumps(json.dumps(fixture))})")
        self.goto()

    def screenshot(self, path):
        r = self.call("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": True})
        import base64
        with open(path, "wb") as f:
            f.write(base64.b64decode(r["result"]["data"]))

    def stop(self):
        try:
            if self.ws:
                self.ws.close()
        except Exception:
            pass
        for p in self.procs:
            try:
                p.send_signal(signal.SIGTERM)
            except Exception:
                pass
