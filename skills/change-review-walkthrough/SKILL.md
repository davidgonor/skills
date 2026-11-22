---
name: change-review-walkthrough
description: Walk through a pull request or uncommitted changes when the user wants a review page or guidance on what to review first.
---

# Change review walkthrough

1. **Capture the change.** Use a scratch directory outside the reviewed repo for the diff, page data, and server state. If the diff is empty, report that directly.
   - **PR:** Fetch the title, URL, author, head SHA, and base with `gh pr view <pr> --json title,url,author,headRefOid,baseRefName`. Save `gh pr diff <pr>` as `change.diff`. Verify that the PR head still matches the captured SHA after fetching the diff.
   - **Local:** Save a snapshot ID with `python3 <skill-dir>/scripts/rounds.py -C <repo> tree`. Run `git -C <repo> diff --no-color --no-ext-diff HEAD <snapshot>` and save it as `change.diff`. The snapshot includes untracked, non-ignored files and leaves the worktree and index intact.
2. **Review the captured diff.** Use the `code-review` skill when available, at the effort the user requested or high by default. Turn each finding into one inline draft. If its line is outside the new side of the diff, use the nearest new-side line in the same file and start the draft with the actual line number. If there is no such line, put the finding and its location in the review summary.
3. **Build and check the page.** Use the [page data reference](references/page-data.md) to build `data.json`. Include every diff file once in dependency order, three to six focus items where the change supports them, and a short review summary. Run `python3 <skill-dir>/scripts/render.py data.json change.diff page.html` and `node <skill-dir>/scripts/smoke.js page.html`. Use the packaged assets and consult the reference if the smoke test flags a saved draft.
4. **Hand over the page.** Start `python3 <skill-dir>/scripts/serve.py data.json change.diff` in the background and verify it is serving the current walkthrough. Add `--local <repo>` for local changes or `--dry-run` for a PR rehearsal. Share the source, where to start, and the URL printed by the server. Answer follow-up questions against the reviewed code.
   - **PR:** The reviewer submits from the page and confirms the selected review actions there. Agent drafts start unapproved and the reviewer's own comments start approved. If the server rejects a stale head or the user requests a re-review after new commits, use [review rounds](references/review-rounds.md).
   - **Local:** Keep the working tree read-only during review. When the page writes `feedback.json`, use [review rounds](references/review-rounds.md) to act on the verdict.
