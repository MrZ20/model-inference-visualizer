# P6 interaction regression and repair

## User-visible failure

The first P6 handoff claimed that Attention, MoE, Tensor Parallel, the 40-layer view, and Decode were usable. That conclusion was not sufficiently supported: the seven tests only covered the playback engine and utility modules. They did not render the page, click the controls, assert visible detail regions, or prove that layer/decode values came from `p4r4`.

The report was therefore valid: details were permanently present in the DOM and collapsed with CSS only, expansion could occur outside the current viewport, the TP button did not reveal additional captured span data, the 40-layer ribbon and several decode values were hard-coded, and the MoE map only drew 32 placeholder experts.

## Root cause

1. No page-level regression seam existed.
2. Focus scenes relied on zero-width CSS columns instead of explicit open/closed content semantics.
3. The page consumed raw artifacts ad hoc, so hard-coded values were not rejected when evidence was missing.
4. Browser inspection checked selected screenshots but did not encode the checks as repeatable assertions.

## Repair

- Added a `buildTraceExperience` projection that requires the exact `model.config.layerTypes` event and projects:
  - all 40 layers: 30 linear attention and 10 full attention;
  - captured layer-0 `QwenGatedDeltaNetAttention` shapes;
  - derived layer-3 Q/K/V shapes and 5×5 probability matrix;
  - five exact decode token IDs, logits shapes, and final text.
- Changed Attention, MoE, and TP details to explicit, named regions that only exist while open.
- Added automatic focus scrolling after an expansion.
- Added real TP rank span cards from `parallel-summary.json`.
- Replaced the 32-node MoE placeholder with all 256 experts and eight real selected experts.
- Added accessible names to playback and evidence controls.

## Red/green evidence

The following tests were run red before each corresponding repair and green afterwards:

- Attention named detail region.
- Real MoE top-8 expansion.
- Real TP rank 0/1 span expansion.
- Exact 40-layer architecture projection.
- Captured linear-attention representative.
- Derived full-attention representative.
- Five exact decode steps.
- Rejection when the trace cannot prove the layer architecture.

## Final automated checks

- Six test files, 17 tests passed.
- Svelte type check: 0 errors, 0 warnings.
- Static production build succeeded.

## Final browser assertions

- Attention: 0 detail regions before click, 1 after click.
- MoE: 256 expert nodes, 8 selected; real top-8 IDs visible after click.
- TP: rank 0 `6.440 ms`, rank 1 `6.515 ms`, both `[5, 4608]`.
- Architecture: 40 layers, 10 full-attention layers.
- Decode: 5 steps with `[1, 248320]` logits and IDs `498, 7525, 3855, 1089, 321`.
- Browser console: no error entries.

## Follow-up

This repair proved DOM-level expansion and trace fidelity, but it did not yet prove that playback moved scene content or that expanded regions stayed inside the user's viewport. The follow-up regression and its stricter browser evidence are recorded in `2026-07-13-p6-dynamic-playback-regression.md`; the current suite has 19 tests.
