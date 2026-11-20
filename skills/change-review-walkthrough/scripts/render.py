#!/usr/bin/env python3
"""Usage: render.py data.json change.diff out.html [--round round.diff]
Builds one self-contained page from index.html, app.css, app.js, data.json and the full unified diff. Every file in the
diff must be in data.json and the reverse; every comment and focus line must be a new-side line in
the diff (GitHub cannot attach an inline comment anywhere else). With --round (the diff of what
changed since the previous review round), changed lines are flagged so the page can highlight them."""
import copy, json, pathlib, re, sys

assets = pathlib.Path(__file__).resolve().parents[1] / "assets"


def parse_diff(text):
    """{path: [{"h": "@@ ... @@ ctx", "rows": [[sign, code, old, new], ...]}, ...]}"""
    files, hunks, o, n, pending = {}, None, 0, 0, None
    for l in text.split("\n"):
        if l.startswith("diff --git"):
            hunks = None
            m = re.match(r"diff --git a/(.+) b/(.+)$", l)
            pending = m.group(2) if m else None
        elif l.startswith("+++ "):
            p = l[4:]
            path = pending if p == "/dev/null" else (p[2:] if p.startswith("b/") else p)
            hunks = files.setdefault(path, [])
        elif l.startswith("@@") and hunks is not None:
            m = re.match(r"@@ -(\d+)(?:,\d+)? \+(\d+)", l)
            o, n = int(m.group(1)), int(m.group(2))
            hunks.append({"h": l, "rows": []})
        elif hunks and l[:1] in ("+", "-", " "):
            t = l[0]
            hunks[-1]["rows"].append([t, l[1:], "" if t == "+" else o, "" if t == "-" else n])
            o += t != "+"
            n += t != "-"
        elif hunks and l.startswith("\\"):
            continue
    return files


def render(data, diff_text, round_text=None):
    data = copy.deepcopy(data)  # serve.py renders on every request; never mutate its copy
    data.setdefault("mode", "pr" if re.match(r"https://github\.com/[^/]+/[^/]+/pull/\d+", data.get("url", "")) else "local")
    fresh = {p: {r[3] for h in hs for r in h["rows"] if r[0] == "+"} for p, hs in parse_diff(round_text).items()} if round_text else {}
    seen = set()
    for f in data["files"]:
        late = [d for d in f.get("deps", []) if d not in seen]
        if late:
            sys.exit(f"{f['id']} lists deps {late} that come later in files[]; reorder files[] into review order")
        seen.add(f["id"])
    diff = parse_diff(diff_text)
    paths = {f["path"] for f in data["files"]}
    errs = [f"in the diff but not in files[]: {p}" for p in diff if p not in paths]
    errs += [f"in files[] but not in the diff: {p}" for p in paths if p not in diff]
    by_id = {f["id"]: f for f in data["files"]}
    for f in data["files"]:
        hunks = diff.get(f["path"], [])
        f["diff"] = hunks
        for h in hunks:
            for r in h["rows"]:
                if r[0] != "-" and r[3] in fresh.get(f["path"], ()):
                    r.append(1)  # changed in this round
        rows = [r for h in hunks for r in h["rows"]]
        f["add"] = sum(r[0] == "+" for r in rows)
        f["del"] = sum(r[0] == "-" for r in rows)
        new = {r[3] for r in rows if r[3] != ""}
        errs += [f"comment line not in the diff: {f['path']}:{c['line']}" for c in f.get("comments", []) if c["line"] not in new]
    for x in data.get("focus", []):
        f = by_id.get(x["file"])
        if not f:
            errs.append(f"focus names unknown file id {x['file']}")
        elif x["line"] not in {r[3] for h in f["diff"] for r in h["rows"]}:
            errs.append(f"focus line not in the diff: {f['path']}:{x['line']}")
    if errs:
        sys.exit("render.py: " + "\n  ".join(errs))
    payload = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    return assemble(payload)


def assemble(payload):
    """index.html with app.css, app.js and the data inlined, so one file works offline and when served."""
    page, css, js = ((assets / n).read_text() for n in ("index.html", "app.css", "app.js"))
    holes = ("__CSS__", "__JS__", "__DATA__")
    if any(page.count(h) != 1 for h in holes):
        sys.exit("render.py: index.html must contain each of " + ", ".join(holes) + " exactly once")
    for name, part, closer in (("app.css", css, "</style"), ("app.js", js, "</script")):
        if closer in part.lower() or any(h in part for h in holes):
            sys.exit(f"render.py: {name} must not contain {closer} or a placeholder")
    head, rest = page.split("__CSS__")
    mid, rest = rest.split("__JS__")
    pre, tail = mid.split("__DATA__")
    return head + css.rstrip("\n") + pre + payload + tail + js.rstrip("\n") + rest


def load(data_path, diff_path):
    return json.loads(pathlib.Path(data_path).read_text()), pathlib.Path(diff_path).read_text()


if __name__ == "__main__":
    a = sys.argv[1:]
    rnd = a[a.index("--round") + 1] if "--round" in a else None
    a = [x for i, x in enumerate(a) if x != "--round" and (i == 0 or a[i - 1] != "--round")]
    if len(a) != 3:
        sys.exit(__doc__)
    data, diff = load(a[0], a[1])
    pathlib.Path(a[2]).write_text(render(data, diff, pathlib.Path(rnd).read_text() if rnd else None))
    print(a[2])
