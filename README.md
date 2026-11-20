# Agent Skills

A collection of skills I use in my day-to-day work with coding agents.

## Skills

| Skill | What it does |
| --- | --- |
| [Assess PR review comments](skills/assess-pr-review-comments/README.md) | Checks review feedback against the code and PR intent, then fixes valid issues or drafts a reply. |
| [Change review walkthrough](skills/change-review-walkthrough/README.md) | Builds a local review page for a PR or uncommitted changes, with a suggested review order, inline draft findings, and a dependency map. |
| [Distribute a skill](skills/distribute-skill/SKILL.md) | Copies a complete skill into existing local agent skill directories. Asks before replacing a conflicting copy. |
| [Draft a Slack message](skills/draft-slack-message/SKILL.md) | Writes a short, plain-text message or thread reply using the context and links you provide or the agent can verify. |
| [Grill me interactively](skills/grill-me-interactive/SKILL.md) | Asks one question at a time to develop a shared understanding of an idea or work through a decision. |
| [Investigate CI failures](skills/investigate-ci-failures/SKILL.md) | Reads failing job logs, groups failures by cause, and determines whether to fix, recommend a rerun, or discuss the issue. |

## License

The skills are released under MIT. The interactive interview adapts Matt Pocock’s `grilling` workflow and includes his original notice. [Repository license](LICENSE) · [Upstream workflow](https://github.com/mattpocock/skills/blob/main/skills/productivity/grilling/SKILL.md) · [Upstream license notice](skills/grill-me-interactive/UPSTREAM-LICENSE)
