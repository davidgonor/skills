---
name: investigate-ci-failures
description: Investigate failing CI checks on a pull request or branch in any repo, then decide between an obvious fix, a flaky rerun, or a serious issue to discuss. Use whenever the user says "investigate CI", "CI is failing", "why did the build/check/job fail", "fix CI", or pastes a failing check or workflow link, even without naming the CI system. Mostly CircleCI, sometimes GitHub Actions.
---

# Investigate CI Failures

Find why checks fail, then act on one of three outcomes. Investigate first: the cause decides the action, and a wrong guess wastes a CI cycle.

## 1. Find the failures

- List the checks for the PR or branch (`gh pr checks`). The check names and links show the CI system: `ci/circleci:` means CircleCI, otherwise GitHub Actions.
- Read the real failure output, not just the check name. Use the CircleCI failure report or CLI when available, or `gh run view --log-failed` for GitHub Actions. If neither works, ask the user for the workflow link or log.
- Group failures by cause. Several red jobs often share one root cause (for example a migration error failing both tests and a linear-chain check). Jobs still pending are unknown, so say so.

## 2. Classify

- **Obvious fix:** one clear cause that the diff or a recent change on the base branch explains, with a small and unambiguous correction (lint, generated files, a stale head after main moved, a missing import, a test the change broke).
- **Flake:** failure is unrelated to the diff and looks nondeterministic: no changed files overlap, racy ports or timing, network or runner errors, a test that passed on other recent runs. Back it with evidence, such as the diff not touching the code and the same test passing on main.
- **Serious:** a real regression, data or migration risk, security finding, a failure that needs a design decision, or a cause you cannot establish. Also use this when a fix would reach beyond the PR's scope.

When unsure between flake and real, treat it as real until evidence says otherwise.

## 3. Act

- **Obvious fix:** check the repo's guidelines or git history for the preferred way (for example CLAUDE.md or AGENTS.md), make the fix locally, run the relevant check locally if cheap, and explain cause and change. Do not commit or push; the user does that.
- **Flake:** do not rerun it yourself. Give the workflow link and the exact step: "Rerun workflow from failed" in CircleCI, or `gh run rerun <id> --failed` for GitHub Actions. Rerun only the failed jobs. If the same job fails again after a rerun, reclassify as real.
- **Serious:** make no changes. Present the evidence and options, and discuss with the user before doing anything.

## Report

Lead with the outcome, in plain terms, such as "One check failed, a flake the PR does not touch. Nothing changed."

Then include:
- the failing checks and the grouped cause
- the evidence for the classification
- what you changed (or "nothing"), and the next step for the user

Keep it short. Say what you did not verify.
