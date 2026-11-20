#!/usr/bin/env python3
"""Inspect and copy a complete skill into existing local agent skill roots."""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path


SKILL_ROOTS = (
    ".codex/skills",
    ".claude/skills",
    ".cursor/skills",
    ".agents/skills",
    ".gemini/skills",
    ".continue/skills",
    ".windsurf/skills",
    ".opencode/skills",
)


def source_skill(value: str) -> Path:
    source = Path(value).expanduser().resolve()
    if source.is_file() and source.name == "SKILL.md":
        source = source.parent
    if not source.is_dir() or not (source / "SKILL.md").is_file():
        raise ValueError(f"Source must be a skill directory or SKILL.md path: {source}")
    return source


def targets(source: Path) -> list[dict[str, str]]:
    home = Path.home()
    result = []
    for relative_root in SKILL_ROOTS:
        root = home / relative_root
        if not root.is_dir():
            continue
        destination = root / source.name
        resolved_destination = destination.resolve()
        result.append(
            {
                "root": str(root),
                "destination": str(destination),
                "source_skill_md": str(source / "SKILL.md"),
                "destination_skill_md": str(destination / "SKILL.md"),
                "status": (
                    "source"
                    if resolved_destination == source
                    else "conflict"
                    if destination.exists()
                    else "missing"
                ),
            }
        )
    return result


def copy(source: Path, destination: Path, replace: bool) -> None:
    if destination.exists():
        if not replace:
            raise ValueError(f"Destination already exists: {destination}")
        shutil.rmtree(destination)
    shutil.copytree(source, destination)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("source")
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument("--inspect", action="store_true")
    action.add_argument("--copy", metavar="DESTINATION")
    action.add_argument("--replace", metavar="DESTINATION")
    args = parser.parse_args()

    try:
        source = source_skill(args.source)
        entries = targets(source)
        if args.inspect:
            print(json.dumps({"source": str(source), "targets": entries}, indent=2))
            return 0

        requested = Path(args.copy or args.replace).expanduser().resolve()
        allowed = {Path(entry["destination"]).resolve() for entry in entries}
        if requested not in allowed:
            raise ValueError("Destination is not an existing supported agent skill directory")
        replace = args.replace is not None
        copy(source, requested, replace)
        print(json.dumps({"source": str(source), "destination": str(requested), "action": "replaced" if replace else "copied"}))
        return 0
    except ValueError as error:
        print(json.dumps({"error": str(error)}), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
