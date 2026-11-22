---
name: assess-pr-review-comments
description: Assess PR review feedback on a specific comment or a PR's unresolved threads.
---

# Assess PR review comments

1. **Select the threads.** For a pasted or linked comment, read that comment and its available replies. For a PR-wide assessment, use the specified PR or the current branch's PR, then read every unresolved, current review thread and its replies. Include resolved or outdated threads on request. Ask for the PR if it is needed and cannot be identified.
2. **Assess and act.** Give each thread a verdict grounded in the current code, tests, contracts, or the PR's stated scope. Flag material uncertainty and apply the action below within the user's requested scope.

   | Verdict | Evidence | Action |
   | --- | --- | --- |
   | Valid | A defect or material gap in the PR's behavior, requirements, security, or maintainability | Make the smallest in-scope local fix and add a test when it would catch a meaningful regression. Draft a reply if the fix differs from the suggestion or addresses only part of it. |
   | False positive | The concern depends on a mistaken reading of the code or behavior | Explain the evidence in a short reply draft. |
   | Out of scope | The observation may be correct, but it does not need to be addressed for this PR | Explain the scope decision in a short reply draft. |

3. **Report.** Give totals for threads assessed, fixed, reply only, and no action. Number each thread and include its location, a short quote, the verdict and evidence, the fix if any, and the reply draft or “none needed.” Note any uncommitted fixes and unposted drafts. If no threads qualify, report that directly. Otherwise, fill the [HTML template's `DATA` block](assets/preview-template.html) when the host supports inline rendering and every draft has a verified posting target. Use a Markdown table otherwise.

## Reply on request

Keep fixes local and replies in draft until the user authorizes a specific remote action. A request from the template's Reply control authorizes posting that edited draft only. Verify the repository, PR, and numeric review-comment ID before posting, then return the posted reply link. Pass multiline text verbatim, for example from a file with `gh api repos/<owner>/<repo>/pulls/<pr>/comments/<id>/replies -F body=@<draft-file>`.
