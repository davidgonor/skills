---
name: change-review-walkthrough
description: Turn a pull request, or local changes not yet committed, into one local review page - the full diff with Claude's code review drafted inline, a recommended review order and dependency map, the changes most worth the reviewer's time, existing threads, and the reviewer's own comments on line ranges or whole files. For a PR, Submit posts only what the reviewer approves. For local work, Submit hands the feedback back to Claude, who fixes and opens the next round or commits, pushes and opens a draft PR. Use when the user says "walk me through PR 123", "help me review this PR", "walk me over what you did before you commit", "review my changes" or "guide me on how to review". Makes no code edits while the user reviews.
---

# Change review walkthrough (review page)

The page template, styles, and browser code live in `assets/`. The helpers in `scripts/` render the page, serve it with saved state, snapshot local work, and test the rendered page. Generate `data.json` in a scratch directory outside the reviewed repo and use the packaged page assets as provided.

## Steps
1. **Source.** State it in one line.
   - PR: `gh pr view <n> --json title,url,author,headRefOid,baseRefName` and `gh pr diff <n> > change.diff`.
   - Local changes: `python3 <this dir>/scripts/rounds.py -C <repo> diff HEAD > change.diff` (includes untracked files, touches nothing), then `python3 <this dir>/scripts/rounds.py -C <repo> tree` and keep the id as `baseline`.
2. **Code review.** Run a code review of the same change (the code-review skill if available, at the effort the user asks for, else high). Each finding becomes exactly one draft comment, on the line the finding names; several may share a line. If that line is not a new-side line in the diff, attach the comment to the nearest new-side line in the same file and start its body with the line it is about (for example "Line 13:"). Add no findings of your own.
3. **data.json.** Order files by dependency (types first, then callers, then tests and generated files). Write 3 to 6 focus items, the changes most worth the reviewer's time, most important first. Draft a short review summary.
4. **Build and test.** `python3 <this dir>/scripts/render.py data.json change.diff page.html` (add `--round round.diff` in later rounds), then `node <this dir>/scripts/smoke.js page.html`. Fix `data.json` until both pass.
5. **Hand over.** Start the server in the background and give the user `http://127.0.0.1:8765/`. In chat say only the source, where to start and the URL.
   - PR: `python3 <this dir>/scripts/serve.py data.json change.diff` (`--dry-run` to rehearse). The reviewer posts from the page.
   - Local: `python3 <this dir>/scripts/serve.py data.json change.diff --local <repo>`. When the reviewer submits, the server writes `feedback.json` next to `data.json` and exits; continue with step 6 then.
6. **Local feedback.** Read `feedback.json` and act on `verdict`:
   - `QUESTIONS`: answer each comment, change no code, start the next round (step 7) so the answers show as threads.
   - `FIX`: apply the approved comments (`source` "you" first, then "claude"), then start the next round.
   - `APPROVE`: commit with a message drawn from the walkthrough summary, push (create a branch first if on the default branch), and open a draft PR, or a ready-for-review PR if `ready_for_review` is true. The page verdict is the user's go-ahead for these three steps; ask before anything else.
7. **Next round (local, or a PR re-review after new commits).** Diff of this round: local `python3 <this dir>/scripts/rounds.py -C <repo> diff <baseline> > round.diff`, PR `git diff <last reviewed head> <new head>`. Run the code review on that round diff only. Rebuild `data.json` for the full change (step 1 diff again), keep Claude's earlier drafts the user neither approved nor dismissed, add new findings, set `"round": {"label": "Round 2", "note": "what changed"}`, and put each earlier comment in `threads` with your answer as a reply. Render with `--round round.diff`, take a new `baseline`, and hand over again.
8. **Follow-ups.** Answer in chat and verify claims against the code before asserting them.

## data.json
```
{ "title": "short change title", "ref": "PR 482", "url": "https://github.com/org/repo/pull/482",   // url and ref only for a PR
  "mode": "pr",                          // "pr" or "local"; defaults to pr when url is a GitHub PR
  "source": "one line: what is reviewed and from where",
  "base": "main",
  "review": {"head": "<first 8 of the reviewed head sha>", "body": "draft review summary"},
  "round": {"label": "Round 2", "note": "what changed since round 1"},                     // later rounds only
  "threads": [{"id": "r1-3", "path": "x.go", "side": "RIGHT", "line": 72, "comments": [{"author": "you", "body": "..."}, {"author": "Claude", "body": "Fixed: ..."}]}],  // local rounds only; serve.py fetches a PR's threads
  "focus": [{"file": "f3", "line": 82, "lines": [82, 96], "title": "...", "why": "..."}],   // line must be a new-side diff line
  "groups": [{"id": "types", "name": "Types"}],
  "files": [{                                                                                // in review order; every diff file, no others
    "id": "f1", "path": "internal/x/retry.go", "group": "types",
    "deps": ["f0"], "generated": false,
    "what": "one sentence", "why": "one sentence",
    "added": ["behavior added"], "lost": ["behavior lost versus base"], "checks": ["what you verified"],
    "comments": [{"line": 72, "sev": "important", "title": "short label",
                  "body": "ready-to-post markdown: reviewer voice, one concern, a concrete ask or question"}]
  }] }
```
`sev` is one of important, question, suggestion, nit, optional. Line counts and hunks come from `change.diff`; do not write them.

## Rules
- Nothing reaches GitHub except what the reviewer submits from the page after its confirm. Claude's drafts start unapproved; the reviewer's own comments start approved.
- `serve.py` refuses to post if the PR head moved since the review; run the next round instead.
- Do not edit code, commit, push or open a PR while the reviewer is reviewing; for local work, only after the `feedback.json` verdict says so.
- Keep chat answers short; follow the reviewer's pace if they want one file or comment at a time.
