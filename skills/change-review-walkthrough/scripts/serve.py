#!/usr/bin/env python3
"""Usage: serve.py data.json change.diff [--round round.diff] [--port 8765] [--dry-run]
       serve.py data.json change.diff --local <repo> [--round round.diff] [--port 8765]
Serves the review page on 127.0.0.1. Your edits, decisions and own comments are saved next to
data.json, so a reload loses nothing.
PR mode (data.json has a GitHub PR url): uses the gh CLI and your gh login (no token in the page)
to show the PR description and existing threads, expand context, and post the comments you
approve as one review, plus file comments and thread replies, after a confirm in the page, once.
--dry-run prints instead of posting and keeps its saved state in a separate file.
Local mode (--local): expands context from the working tree, and Submit writes feedback.json next
to data.json and stops the server, so whoever started it can read the feedback and act on it."""
import html, json, pathlib, re, secrets, subprocess, sys, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from render import load, parse_diff, render

args = sys.argv[1:]
if len(args) < 2:
    sys.exit(__doc__)
opt = lambda name: args[args.index(name) + 1] if name in args else None
port = int(opt("--port") or 8765)
dry = "--dry-run" in args
local_repo = opt("--local")
round_path = opt("--round")
data, diff_text = load(args[0], args[1])
round_text = pathlib.Path(round_path).read_text() if round_path else None
if local_repo:
    repo = number = None
    data["mode"] = "local"
else:
    m = re.match(r"https://github\.com/([^/]+/[^/]+)/pull/(\d+)", data.get("url", ""))
    if not m:
        sys.exit("data.json needs a GitHub PR url, or pass --local <repo>; or use render.py for a static page")
    repo, number = m.group(1), m.group(2)
    data["mode"] = "pr"
token = secrets.token_urlsafe(24)
data_dir = pathlib.Path(args[0]).resolve().parent
state_path = pathlib.Path(args[0]).with_suffix(".dry-state.json" if dry else ".state.json")
feedback_path = data_dir / "feedback.json"
lock = threading.Lock()

# What may be posted: Claude's drafts by (path, line), and your own comments on any diff row.
DIFF = parse_diff(diff_text)
allowed = {(f["path"], c["line"]) for f in data["files"] for c in f.get("comments", [])}
paths = {f["path"] for f in data["files"]}


def row_index(path):
    """(side, line) -> (hunk, row) for every row a GitHub line comment can attach to."""
    out = {}
    for h, hunk in enumerate(DIFF.get(path, [])):
        for i, (t, _, o, n) in enumerate(hunk["rows"]):
            out[("LEFT", o) if t == "-" else ("RIGHT", n)] = (h, i)
    return out


ROWS = {p: row_index(p) for p in paths}


def gh(*a, stdin=None):
    return subprocess.run(["gh", *a], input=stdin, capture_output=True, text=True, timeout=60)


def read_state():
    try:
        return json.loads(state_path.read_text())
    except (OSError, ValueError):
        return {"page": {}, "submitted": None, "posted": []}


def write_state(s):
    tmp = state_path.with_suffix(".tmp")
    tmp.write_text(json.dumps(s, ensure_ascii=False, indent=1))
    tmp.replace(state_path)


def plain(body):
    """Bot comments carry HTML and collapsed <details> blocks; keep the markdown text only."""
    body = re.sub(r"<details>.*?</details>", "", body or "", flags=re.S | re.I)
    body = re.sub(r"<br\s*/?>", "\n", body, flags=re.I)
    body = html.unescape(re.sub(r"<[^>]+>", "", body))
    return re.sub(r"\n{3,}", "\n\n", body).strip()


def fetch_threads():
    r = gh("api", "--paginate", "--slurp", f"repos/{repo}/pulls/{number}/comments?per_page=100")
    if r.returncode:
        print("warning: could not read existing PR threads: " + r.stderr.strip())
        return []
    raw = [c for page in json.loads(r.stdout) for c in page]
    roots = {}
    for c in sorted(raw, key=lambda c: c["created_at"]):
        root = c.get("in_reply_to_id") or c["id"]
        t = roots.setdefault(root, {"id": str(root), "path": c["path"], "side": c.get("side") or "RIGHT", "line": c.get("line"),
                                    "original_line": c.get("original_line"), "url": c["html_url"], "comments": []})
        t["comments"].append({"author": (c.get("user") or {}).get("login", "?"), "at": c["created_at"][:10],
                              "body": plain(c["body"]), "url": c["html_url"]})
    out = list(roots.values())
    me = gh("api", "user", "--jq", ".login")
    me = me.stdout.strip() if not me.returncode else ""
    nodes, cursor = {}, None
    q = "query($o:String!,$n:String!,$p:Int!,$c:String){repository(owner:$o,name:$n){pullRequest(number:$p){reviewThreads(first:100,after:$c){pageInfo{hasNextPage endCursor} nodes{id isResolved comments(first:1){nodes{databaseId}}}}}}}"
    owner, name = repo.split("/")
    while True:
        args = ["api", "graphql", "-f", "query=" + q, "-f", "o=" + owner, "-f", "n=" + name, "-F", "p=" + str(number)]
        if cursor:
            args += ["-f", "c=" + cursor]
        g = gh(*args)
        if g.returncode:
            print("warning: could not read thread resolve state: " + g.stderr.strip())
            break
        rt = json.loads(g.stdout)["data"]["repository"]["pullRequest"]["reviewThreads"]
        for n in rt["nodes"]:
            for c in n["comments"]["nodes"]:
                nodes[str(c["databaseId"])] = n
        if not rt["pageInfo"]["hasNextPage"]:
            break
        cursor = rt["pageInfo"]["endCursor"]
    for t in out:
        n = nodes.get(t["id"])
        if n:
            t["node"], t["resolved"] = n["id"], n["isResolved"]
        t["mine"] = bool(me) and t["comments"][0]["author"] == me
    return out


