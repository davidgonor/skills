---
name: assess-pr-review-comments
description: Assess PR review feedback when the user asks whether a comment is valid, how to reply, or which unresolved threads to address.
---

# Assess PR review comments

1. **Select the threads.** A pasted comment or comment link scopes the assessment to that comment and any available replies. Otherwise, use the specified PR or find the PR for the current branch. Read every unresolved, current review thread and its replies. Include resolved or outdated threads only when requested. If the PR cannot be identified, ask for it.
2. **Verify each concern.** Check the current code, the PR's stated intent, relevant tests, and repository conventions. Give every thread a verdict backed by a concrete code path, test, contract, or convention. State any material uncertainty.

   | Verdict | Evidence | Action |
   | --- | --- | --- |
   | Valid | A defect or material gap in the PR's behavior, requirements, security, or maintainability | Make the smallest in-scope local fix and add a test when it would catch a meaningful regression. Draft a reply if the fix differs from the suggestion or addresses only part of it. |
   | False positive | The concern depends on a mistaken reading of the code or behavior | Explain the evidence in a short reply draft. |
   | Out of scope | The observation may be correct, but it does not need to be addressed for this PR | Explain the scope decision in a short reply draft. |

3. **Report.** Give totals for threads assessed, fixed, reply only, and no action. Include one numbered entry per thread with its location, a short quote, the verdict and supporting evidence, the fix if any, and the reply draft or “none needed.” State which changes are uncommitted and which replies are drafts. If no threads qualify, report that directly.

## Report format and reply approval

Use the [HTML template](assets/preview-template.html) when the host can render it inline and there is at least one entry. Populate its `DATA` block with the title, source, repository, PR number, totals, pending work, and thread entries. Use the comment ID or URL as each thread's `target`. Keep the template's editable drafts, navigation, and Copy and Reply controls. Use a Markdown table if inline rendering is unavailable or a draft has no verified posting target.

Keep fixes local and replies in draft until the user asks for a specific remote action. The template's Reply control requests posting the edited draft on the identified thread. Verify the repository, PR, and numeric review-comment ID, then post the exact text and return the posted reply link. With GitHub CLI, use `gh api repos/<owner>/<repo>/pulls/<pr>/comments/<id>/replies -F body=@<draft-file>` with the draft in a file.
