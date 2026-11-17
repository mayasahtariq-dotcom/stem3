"""Start everything for a demo with one command (Windows, macOS or Linux):

    cd backend
    python scripts/start_demo.py

1. starts the API on port 8000
2. opens a free Cloudflare tunnel and writes its URL to PUBLIC_BASE_URL in backend/.env
3. restarts the API so it uses that URL
4. points your Twilio number at the API (incoming calls), if you own the number
5. prints the demo console link and keeps running until Ctrl+C

Needs cloudflared installed (winget install --id Cloudflare.cloudflared).
"""
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
ENV = BACKEND / ".env"
PORT = 8000
WINDOWS_CLOUDFLARED = Path(r"C:\Program Files (x86)\cloudflared\cloudflared.exe")


def find_cloudflared() -> str:
    found = shutil.which("cloudflared")
    if found:
        return found
    if WINDOWS_CLOUDFLARED.exists():
        return str(WINDOWS_CLOUDFLARED)
    sys.exit("cloudflared not found. Install it: winget install --id Cloudflare.cloudflared")


def start_api() -> subprocess.Popen[bytes]:
    env = {**os.environ, "PYTHONPATH": str(BACKEND)}
    return subprocess.Popen([sys.executable, "-m", "uvicorn", "app.main:app", "--port", str(PORT)],
                            cwd=BACKEND, env=env)


def wait_http(url: str, seconds: int = 40) -> bool:
    end = time.time() + seconds
    while time.time() < end:
        try:
            with urllib.request.urlopen(url, timeout=5) as r:
                if r.status == 200:
                    return True
        except OSError:
            time.sleep(1)
    return False


def set_env(key: str, value: str) -> None:
    text = ENV.read_text(encoding="utf-8") if ENV.exists() else ""
    line = f"{key}={value}"
    if re.search(rf"^{key}=.*$", text, flags=re.MULTILINE):
        text = re.sub(rf"^{key}=.*$", line, text, flags=re.MULTILINE)
    else:
        text += ("" if text.endswith("\n") or not text else "\n") + line + "\n"
    ENV.write_text(text, encoding="utf-8")


def main() -> None:
    api = start_api()
    if not wait_http(f"http://127.0.0.1:{PORT}/health"):
        api.terminate()
        sys.exit("The API did not start. Check backend/.env and the database connection.")
    print("API running on port", PORT)

    tunnel = subprocess.Popen([find_cloudflared(), "tunnel", "--no-autoupdate", "--url",
                               f"http://127.0.0.1:{PORT}"],
                              stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    url = ""
    end = time.time() + 60
    assert tunnel.stdout is not None
    while time.time() < end and not url:
        m = re.search(r"https://[a-z0-9-]+\.trycloudflare\.com", tunnel.stdout.readline())
        url = m.group(0) if m else ""
    if not url:
        api.terminate(); tunnel.terminate()
        sys.exit("The tunnel did not start. Check your internet connection and try again.")
    set_env("PUBLIC_BASE_URL", url)
    print("Tunnel:", url)

    api.terminate(); api.wait(10)                 # restart so settings pick up the new URL
    api = start_api()
    if not wait_http(f"{url}/health", 60):
        print("Warning: the tunnel URL is not answering yet. It can take a minute.")

    setup = subprocess.run([sys.executable, "scripts/twilio_setup.py"], cwd=BACKEND,
                           env={**os.environ, "PYTHONPATH": str(BACKEND)},
                           capture_output=True, text=True, check=False)
    out = (setup.stdout + setup.stderr).strip().splitlines()
    print("Twilio:", out[-1] if out else "skipped")

    print("\nDemo console:", f"{url}/demo")
    print("API docs:    ", f"{url}/docs")
    print("Press Ctrl+C to stop.")
    try:
        while api.poll() is None and tunnel.poll() is None:
            if tunnel.stdout is not None:
                tunnel.stdout.readline()          # keep the pipe drained
    except KeyboardInterrupt:
        pass
    finally:
        api.terminate(); tunnel.terminate()


if __name__ == "__main__":
    main()
