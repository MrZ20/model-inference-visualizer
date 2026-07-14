# Prototype Instructions

Before any substantial frontend work, follow the repository root `AGENTS.md` recovery protocol and read every file in `../docs/project-context/CONTEXT_MANIFEST.md`. `MEMORY.md` or the current page alone is not sufficient context.

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Project-specific decisions

- Selected visual target: `../docs/assets/p5-fused-long-scroll-direction.png`.
- Build a long, full-width scrollytelling page, not a compact dashboard or slideshow.
- English is the default; `EN / 中文` must switch all interface copy without resetting playback or focus state.
- Scroll, play/pause, previous/next and chapter navigation are coordinated by one PlaybackEngine, but the visible page and inference cursor are independent state: browsing must never complete or reset a scene.
- The start control must preserve three origins (beginning/current page/current step) and two modes (continuous/single semantic step). Wheel, touch, non-programmatic scrolling and chapter browsing take over the camera without pausing continuous playback; an explicit start restores camera follow.
- Clickable stages expand continuously in place; Linear/Full Attention, MoE/W8A8 and TP views use real `p4r4` boundary data, with unobserved internals explicitly marked Structural/Schematic.
- Fidelity labels must distinguish captured, derived, structural and schematic content.
- P6 must remain a static trace player. Do not add browser model inference, SSH or a backend.
- Every clickable focus scene must have a page-level component test that clicks the real control and asserts a named visible detail region.
- Layer architecture, representative attention shapes and decode steps must come through `buildTraceExperience`; do not reintroduce hard-coded trace facts in the page.
- Playback acceptance must prove that content inside the active scene changes between frames and that the camera follows chapter changes; an advancing counter or progress line alone is not dynamic playback.
- Browser interaction QA must verify both pointer hit-testing at the real control center and that the expanded region intersects the viewport; DOM presence alone is insufficient.
- Focus transitions are reversible: clicking the same entry during its closing animation must reopen it, with a page-level regression proving the region survives past the old close duration.
