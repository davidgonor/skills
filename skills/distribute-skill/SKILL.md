---
name: distribute-skill
description: Copy an existing skill to the installed agent skill directories on a machine, without creating missing directories or overwriting a conflicting skill without approval.
---

# Distribute Skill

Given a source skill directory or its `SKILL.md` path, distribute it to the known agent skill directories that already exist. Normalize a `SKILL.md` input to its parent directory. Otherwise, the source must be a directory containing `SKILL.md`; stop and report the problem when it is not.

Run `scripts/distribute_skill.py <source> --inspect` first. It reports all existing target directories and whether a same-named skill already exists in each. Never create a missing agent directory.

Copy every target reported as `missing` with `--copy`. A target reported as `source` is already the source location and needs no action. Do not overwrite a target reported as `conflict`.

For each conflict, use the environment's interactive questioning tool to ask the user whether to:

- replace the target with the source skill;
- cancel distribution to that target; or
- compare the two skills.

Include both absolute paths in the question: the source `SKILL.md` and the target `SKILL.md`. If the user chooses compare, provide those paths and wait for their next choice; do not infer that reviewing means approval to replace. Only run `--replace` for a target after the user explicitly chooses replacement.

Use the script's JSON output to report copied, replaced, skipped, and absent target directories. The script copies the complete skill directory, including any scripts, references, assets, and UI metadata.
