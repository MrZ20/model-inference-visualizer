# Project Continuity Instructions

## Mandatory context recovery

Before substantial work, and every time the conversation is summarized, compacted, resumed, or otherwise missing history:

1. Read `docs/project-context/CONTEXT_MANIFEST.md`.
2. Read every file listed there in order, including `CHAT_TIMELINE.md`, `MASTER_PLAN.md`, `VISUAL_INTERACTION_CONTRACT.md`, and `CURRENT_STATE.md`.
3. Inspect `git status --short --branch`, `git diff --cached --stat`, and the latest Git log before editing.
4. Read `model-inference-visualizer-desktop-particle-flow-agent-plan.md` in full and view `docs/assets/p5-fused-long-scroll-direction.png` as historical context before frontend visual work.
5. In commentary, restate the north star, current phase, user-acceptance state, and the one major step being advanced.

`MEMORY.md` is a summary, not the sole source of truth. Never infer the intended product from the current UI or current code alone.

## Product guardrails

- The active desktop Global Flow design source is `model-inference-visualizer-desktop-particle-flow-agent-plan.md`; it must be read in full before frontend work and after every context compaction.
- `docs/assets/p5-fused-long-scroll-direction.png` remains historical context for the long-form page and downstream Focus Scenes, but it is no longer the visual target for the desktop Global Flow.
- The experience is a long, full-width, continuously animated inference story with in-place Focus Scenes. It is not an A4/dashboard layout, generic landing page, slideshow, or progress bar over static content.
- English is the default; full English/Chinese switching preserves playback, chapter, focus, and progress.
- The website is a static player for the real `qwen35-a3b-w8a8-20260710-p4r4` trace. Do not add browser inference, SSH, or a backend.
- Captured, summary, derived, structural, and schematic information must remain distinguishable.
- Tests passing do not equal user product acceptance. A failed user review reopens the Gate.

## Progress recording

After every major step:

1. Append new explicit user decisions to `docs/project-context/CHAT_TIMELINE.md`.
2. Update `docs/project-context/CURRENT_STATE.md` with Git, implementation, evidence, known gaps, acceptance, and next step.
3. Update the master plan or visual contract if product intent changed.
4. Keep `MEMORY.md` and `TASKS.md` as synchronized summaries.
5. Stop for user acceptance unless the user explicitly authorized combining phases.

Do not claim verbatim recovery of chat messages no longer available after compaction. Mark reconstructed summaries honestly.

## Testing and changes

- Protect staged, unstaged, and untracked user work.
- Run Python collector tests only in the repository `.venv`; run frontend checks from `web/` using its local dependency environment.
- Page behavior needs component/browser evidence: real pointer hit, expanded content in the viewport, and visible scene motion. DOM presence or a moving counter is insufficient.
- Do not commit or push without explicit user authorization.