head = "DRYRUN"
if repo:
    r = gh("pr", "view", number, "--repo", repo, "--json", "headRefOid,body")
    if r.returncode:
        sys.exit("gh could not read the PR: " + r.stderr.strip())
    pr = json.loads(r.stdout)
    data["pr_body"] = plain(pr.get("body") or "")
    reviewed = data.get("review", {}).get("head", "")
    if not dry:
        head = pr["headRefOid"]
        if reviewed and not head.startswith(reviewed):
            sys.exit(f"PR head is now {head[:8]} but the review was made at {reviewed}; re-run the review so lines match")
    file_ref = pr["headRefOid"]
    data["threads"] = fetch_threads()
thread_ids = {str(t.get("id")) for t in data.get("threads", [])}
resolvable = {str(t["id"]): t["node"] for t in data.get("threads", []) if t.get("mine") and t.get("node") and not t.get("resolved")}
data["post"] = {"token": token, "repo": repo or "", "number": number or "", "dry": dry}
file_cache = {}


def file_lines(path):
    """The changed file as it is now: the PR head, or the local working tree."""
    if path not in paths:
        raise ValueError("not a file in this change")
    if path not in file_cache:
        if local_repo:
            p = (pathlib.Path(local_repo) / path).resolve()
            if not str(p).startswith(str(pathlib.Path(local_repo).resolve()) + "/"):
                raise ValueError("path outside the repository")
            text = p.read_text(errors="replace")
        else:
            r = gh("api", "-H", "Accept: application/vnd.github.raw", f"repos/{repo}/contents/{path}?ref={file_ref}")
            if r.returncode:
                raise ValueError("gh could not read the file: " + r.stderr.strip()[:200])
            text = r.stdout
        lines = text.split("\n")
        file_cache[path] = lines[:-1] if lines and lines[-1] == "" else lines
    return file_cache[path]


def check_comment(c):
    path, body = c["path"], str(c["body"]).strip()
    if path not in paths or not body:
        raise ValueError(f"unknown file or empty comment at {path}")
    side, line = c.get("side", "RIGHT"), int(c["line"])
    if c.get("source") == "claude":
        if (path, line) not in allowed or side != "RIGHT":
            raise ValueError(f"not one of Claude's drafts: {path}:{line}")
    end = ROWS[path].get((side, line))
    if not end:
        raise ValueError(f"line {line} ({side}) is not in the diff of {path}")
    out = {"path": path, "line": line, "side": side, "body": body}
    if c.get("start_line") is not None:
        ss, sl = c.get("start_side", side), int(c["start_line"])
        start = ROWS[path].get((ss, sl))
        if not start or start[0] != end[0] or start[1] > end[1]:
            raise ValueError(f"comment range on {path} must stay inside one hunk")
        if (ss, sl) != (side, line):
            out.update(start_line=sl, start_side=ss)
    return out


