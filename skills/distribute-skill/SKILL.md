---
name: distribute-skill
description: Distribute an existing local skill to the skill directories of agents already installed on this machine.
---

# Distribute a skill

1. **Inspect.** Run [the distribution helper](scripts/distribute_skill.py) with `<source> --inspect`. The source can be a skill directory or its `SKILL.md`. Use the JSON target list as the scope. If inspection fails, report the error and stop. Group destinations by resolved path so symlinked roots share one copy or replacement decision.
2. **Distribute.** Copy each distinct `missing` destination with `--copy`. Treat `source` as already in place. For each `conflict`, show both absolute `SKILL.md` paths and offer to compare, skip, or replace. If asked to compare, show the relevant differences and wait for the user's choice. Use `--replace` only for a destination the user explicitly approves.
3. **Report.** Give every listed target an outcome based on the helper results. Show aliases together with the destination they share.
