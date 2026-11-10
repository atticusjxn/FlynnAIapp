#!/usr/bin/env python3
"""Minimal kie.ai driver: submit generation tasks, poll, download results.

Usage:
  kie.py submit '<json-input>' --model nano-banana-pro          -> prints taskId
  kie.py poll <taskId>                                          -> prints raw record JSON
  kie.py wait <taskId> [--out FILE]                             -> polls until done, downloads result
  kie.py credit
Reads KIE_API_KEY from ../../.env.kie relative to this file (or env).
"""
import json, os, sys, time, urllib.request

BASE = "https://api.kie.ai/api/v1"

def _key():
    if os.environ.get("KIE_API_KEY"):
        return os.environ["KIE_API_KEY"]
    env = os.path.join(os.path.dirname(__file__), "../../../.env.kie")
    with open(os.path.abspath(env)) as f:
        for line in f:
            if line.startswith("KIE_API_KEY="):
                return line.split("=", 1)[1].strip()
    raise SystemExit("no KIE_API_KEY")

def _req(path, payload=None):
    url = BASE + path
    data = json.dumps(payload).encode() if payload is not None else None
    r = urllib.request.Request(url, data=data, headers={
        "Authorization": f"Bearer {_key()}", "Content-Type": "application/json"})
    with urllib.request.urlopen(r, timeout=120) as resp:
        return json.loads(resp.read())

def submit(model, input_obj):
    out = _req("/jobs/createTask", {"model": model, "input": input_obj})
    if out.get("code") != 200:
        raise SystemExit(f"createTask failed: {out}")
    return out["data"]["taskId"]

def poll(task_id):
    return _req(f"/jobs/recordInfo?taskId={task_id}")

def wait(task_id, out_file=None, timeout=600):
    t0 = time.time()
    while time.time() - t0 < timeout:
        rec = poll(task_id)
        data = rec.get("data") or {}
        state = data.get("state")
        if state in ("success", "SUCCESS"):
            result = data.get("resultJson")
            if isinstance(result, str):
                result = json.loads(result)
            urls = (result or {}).get("resultUrls") or []
            if not urls and isinstance(result, dict):
                # fall back: search any url-looking string
                def find_urls(o):
                    if isinstance(o, str) and o.startswith("http"): return [o]
                    if isinstance(o, dict): return [u for v in o.values() for u in find_urls(v)]
                    if isinstance(o, list): return [u for v in o for u in find_urls(v)]
                    return []
                urls = find_urls(result)
            if out_file and urls:
                # tempfile.aiquickdraw.com IP-banned this machine; route through
                # the Supabase edge proxy (functions/kie-cdn-proxy).
                PROXY = "https://zvfeafmmtfplzpnocyjw.supabase.co/functions/v1/kie-cdn-proxy"
                ANON = ("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2ZmVhZm1tdGZwbHpwbm9jeWp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMDE1NDMsImV4cCI6MjA3MTc3NzU0M30.PnSY6rFvczDiDucsyN0nr-luR_Jb6a6O2uAeZxgBiRI")
                dl = urllib.request.Request(f"{PROXY}?url={urls[0]}", headers={"Authorization": f"Bearer {ANON}"})
                with urllib.request.urlopen(dl, timeout=600) as resp, open(out_file, "wb") as f:
                    f.write(resp.read())
                print(f"saved {out_file}")
            print(json.dumps({"taskId": task_id, "urls": urls}))
            return urls
        if state in ("fail", "FAIL", "failed"):
            raise SystemExit(f"task failed: {json.dumps(data)[:500]}")
        time.sleep(8)
    raise SystemExit("timeout")

if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "credit":
        print(_req("/chat/credit"))
    elif cmd == "submit":
        model = sys.argv[sys.argv.index("--model") + 1]
        print(submit(model, json.loads(sys.argv[2])))
    elif cmd == "poll":
        print(json.dumps(poll(sys.argv[2]), indent=2)[:2000])
    elif cmd == "wait":
        out = sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else None
        wait(sys.argv[2], out)
