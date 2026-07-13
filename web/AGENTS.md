# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Project-specific decisions

- Selected visual target: `../docs/assets/p5-fused-long-scroll-direction.png`.
- Build a long, full-width scrollytelling page, not a compact dashboard or slideshow.
- English is the default; `EN / 中文` must switch all interface copy without resetting playback or focus state.
- Scroll, play/pause, previous/next and chapter navigation operate one shared playback state.
- Clickable stages expand continuously in place; Attention, MoE/W8A8 and TP views use real `p4r4` data.
- Fidelity labels must distinguish captured, derived, structural and schematic content.
- P6 must remain a static trace player. Do not add browser model inference, SSH or a backend.
