---
name: grill-me-interactive
description: Ask one question at a time to build a shared understanding of an idea, problem, or decision. Use when the user asks to be interviewed, to think something through together, or to stress-test a plan.
---

# Grill Me Interactive

If Matt Pocock's `grilling` skill is available through the host's skill list or installed skill directories, load it and use its interview workflow. Apply the interaction rules below in place of any instructions to ask a batch of questions. If you cannot load the installed skill, use the fallback below.

## Interaction rules

- If the idea is still forming, ask open-ended questions to understand the user's goal, context, and constraints in their own words. Use those answers to decide what to explore next.
- Ask one question at a time and wait for the answer. When a concrete choice comes up, explain the tradeoff and give a recommendation if you have enough context. Use the host's interactive questioning tool when it supports the question, with any recommendation first. Otherwise, ask the question in chat.
- Look up facts the code, files, tools, or prior discussion can establish. Leave decisions to the user.
- At the end, summarize what you understand together, any decisions made, and any questions left open. Ask the user to confirm or correct the summary. Begin implementation only if the user explicitly asks for it.

## Fallback interview

1. Start with what the user wants to understand or decide. As concrete choices emerge, map the major decisions as a tree. For each choice, identify what needs to be settled first and which follow-up decisions its answer could open or rule out.
2. Pick the most consequential open question whose prerequisites are settled. If it still depends on a fact you can look up, investigate it or move to another question you can ask now. Where practical, phrase the question so that accepting your recommendation is as easy as saying yes.
3. After each answer, revisit the tree. Follow the branches the answer opened, drop branches that no longer apply, and surface any new assumptions to resolve. Continue until each relevant branch is settled or deliberately deferred.

Based on the interviewing workflow from Matt Pocock's [grilling skill](https://github.com/mattpocock/skills/blob/main/skills/productivity/grilling/SKILL.md). The [upstream MIT notice](UPSTREAM-LICENSE) is included with this skill.
