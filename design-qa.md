# Design QA — P6 visual realignment

- Date: 2026-07-13
- Visual contract: `docs/assets/p5-fused-long-scroll-direction.png`
- Local prototype: `http://127.0.0.1:4173/?lang=en`
- Browser viewport: 1280 × 720
- Trace: `qwen35-a3b-w8a8-20260710-p4r4`
- Detailed evidence: `docs/audits/2026-07-13-p6-rebuild/AUDIT.md`

## Source-to-implementation comparison

The selected visual and final Attention state were placed in one 2560 × 720 comparison image: `docs/audits/2026-07-13-p6-rebuild/reference-vs-implementation-attention.png`.

The implementation preserves the source's warm editorial surface, indigo hierarchy, fixed chapter rail, wide matrix theater, Q/K/V color roles, causal matrix, softmax stage and left-to-right explanatory flow. It extends the source with the project-specific initialization, 40-layer mixed architecture, MoE/W8A8, two Ascend TP lanes and exact five-token Decode.

The first comparison exposed a real defect: focus content expanded beneath the fixed chapter rail, clipping the Attention/MoE/TP titles. The focused shell now keeps a safe left gutter. Browser geometry after the fix: chapter rail right `104.95 px`, focus title left `133.78 px`.

## Core interaction evidence

- Initialization playback changed scene progress to `0.205`, activated two timeline steps and changed a weight-shard opacity after 1.6 seconds.
- Prefill now exposes both representative attention paths. Linear Attention opens a six-stage Gated DeltaNet region using captured `[5, 2048]` boundary summaries (bounded samples + statistics) around a Structural/Schematic recurrent path; continuous sampling changed input stage progress from `0.316` to `1.0`.
- Attention opened from the real button inside the viewport. Selecting Softmax changed its stage from `0` to `0.25` and changed panel transforms.
- MoE token selection changed routing from E214/E202… to E211/E199…; selecting dynamic scale changed its stage from `0` to `0.25`.
- Tensor Parallel rendered both NPU lanes and changed both collective stages from `0` to `0.25` together.
- Decode at progress `0.272` showed logits top-1 `498`, selected token `498`, one complete step and one filled KV-cache slot. The completion frame aligned logits top-1 and selected token at `321`.
- English → 中文 → English preserved TP focus, collective stage `0.25` and speed `2`.
- A real pointer-center hit resolved to the visible Play button; focused regions intersected the viewport.
- Document width equaled viewport width (`1280 px`); no global horizontal overflow occurred. Wide internal theaters scroll inside their focus region.
- Browser warnings/errors: none.

## Automated verification

- `npm run check`: 0 errors, 0 warnings.
- `npm test -- --run`: 7 files, 45 tests passed（包含 P6.5 页面/游标解耦、P6.6 滚动不中断、P6.7 Decode 浅色主题，以及 P6.9 全章节连续滚动契约）。
- P6.9 真实浏览器：所有章节主画布均为 relative；Attention、TP、Decode 各滚动 180px 时画面同步移动 -180px，文档尺寸 1280×7944。
- `npm run build`: successful SvelteKit static build.
- Regression coverage includes page playback, real Linear/Full Attention/MoE/TP clicks, 40-layer structure, exact p4r4 data, focus exclusivity, bilingual state preservation, Decode logits/selection alignment, keyboard navigation, Evidence dialog focus/Escape behavior and URL locale precedence.
- A final real-browser pass proved `Summary` in both the Linear entry and focused scene, all five Evidence fidelity levels, continuous Linear stage motion, and reversible close/reopen transitions; console warning/error count remained zero.

## Responsive and accessibility readiness

- At 390 × 844 the page uses a true summary layout instead of pushing a 920 px desktop matrix off-screen.
- Attention, MoE and Tensor Parallel focus actions are the first visual item in their narrow-screen overviews.
- Detailed matrix/parallel theaters scroll only inside their labelled focus regions; the document itself remains 390 px wide.
- An explicit `?lang=en` or `?lang=zh-CN` overrides stored locale state.
- The Evidence drawer is a labelled modal dialog, focuses Close on open, closes with Escape and restores trigger focus.
- Chinese Evidence provenance and all fidelity explanations are localized.
- Current-run screenshots and measurements are recorded in `docs/audits/2026-07-13-p7-readiness/AUDIT.md`.
- Original-requirement completion evidence, including the newly corrected linear-attention representative, is recorded in `docs/audits/2026-07-13-p8-completion/AUDIT.md`.

## Remaining gate

No P0/P1 issue remains in the tested desktop and 390 px scopes. Broader device/browser coverage, production performance and release checks still belong to P7. Product/visual acceptance requires the user's own operation of the prototype; this design-QA result does not close that user gate.

final result: passed
