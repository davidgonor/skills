---
name: distribute-skill
description: Distribute an existing local skill to the skill directories of agents already installed on this machine.
---

# Distribute a skill

1. **Inspect.** Run `python3 scripts/distribute_skill.py <source> --inspect` from this skill's directory. The source can be a skill directory or its `SKILL.md`. Use the JSON target list as the scope. If inspection fails, report the error before copying anything.
2. **Copy.** For each `missing` target, run the script with `<source> --copy <destination>`. This copies the entire skill directory into an existing agent skill root. A `source` target is already in place.
3. **Resolve conflicts.** Show both absolute `SKILL.md` paths and offer to compare, skip, or replace each conflicting copy. If the user chooses compare, show the relevant differences and ask what to do with that target. Run `<source> --replace <destination>` only after the user explicitly approves replacement of that copy.
4. **Report.** Account for every inspected target using the script results. List copies and replacements separately from targets already in place, skipped, pending a decision, or failed.
