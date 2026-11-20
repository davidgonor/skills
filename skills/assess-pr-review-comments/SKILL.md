---
name: assess-pr-review-comments
description: Assess pull-request review comments for correctness and relevance, then fix valid ones or draft a concise evidence-based reply. Works on a pasted comment, or with no input, on the open comments of the current branch's PR.
---

# Assess PR Review Comments

Use this skill when the user wants help deciding whether PR review comments should be addressed. The input may be a pasted comment, a comment link, or nothing.

## Input

- **Pasted comment or link:** assess that one comment.
- **Nothing given:** find the PR for the current branch (or use the PR number or URL if given), fetch its unresolved review threads, and assess each one. Include the follow-up replies in a thread. Skip resolved and outdated threads unless asked.
- **No PR found:** ask which PR to use.

Review the comment against the current code, the PR's stated intent, relevant tests, and repository conventions. Do not treat a reviewer's confidence or identity as evidence that the comment is correct.

Classify the comment as one of:

- **Valid:** It identifies a real defect, regression, requirement gap, security concern, or maintainability issue that is material in this PR.
- **False positive:** The concern rests on an incorrect reading of the code, behavior, or surrounding context.
- **Irrelevant / out of scope:** The observation may be true, but it is not required by this PR and does not block the proposed change. Distinguish this from a valid issue that should be fixed now.

Explain the conclusion with concrete repository evidence: identify the relevant code path, test, contract, or documented convention. State any assumptions or uncertainty plainly. Do not invent product intent or claim behavior that the code does not establish.

For a valid comment:

1. Explain why the issue is valid and its likely impact.
2. Make the smallest appropriate fix within the PR's scope, including tests when they would meaningfully prevent regression.
3. Summarize the change.
4. Draft a concise reply for the review thread only if the comment was not fully accepted: for example the fix differs from what the reviewer suggested, only part of it was applied, or part of it was declined. If the comment is 100% valid and fixed exactly as the reviewer expected, skip the reply and say so.

For a false-positive or irrelevant comment:

1. Explain why it does not require a change, grounded in the code or PR scope.
2. Provide a short, professional reply suitable for the review thread.
3. Do not modify the code solely to accommodate the comment.

## Summary

Always end with a summary of every assessed comment. When the environment can render inline HTML, build it from [preview-template.html](assets/preview-template.html): fill its `DATA` block (also `title`, a one-line `source`, `repo` as owner/name and `pr` number) and render it as is (numbered index on the left, one thread at a time on the right, editable reply drafts, working Copy and Reply buttons, prev/next and arrow keys; set each thread's `target` to its comment id or URL). The Reply button sends the reply text to the chat via `sendPrompt`, and that click is the user's explicit request to post it: post it on that thread then with `gh api repos/<repo>/pulls/<pr>/comments/<id>/replies -f body=...` (use `-F body=@file` for multi-line text), and confirm with the link. Otherwise use a Markdown table. Show:

- the totals: comments assessed, fixed, replied without a change, no action;
- one numbered entry per thread (1, 2, 3, ...), grouping a comment with its follow-ups, so the user can refer to entries by number in follow-up messages: file and line, the reviewer's words (short quote), verdict, decision with its evidence in a sentence, the fix (if any), and the reply ready to copy (or "none needed");
- what is not done yet: fixes not committed, replies not posted.

Never post replies, resolve review threads, push commits, or change the PR remotely unless the user explicitly asks.
