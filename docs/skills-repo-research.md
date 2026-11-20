# How Matt Pocock manages and distributes agent skills

Reviewed November 20, 2026. The reference is the public [mattpocock/skills repository](https://github.com/mattpocock/skills).

## Repository management

- **One source for each skill.** Skill folders live under `skills/`. The maintained catalog is split into `engineering/` and `productivity/`. The repo also keeps `misc/`, `in-progress/`, and `deprecated/`. The promoted skills are listed in the root README and explicitly included in the plugin manifest. The README distinguishes between skills invoked by the user and skills the agent can pick up on its own. [Maintainer instructions](https://github.com/mattpocock/skills/blob/main/CLAUDE.md), [plugin manifest](https://github.com/mattpocock/skills/blob/main/.claude-plugin/plugin.json)
- **Local symlinks for development.** The maintainer script links individual skill folders into `~/.claude/skills` and `~/.agents/skills`. A pull updates the contents the links resolve to. The instructions call for relinking when a skill is added, removed, or renamed. The script is explicitly intended for maintainers. [Linking script](https://github.com/mattpocock/skills/blob/main/scripts/link-skills.sh), [maintainer instructions](https://github.com/mattpocock/skills/blob/main/CLAUDE.md)
- **Versioned updates.** The project is MIT licensed. A Changesets workflow on `main` opens a version PR and creates Git tags. The version script synchronizes the plugin version with the package version, and the project ships a changelog. The package is marked private. Its npm setup supports release tooling. [License](https://github.com/mattpocock/skills/blob/main/LICENSE), [release workflow](https://github.com/mattpocock/skills/blob/main/.github/workflows/release.yml), [package scripts](https://github.com/mattpocock/skills/blob/main/package.json), [changelog](https://github.com/mattpocock/skills/blob/main/CHANGELOG.md)

## Public installation

| Route | What readers get |
| --- | --- |
| Vercel skills CLI | `npx skills@latest add mattpocock/skills` lets users select skills and agents. Installed files are editable. Use `npx skills@latest update` to get updates and rerun `add` to select newly published skills. |
| Claude Code | `claude plugin install mattpocock-skills@claude-plugins-official` installs the promoted bundle with automatic updates. |
| Codex and GitHub Copilot | Add the repository's marketplace and install the bundle. The README documents the update behavior and Copilot configuration. |
| Gemini CLI | Install the engineering and productivity paths from GitHub, then rerun those commands to update. |

The installation guide recommends choosing one route per agent to avoid duplicate skills. It also has a first-run setup skill for repo-specific choices such as issue tracking, labels, and documentation paths. [Installation guide](https://github.com/mattpocock/skills#installation-30-second-setup), [marketplace manifest](https://github.com/mattpocock/skills/blob/main/.claude-plugin/marketplace.json)

Vercel's CLI also searches the `skills/` tree, so treat the plugin manifest as the plugin's inventory. Check the CLI's available list separately and use `--skill` to select specific skills. [Installer discovery rules](https://github.com/vercel-labs/skills/blob/main/docs/creating-skills.md), [Vercel CLI reference](https://github.com/vercel-labs/skills/blob/main/docs/commands.md#skills-add)

## Examples and screenshots

- The GitHub README leads with engineering problems and shows how the skills help. Its simplest example gives before-and-after wording for the same problem and links to an actual project glossary. [README example](https://github.com/mattpocock/skills#2-the-agent-is-way-too-verbose), [sample glossary](https://github.com/mattpocock/course-video-manager/blob/076a5a7a182db0fe1e62971dd7a68bcadf010f1c/CONTEXT.md)
- Each promoted skill has a human-facing guide, published on AI Hero, alongside its agent-facing instructions. The guides explain when to use a skill, prerequisites if relevant, common questions, and what a good run looks like. The architecture review guide installs three companion skills in the same command because the main skill calls them. [Documentation conventions](https://github.com/mattpocock/skills/blob/main/.agents/writing-docs.md), [architecture review guide](https://www.aihero.dev/skills-improve-codebase-architecture)
- I found no screenshot or demo gallery in the README and no image or video files with common media extensions in the checked Git tree. There is a written example task set for an in-progress skill. AI Hero also has a 69-minute walkthrough showing the skills applied to a real feature, from requirements through reviewing a 21,000-line PR. [Checked Git tree](https://api.github.com/repos/mattpocock/skills/git/trees/abeeaf95660ba9e8b7c753eb38f441ca707a8823?recursive=1), [written example tasks](https://github.com/mattpocock/skills/blob/main/skills/in-progress/software-factory/EXAMPLE-TASKS.md), [video walkthrough](https://www.aihero.dev/watch-me-ship-a-21-000-line-feature-with-mattpocock-skills~ez95n)

## Recommended first release for this repo

1. Keep each `SKILL.md` and its supporting files together under `skills/<name>/`. Local symlinks in Claude Code, Codex, Cursor, and `~/.agents/skills` point to those six folders. [Agent Skills specification](https://agentskills.io/specification), [installer discovery rules](https://github.com/vercel-labs/skills/blob/main/docs/creating-skills.md)
2. Give the root README a one-command install, a six-skill index, and one sample prompt and expected result per skill. For a repo published as `davidgonor/skills`, the command would be `npx skills@latest add davidgonor/skills`. List available skills with `npx skills@latest add davidgonor/skills --list`, then test a standard project install from a clean directory in the agents you claim to support. Add a plugin later if managed updates justify maintaining another installation route. [Vercel CLI reference](https://github.com/vercel-labs/skills/blob/main/docs/commands.md#skills-add)
3. Verify dependencies from a clean install. `grill-me-interactive` can use Pocock's installed `grilling` skill and includes a built-in fallback. Document Git, Python, Node, and the authenticated GitHub CLI where required by `change-review-walkthrough`. List the tools and access needed by `draft-slack-message`, including what users can paste when a connector is unavailable. [Interactive interview](../skills/grill-me-interactive/SKILL.md), [review walkthrough](../skills/change-review-walkthrough/SKILL.md), [Slack drafts](../skills/draft-slack-message/SKILL.md)
4. Show the HTML review page with a screenshot from the fictional PR demo. Explain what Submit can post and what approving a local review can commit or push. An example from `assess-pr-review-comments` can cover both its HTML view and Markdown fallback. Text examples should suffice for skills without a visual output. [Review walkthrough demo](demo/), [review comment assessment](../skills/assess-pr-review-comments/SKILL.md)
5. The repository uses MIT. Before publishing, ignore `.DS_Store` throughout the repo. A simple release tag and changelog entry can establish the first public version. Add Changesets if release frequency warrants automation. [Repository license](../LICENSE)

## License and attribution audit

David Gonoradsky confirmed that he wrote all six skills. Commit `6242f10` in his `davidgonor/local-setup` checkout records an earlier import from his Claude Code skill directory.

| Skill | Evidence |
| --- | --- |
| `assess-pr-review-comments` | Author confirmed. The HTML preview references the two fonts listed below. |
| `change-review-walkthrough` | Author confirmed. The HTML review page references the two fonts listed below. |
| `distribute-skill` | Author confirmed. |
| `draft-slack-message` | Author confirmed. |
| `grill-me-interactive` | Author confirmed. The built-in fallback credits Matt Pocock's `grilling` skill and includes his upstream MIT notice. |
| `investigate-ci-failures` | Author confirmed. |

The two HTML previews reference Familjen Grotesk and JetBrains Mono through Google Fonts. Both fonts are licensed under SIL Open Font License 1.1. The skill folders contain no font files. [Familjen Grotesk license](https://github.com/google/fonts/blob/main/ofl/familjengrotesk/OFL.txt), [JetBrains Mono license](https://github.com/google/fonts/blob/main/ofl/jetbrainsmono/OFL.txt)

The repository uses MIT. Each skill includes the license so it travels with per-skill installs. Matt Pocock's original MIT notice also travels with the adapted skill. [Repository license](../LICENSE), [included upstream notice](../skills/grill-me-interactive/UPSTREAM-LICENSE)
