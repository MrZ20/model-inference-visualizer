# P6 dynamic playback regression and repair

> Historical note: the wheel/touch pause behavior described in this report was later superseded by the user's P6.6 requirement. The current contract is recorded in ADR-0007.

## User-visible failure

The page looked like a long static article with a moving progress bar. `Scroll to begin` moved the page, but did not start playback. Pressing play at `08 / 08` did not restart the trace, and playback did not bring the active chapter into view. Attention, MoE, and Tensor Parallel controls existed in the DOM, but their expanded regions could land outside the viewport, so a real click appeared to do nothing.

The report was correct. DOM presence and an advancing counter were not sufficient evidence of a dynamic, usable inference explanation.

## Reproduction evidence

Before the repair, the in-app browser showed:

- page height about `11,869 px`, `scrollY = 0`, while the player displayed `08 / 08`;
- pressing play left both `scrollY` and `08 / 08` unchanged;
- pressing `Scroll to begin` moved to initialization but left the transport paused;
- the Attention button was clickable after chapter navigation, but the expanded region was rendered below the viewport;
- only the global progress line was tied reliably to the playback state.

## Root cause

1. The hero start control dispatched only `SET_CHAPTER`; it never dispatched `PLAY`.
2. Chapter changes from the playback engine did not drive the camera. Previous/next, smooth scrolling, and scroll observation could also race each other.
3. The observer was attached before asynchronous trace loading had rendered the chapter elements.
4. Most visual animations started at page load and were independent of playback progress, so they had already finished before the user reached the chapter.
5. `PLAY` at the final frame did not reset the engine.
6. Attention and MoE used invalid CSS track math such as `calc(1fr * var(--focus))`; the browser placed the detail in an implicit row outside the viewport.

## Repair

- `Scroll to begin` now selects initialization, starts playback, and moves the camera to the live scene.
- Playback chapter changes automatically move the camera; programmatic navigation is isolated from manual scroll observation.
- A user wheel/touch gesture pauses playback and returns control to scroll-driven exploration.
- The observer attaches only after the trace and chapter DOM have loaded.
- Replaying from the final frame resets to the beginning.
- Initialization weight bars, token reveals, embedding cells, QKV stages, MoE routing, TP packets, and Decode steps are driven by the shared scene progress.
- Pausing also pauses continuous TP/Decode motion.
- Opening a detail pauses playback, keeps the user on the selected scene, and expands a valid grid track in the current viewport.
- Attention and MoE now transition between explicit `0fr` and visible tracks instead of invalid `fr` multiplication.

## Red/green evidence

- A new engine test failed because play at the final frame remained paused on Decode; it passes after restart logic was added.
- A new page test failed because `Scroll to begin` left the control labelled `Play trace`; it passes after start now dispatches playback.
- The page test also asserts that the initialization scene becomes `playing` and its content-level motion progress increases.
- Existing page tests continue to click Attention, MoE, and TP and assert their named detail regions and real `p4r4` facts.

## Final automated checks

- Six test files, 19 tests passed.
- Svelte type/accessibility check: 0 errors, 0 warnings.
- Static production build succeeded.

## Final browser assertions

- Initialization content changed between two frames: progress `0.084 → 0.187`; a real weight bar transform changed from scale `0.035 → 0.344851`.
- At 2× speed, playback completed initialization, automatically scrolled to Tokens, and continued with Tokens in `playing` state.
- Attention: the real button center hit the button; the two-column detail region intersected the viewport.
- MoE: the real button center hit the button; the region intersected the viewport; 8 real experts were highlighted and `E214`/`E202` were visible.
- Tensor Parallel: the real button center hit the button; the region intersected the viewport; rank 0 `6.440 ms` and rank 1 `6.515 ms` were visible.
- A fresh browser tab loaded with no console error entries.
