---
name: change-review-walkthrough
description: Build an interactive review walkthrough for a pull request or uncommitted changes.
---

# Change review walkthrough

1. **Capture the change.** Keep the diff, page data, and server state in scratch space outside the reviewed repo. Save the diff as `change.diff`. If it is empty, report that and stop.
   - **PR:** Use `gh pr view` for the PR metadata and head SHA, and `gh pr diff` for the diff. Recheck the head after fetching the diff and recapture both if it moved.
   - **Local:** Save a tree ID with [`rounds.py tree`](scripts/rounds.py), then diff `HEAD` against that tree with `git diff --no-color --no-ext-diff HEAD <snapshot>`. Use the same snapshot ID as the baseline for the next round.
2. **Review the captured diff.** Use `code-review` when available, at the effort requested or high by default. Give each finding one inline draft on a new-side diff line. For an off-diff location, anchor to the nearest new-side line in that file and lead with the actual line number. If the file has no new-side diff line, include the finding and its location in the summary.
3. **Build and check the page.** Follow the [page data reference](references/page-data.md) to write `data.json`. Render with [`render.py`](scripts/render.py) and check the page with [`smoke.js`](scripts/smoke.js). The reference covers the saved-draft smoke-test exception.
4. **Hand over the page.** Start [`serve.py`](scripts/serve.py) in the background with the mode for the review. Use a free port and verify the URL serves this walkthrough. Share the source, where to start, and the URL.
   - **PR:** The reviewer confirms selected actions from the page. Use dry-run mode for rehearsals. The server checks the PR head at startup. If you learn that the head has changed while the page is open, rebuild the walkthrough before asking the reviewer to submit.
   - **Local:** Keep the working tree read-only during review and wait for the submitted verdict in `feedback.json`.

Follow [review rounds](references/review-rounds.md) when local feedback arrives or the PR needs review against a new head.
