# Assess PR Review Comments

Use this skill to evaluate a pasted review comment or the unresolved threads on a pull request. It checks each thread against the current code, the PR’s stated scope, and relevant tests. It fixes valid issues and drafts evidence-based replies for false positives, out-of-scope requests, and fixes that differ from the reviewer’s suggestion.

[Read the skill instructions](SKILL.md)

## Demo

In this fictional PR, orders at exactly $50.00 were still charged for shipping. The assessment shows the inclusive threshold fix and its regression test. The other threads show an editable reply backed by the $49.99 test and a reply to an out-of-scope request for zone pricing.

![Review assessment showing the fixed shipping threshold and its regression test](../../docs/demo/assess-pr-review-comments/threshold-fix.png)

![Editable reply to a false-positive comment, backed by the $49.99 boundary test](../../docs/demo/assess-pr-review-comments/false-positive-reply.png)

![Draft reply explaining why zone pricing is outside the PR scope, with the reviewer’s follow-up](../../docs/demo/assess-pr-review-comments/out-of-scope-reply.png)
