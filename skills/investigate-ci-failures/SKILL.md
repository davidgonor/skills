---
name: investigate-ci-failures
description: Diagnose or fix failing CI jobs on a PR or branch.
---

# Investigate CI failures

1. **Read the failing steps.** Start from the supplied job or workflow link, the PR checks, or the branch head's CI runs. Open the linked provider's job logs. Ask for the relevant excerpt if you cannot read a failure's output. Account for every failed job and set pending jobs aside.
2. **Triage by cause.** Group jobs with the same failure. Trace each cause to the change, the base branch, or runner conditions where the evidence permits. Check prior runs when they can distinguish a regression from a flake. Apply the matching action within the user's requested scope.

   | Classification | Evidence | Action |
   | --- | --- | --- |
   | Obvious fix | A clear cause and a small, unambiguous correction within scope | Follow repository conventions, make the fix locally, and run the relevant check locally when practical. Leave the fix uncommitted. |
   | Flake | Evidence of nondeterminism or a transient runner failure unrelated to the change | Give the workflow link and the failed-job rerun action. Use **Rerun workflow from failed** in CircleCI or `gh run rerun <run-id> --failed` in GitHub Actions. Leave the rerun to the user. If the same failure recurs, investigate it as a real failure. |
   | Needs discussion | A material regression, a risky or out-of-scope fix, a design decision, or insufficient evidence to establish the cause | Explain the evidence and options before changing code for this cause. |

3. **Report.** Lead with the diagnosis. List the affected jobs and evidence for each cause, any local fix and its verification result, and the next action for unresolved failures. Report pending jobs separately.
