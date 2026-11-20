---
name: draft-slack-message
description: Draft a short, informal, plain-text Slack message or thread reply. Use when the user says "draft a slack message", "draft a reply to this thread", "short message to <colleague>", or pastes a Slack link and asks for a reply. Reads the thread, gathers the PR, Jira and Datadog links, and returns one draft. Drafts only, never sends.
---

# Draft Slack message

## Steps
1. If a Slack thread or message link is given, read it first (slack_read_thread or slack_read_channel) to get context and tone.
2. Collect the concrete links the message needs (PR, Jira ticket, Datadog link). Verify a metric or dashboard actually exists before linking it.
3. Write 2-5 short plain-text lines in a casual colleague voice: conclusion first, links inline.
4. Show the draft in chat and wait. Apply edits in place to the same draft.
5. Only use slack_send_message_draft if asked. Never send without explicit approval.

## Style rules (from the user's corrections)
- Short and less formal. "SHORT" was restated repeatedly.
- No What/Why/Next headers, no numbered sections, no bold labels. At most a short bullet list for genuine lists.
- Not agentic or robotic. No pleasantries padding.
- It is Slack: plain text, never HTML-style designs or option layouts.
- Answer only what was asked. No unrequested variants or redrafts.
- Hyphens only as dashes.

## Do not
- Do not post or send.
- Do not link anything you have not verified.
- Do not restructure the draft when asked for a small edit.

## Notes
Consider also adding a one-line rule to global CLAUDE.md: "Slack drafts: short, plain text, no headers." Overlaps only with review-writing-tone, which is a style pass and does not read threads or gather links.
