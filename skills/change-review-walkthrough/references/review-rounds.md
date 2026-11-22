# Walkthrough review rounds

## Local verdict

The local server writes `feedback.json` alongside `data.json` and exits when the reviewer submits. Wait for that file and read the verdict, line comments, file comments, and replies.

| Verdict | Action |
| --- | --- |
| `QUESTIONS` | Answer every comment against the current code. Keep the code as reviewed and show the answers as threads in the next round. |
| `FIX` | Address the approved feedback, starting with the reviewer's own comments and then approved agent drafts. Run the relevant checks and describe the outcome of each comment in the next round. |
| `APPROVE` | The verdict authorizes committing the reviewed changes, pushing, and opening a PR, subject to any limits the user set in chat. Use the walkthrough summary for the commit message. Create a branch first if on the default branch. Open a draft PR unless `ready_for_review` is true. Report the result and PR link. |

## Build the next round

1. Capture the new source using the [initial workflow](../SKILL.md). Save the complete diff as `change.diff` and the changes since the last reviewed snapshot as `round.diff`. Locally, diff the previous snapshot tree against the new one. For a PR, diff the last reviewed head against the new head.
2. Review `round.diff`. Rebuild the page data for the full change. Keep earlier drafts that the reviewer neither approved nor dismissed, updating their anchors to the new diff, and add the new findings. For local rounds, carry forward the previous comments with their answers as threads. Set the round label and note using the [page data reference](page-data.md).
3. Render and smoke-test the page. Pass `--round round.diff` to both `render.py` and `serve.py`. Use fresh server state for the round so prior feedback cannot be mistaken for a new submission. Record the new snapshot or head for the next round and hand over the verified URL.
