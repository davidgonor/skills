#!/usr/bin/env python3
"""Usage: rounds.py -C <repo> tree
       rounds.py -C <repo> diff <from>
Snapshots for reviewing local work in rounds. Neither command touches the working tree, the index
or any ref: they stage into a throwaway index file.
  tree         print a tree id for the working tree as it is now, untracked files included
               (ignored files excluded). Save it as the next round's baseline.
  diff <from>  print the unified diff from <from> (HEAD, a commit or a saved tree id) to the
               working tree as it is now, untracked files included. With <from> = HEAD this is the
               whole uncommitted change; with a saved tree id it is what changed in this round."""
import os, subprocess, sys, tempfile


def git(repo, *a, env=None):
    r = subprocess.run(["git", "-C", repo, *a], capture_output=True, text=True, env=env)
    if r.returncode:
        sys.exit(f"git {' '.join(a)} failed: {r.stderr.strip()}")
    return r.stdout


def worktree_tree(repo):
    fd, idx = tempfile.mkstemp(prefix="rounds-index-")
    os.close(fd)
    os.unlink(idx)  # git creates it; an empty existing file would be read as a corrupt index
    env = {**os.environ, "GIT_INDEX_FILE": idx}
    try:
        has_head = subprocess.run(["git", "-C", repo, "rev-parse", "--verify", "-q", "HEAD"], capture_output=True).returncode == 0
        git(repo, "read-tree", *(["HEAD"] if has_head else ["--empty"]), env=env)
        git(repo, "add", "-A", env=env)
        return git(repo, "write-tree", env=env).strip()
    finally:
        if os.path.exists(idx):
            os.unlink(idx)


def main(argv):
    if len(argv) < 3 or argv[0] != "-C":
        sys.exit(__doc__)
    repo, cmd = argv[1], argv[2]
    if cmd == "tree":
        print(worktree_tree(repo))
    elif cmd == "diff" and len(argv) == 4:
        sys.stdout.write(git(repo, "diff", "--no-color", "--no-ext-diff", argv[3], worktree_tree(repo)))
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
