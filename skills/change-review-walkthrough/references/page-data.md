# Walkthrough page data

Write `data.json` as JSON. This example is for a PR. For local changes, set `mode` to `local` and omit `ref`, `url`, and `review.head`.

```json
{
  "title": "Retry transient export errors",
  "mode": "pr",
  "ref": "PR 482",
  "url": "https://github.com/org/repo/pull/482",
  "source": "PR 482 against main",
  "base": "main",
  "review": {
    "head": "b42a17cd",
    "body": "Draft review summary"
  },
  "focus": [
    {
      "file": "f1",
      "line": 72,
      "lines": [72, 76],
      "title": "Retry limit",
      "why": "The limit determines when an export returns an error."
    }
  ],
  "groups": [
    { "id": "export", "name": "Export" }
  ],
  "files": [
    {
      "id": "f1",
      "path": "internal/export/retry.go",
      "group": "export",
      "deps": [],
      "generated": false,
      "what": "Adds retry handling to the export.",
      "why": "Transient errors can succeed on a subsequent attempt.",
      "added": ["Retries transient export errors."],
      "lost": [],
      "checks": ["Verified the retry limit for transient errors."],
      "comments": [
        {
          "line": 72,
          "sev": "important",
          "title": "Permanent errors",
          "body": "Can we add a case that verifies permanent errors return immediately?"
        }
      ]
    }
  ]
}
```

- Set `review.head` to at least the first eight characters of the reviewed PR head SHA.
- Give each file a unique ID. List dependencies by ID and place each dependency before its callers. Prefer types, then callers, then tests and generated files where dependencies permit.
- List focus items in descending importance. Reference file IDs and use a new-side diff line for each anchor and any highlighted lines.
- Use a new-side diff line for each inline draft. Write ready-to-post Markdown with a single concern and a concrete ask or question. `sev` accepts `important`, `question`, `suggestion`, `nit`, or `optional`.
- The renderer derives hunks and line counts from `change.diff`.

If every file has a draft, `smoke.js` uses the first file for both the posted-draft and collapsed-file checks. The collapsed file hides the draft and can trigger `saved: posted draft is read-only`. If that is the only failure, verify that the draft is read-only after expanding the file in a saved-state fixture. Resolve other render and smoke failures before serving.

## Fields for later rounds

Set `"round": {"label": "Round 2", "note": "What changed since Round 1"}`. In local rounds, add `threads` for earlier comments and replies. The server fetches GitHub threads for PR rounds.

```json
{
  "threads": [
    {
      "id": "r1-1",
      "path": "internal/export/retry.go",
      "side": "RIGHT",
      "line": 72,
      "comments": [
        { "author": "you", "body": "What happens on a permanent error?" },
        { "author": "Claude", "body": "It returns immediately." }
      ]
    }
  ]
}
```
