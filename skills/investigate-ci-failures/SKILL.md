---
name: investigate-ci-failures
description: Investigate CI failures when the user asks why a job failed or wants help fixing failing checks on a PR or branch.
---

# Investigate CI failures

1. **Read the failures.** Use the supplied job or workflow link, or list checks for the PR with `gh pr checks`. For a branch without a PR, find the CI runs for its head commit. Identify the provider from the check links. Read the failed step in CircleCI's job logs, with `gh run view <run-id> --log-failed` for GitHub Actions, or in the linked provider's logs. If the output is inaccessible, ask for the relevant excerpt. Account for each failed check and group checks that share a cause. Report pending checks separately.
2. **Classify each cause.** Trace the failing step to the PR diff, base branch changes, or runner conditions. Use prior runs where they can distinguish a regression from a flake.

   | Classification | Evidence | Action |
   | --- | --- | --- |
   | Obvious fix | A clear cause and a small, unambiguous correction within scope | Follow repository conventions, make the fix locally, and run the relevant check locally when practical. Leave the fix uncommitted. |
   | Flake | Evidence of nondeterminism or a transient runner failure unrelated to the change | Give the workflow link and the failed-job rerun action. Use **Rerun workflow from failed** in CircleCI or `gh run rerun <run-id> --failed` in GitHub Actions. Leave the rerun to the user. If the same failure recurs, investigate it as a real failure. |
   | Needs discussion | A material regression, a risky or out-of-scope fix, a design decision, or insufficient evidence to establish the cause | Explain the evidence and options before changing code for this cause. |

3. **Report.** Lead with the diagnosis. List the checks under each cause, the evidence behind it, any local fix and its verification result, and the next action for unresolved checks.