def check_review(req):
    event = req.get("event", "COMMENT")
    events = ("QUESTIONS", "FIX", "APPROVE") if local_repo else ("COMMENT", "APPROVE", "REQUEST_CHANGES")
    if event not in events:
        raise ValueError(f"unknown review verdict {event}")
    body = str(req.get("body", "")).strip()
    if not local_repo and event != "APPROVE" and not body:
        raise ValueError("a Comment or Request changes review needs a summary")  # GitHub requires it
    cs = [check_comment(c) for c in req.get("comments", [])]
    files = []
    for f in req.get("files", []):
        if f["path"] not in paths or not str(f["body"]).strip():
            raise ValueError("unknown file or empty file comment")
        files.append({"path": f["path"], "body": str(f["body"]).strip()})
    replies = []
    for r in req.get("replies", []):
        if str(r["thread"]) not in thread_ids or not str(r["body"]).strip():
            raise ValueError("unknown thread or empty reply")
        replies.append({"thread": str(r["thread"]), "body": str(r["body"]).strip()})
    resolves = []
    for t in req.get("resolves", []):
        if str(t) not in resolvable:
            raise ValueError("you can only resolve open threads you started")
        resolves.append(str(t))
    return event, body, cs, files, replies, resolves


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def send(self, code, body, ctype="application/json"):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body if isinstance(body, bytes) else json.dumps(body).encode())

    def host_ok(self):
        return self.headers.get("Host") in (f"127.0.0.1:{port}", f"localhost:{port}")

    def do_GET(self):
        if self.path != "/" or not self.host_ok():
            return self.send(404, {"error": "not found"})
        with lock:
            s = read_state()
        saved = {**s.get("page", {}), "reviewUrl": s.get("submitted") or "", "posted": s.get("posted", [])}
        self.send(200, render({**data, "saved": saved}, diff_text, round_text).encode(), "text/html; charset=utf-8")

    def do_POST(self):
        if self.path not in ("/review", "/state", "/file") or not self.host_ok() or self.headers.get("X-Token") != token:
            return self.send(403, {"error": "forbidden"})
        try:
            req = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))
        except ValueError:
            return self.send(400, {"error": "bad request"})
        if self.path == "/state":
            with lock:
                s = read_state()
                s["page"] = {k: req.get(k) for k in ("edits", "dec", "review", "event", "viewed", "own", "nid", "ready", "res")}
                write_state(s)
            return self.send(200, {"ok": True})
        if self.path == "/file":
            try:
                return self.send(200, {"lines": file_lines(str(req.get("path", "")))})
            except (OSError, ValueError) as e:
                return self.send(400, {"error": str(e)})
        with lock:
            if read_state().get("submitted"):
                return self.send(409, {"error": "a review was already submitted for this walkthrough"})
            try:
                event, body, cs, files, replies, resolves = check_review(req)
            except (KeyError, TypeError, ValueError) as e:
                return self.send(400, {"error": str(e) or "bad request"})
            keys = [str(k) for k in req.get("keys", [])]
            if local_repo:
                feedback = {"verdict": event, "ready_for_review": bool(req.get("ready")), "summary": body,
                            "comments": [{**c, **{k: v for k, v in src.items() if k in ("source", "title")}}
                                         for c, src in zip(cs, req.get("comments", []))],
                            "file_comments": files, "replies": replies, "round": data.get("round", {}).get("label", "Round 1")}
                feedback_path.write_text(json.dumps(feedback, ensure_ascii=False, indent=1))
                url, errors = "sent", []
            elif dry:
                print(f"[dry-run] {repo}#{number} {event} review: {body}")
                for c in cs:
                    rng = f"{c['start_line']}-" if "start_line" in c else ""
                    print(f"  {c['path']}:{rng}{c['line']} {c['side']}\n    " + c["body"].replace("\n", "\n    "))
                for f in files:
                    print(f"  file {f['path']}\n    " + f["body"].replace("\n", "\n    "))
                for r in replies:
                    print(f"  reply to thread {r['thread']}\n    " + r["body"].replace("\n", "\n    "))
                for t in resolves:
                    print(f"  resolve thread {t}")
                url, errors = "dry-run", []
            else:
                payload = json.dumps({"commit_id": head, "event": event, "body": body, "comments": cs})
                r = gh("api", "-X", "POST", f"repos/{repo}/pulls/{number}/reviews", "--input", "-", stdin=payload)
                if r.returncode:
                    return self.send(502, {"error": (r.stderr or r.stdout).strip()[:500]})
                url, errors = json.loads(r.stdout).get("html_url", "") or "posted", []
                # File comments and replies cannot be part of a review on the REST API; post them right after it.
                for f in files:
                    r = gh("api", "-X", "POST", f"repos/{repo}/pulls/{number}/comments", "--input", "-",
                           stdin=json.dumps({"commit_id": head, "path": f["path"], "body": f["body"], "subject_type": "file"}))
                    if r.returncode:
                        errors.append(f"file comment on {f['path']}: {(r.stderr or r.stdout).strip()[:200]}")
                for rp in replies:
                    r = gh("api", "-X", "POST", f"repos/{repo}/pulls/{number}/comments/{rp['thread']}/replies", "-f", f"body={rp['body']}")
                    if r.returncode:
                        errors.append(f"reply to thread {rp['thread']}: {(r.stderr or r.stdout).strip()[:200]}")
            if not local_repo and not dry:
                for t in resolves:
                    r = gh("api", "graphql", "-f", "query=mutation($t:ID!){resolveReviewThread(input:{threadId:$t}){thread{isResolved}}}", "-f", "t=" + resolvable[t])
                    if r.returncode:
                        errors.append(f"resolve thread {t}: {(r.stderr or r.stdout).strip()[:200]}")
            s = read_state()
            s["submitted"], s["posted"] = url, keys
            write_state(s)
        self.send(200, {"url": url, "errors": errors})
        if local_repo:
            print(f"Feedback written to {feedback_path}; stopping the server.")
            threading.Thread(target=server.shutdown, daemon=True).start()


sys.stdout.reconfigure(line_buffering=True)
server = ThreadingHTTPServer(("127.0.0.1", port), H)
where = f"local changes in {local_repo}" if local_repo else f"{repo}#{number}{' (dry run)' if dry else ''}"
print(f"Serving {where} at http://127.0.0.1:{port}/ with {len(data.get('threads', []))} existing threads. Saved state: {state_path}. Ctrl+C to stop")
server.serve_forever()
