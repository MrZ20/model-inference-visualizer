# Design QA — P6 website MVP

- Date: 2026-07-12
- Visual target: `docs/assets/p5-fused-long-scroll-direction.png`
- Implementation frame: `/Users/user/.codex/visualizations/2026/07/10/019f4a06-b639-72e1-9ad7-feba9f085ced/p6-overview.png`
- Local URL: `http://127.0.0.1:4173/?lang=en`
- Viewport checked: 1280 × 720 desktop, plus responsive CSS review at the 820 px breakpoint

## Visual comparison

The implementation preserves the selected target's wide teaching canvas, light editorial surface, restrained accent colors, fixed controls, large explanatory type, real/derived fidelity labels, matrix theater, and two-rank parallel chapter. It deliberately extends the target into eight full-width vertical chapters instead of compressing the complete run into one dashboard.

## Interaction checks

- Playback: play/pause advances the shared timeline; previous/next and chapter dots move the same state.
- Attention: clicking the stage continuously expands the formula, mask, softmax, and verification panel.
- MoE: clicking the stage expands the eight real top experts and captured quantization summary.
- Tensor parallel: clicking expands the two rank lanes and collective-communication bridge.
- Language: English/Chinese switching updates interface copy without resetting the playback state.
- Evidence: drawer exposes run ID, provenance files, tensor inspector, shapes, dtype, device, and glossary.
- Keyboard: Space controls playback; left/right move chapters; Escape closes focused content.
- Accessibility: visible focus treatment, semantic headings/buttons, reduced-motion fallback, loading and error states.
- Console: clean after a fresh navigation; only Vite connection debug entries remained.

## Issue audit

- P0 blockers: none.
- P1 major issues: none.
- P2 polish issues: none required for the P6 gate. Full mobile visual regression and production performance profiling remain in P7.

## Verification

- `npm run check`: 0 errors, 0 warnings.
- `npm test`: 4 files, 7 tests passed.
- `npm run build`: static production build succeeded.
- In-app browser: primary playback, expand/collapse, bilingual, drawer, and console checks passed.

final result: passed
