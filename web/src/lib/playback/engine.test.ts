import { describe, expect, it } from 'vitest';
import { CHAPTER_DURATION_MS, createPlaybackEngine, ManualAnimationClock, type PlaybackSnapshot } from './engine';
const current = (engine: ReturnType<typeof createPlaybackEngine>) => { let value!: PlaybackSnapshot; const off = engine.state.subscribe((v) => value = v); off(); return value; };
describe('PlaybackEngine', () => {
  it('keeps the viewed page independent from the inference cursor', () => {
    const engine = createPlaybackEngine(new ManualAnimationClock());

    engine.dispatch({ type: 'SEEK_SCENE', scene: 'prefill', progress: 0.35 });
    engine.dispatch({ type: 'SET_VIEW_CHAPTER', chapter: 'attention' });

    expect(current(engine)).toMatchObject({
      viewChapter: 'attention',
      chapter: 'prefill',
      progress: 0.35
    });
    expect(current(engine).progressByChapter.prefill).toBe(0.35);
  });

  it('starts continuously from the visible page without completing other pages', () => {
    const engine = createPlaybackEngine(new ManualAnimationClock());
    engine.dispatch({ type: 'SEEK_SCENE', scene: 'prefill', progress: 0.35 });
    engine.dispatch({ type: 'SET_VIEW_CHAPTER', chapter: 'attention' });

    engine.dispatch({ type: 'START', origin: 'page', mode: 'continuous' });

    expect(current(engine)).toMatchObject({
      transport: 'playing',
      viewChapter: 'attention',
      chapter: 'attention',
      progress: 0
    });
    expect(current(engine).progressByChapter.prefill).toBe(0.35);
    expect(current(engine).progressByChapter.attention).toBe(0);
  });

  it('advances exactly one semantic stage from the current inference step', () => {
    const engine = createPlaybackEngine(new ManualAnimationClock());
    engine.dispatch({ type: 'SEEK_SCENE', scene: 'attention', progress: 0.2 });
    engine.dispatch({ type: 'SET_VIEW_CHAPTER', chapter: 'tp' });

    engine.dispatch({ type: 'START', origin: 'step', mode: 'single' });

    expect(current(engine)).toMatchObject({
      transport: 'paused',
      viewChapter: 'attention',
      chapter: 'attention'
    });
    expect(current(engine).progress).toBeCloseTo(2 / 6, 5);
    expect(current(engine).progressByChapter.attention).toBeCloseTo(2 / 6, 5);
  });

  it('resets to initialization when starting from the beginning', () => {
    const engine = createPlaybackEngine(new ManualAnimationClock());
    engine.dispatch({ type: 'SEEK_SCENE', scene: 'decode', progress: 0.6 });

    engine.dispatch({ type: 'START', origin: 'beginning', mode: 'continuous' });

    expect(current(engine)).toMatchObject({
      transport: 'playing',
      viewChapter: 'init',
      chapter: 'init',
      progress: 0
    });
    expect(Object.values(current(engine).progressByChapter).every((value) => value === 0)).toBe(true);
  });

  it('runs one initialization stage when beginning in single-step mode', () => {
    const engine = createPlaybackEngine(new ManualAnimationClock());

    engine.dispatch({ type: 'START', origin: 'beginning', mode: 'single' });

    expect(current(engine)).toMatchObject({ transport: 'paused', chapter: 'init', viewChapter: 'init' });
    expect(current(engine).progress).toBeCloseTo(1 / 8, 5);
  });

  it('runs one stage from the visible page in single-step mode', () => {
    const engine = createPlaybackEngine(new ManualAnimationClock());
    engine.dispatch({ type: 'SET_VIEW_CHAPTER', chapter: 'tp' });

    engine.dispatch({ type: 'START', origin: 'page', mode: 'single' });

    expect(current(engine)).toMatchObject({ transport: 'paused', chapter: 'tp', viewChapter: 'tp' });
    expect(current(engine).progress).toBeCloseTo(1 / 7, 5);
  });

  it('resumes continuous playback from the independent inference cursor', () => {
    const engine = createPlaybackEngine(new ManualAnimationClock());
    engine.dispatch({ type: 'SEEK_SCENE', scene: 'moe', progress: 0.4 });
    engine.dispatch({ type: 'SET_VIEW_CHAPTER', chapter: 'decode' });

    engine.dispatch({ type: 'START', origin: 'step', mode: 'continuous' });

    expect(current(engine)).toMatchObject({
      transport: 'playing',
      chapter: 'moe',
      viewChapter: 'moe',
      progress: 0.4
    });
  });

  it('advances the inference cursor without overwriting a manually selected page', () => {
    const clock = new ManualAnimationClock();
    const engine = createPlaybackEngine(clock);
    engine.dispatch({ type: 'START', origin: 'beginning', mode: 'continuous' });
    engine.dispatch({ type: 'SET_VIEW_CHAPTER', chapter: 'attention' });

    clock.advance(1200);

    expect(current(engine)).toMatchObject({
      transport: 'playing',
      chapter: 'init',
      viewChapter: 'attention'
    });
    expect(current(engine).progress).toBeGreaterThan(0);
  });

  it('uses a readable, minute-scale chapter pace', () => {
    const clock = new ManualAnimationClock();
    const engine = createPlaybackEngine(clock);
    engine.dispatch({ type: 'PLAY' });
    clock.advance(CHAPTER_DURATION_MS + 1500);
    expect(current(engine).chapter).toBe('init');
    expect(current(engine).progress).toBeCloseTo(1500 / CHAPTER_DURATION_MS, 2);
  });
  it('restarts the trace when play is pressed at the end', () => {
    const clock = new ManualAnimationClock();
    const engine = createPlaybackEngine(clock, { chapter: 'decode', chapterIndex: 7, progress: 1 });

    engine.dispatch({ type: 'PLAY' });
    clock.advance(1000);

    expect(current(engine)).toMatchObject({
      transport: 'playing',
      chapter: 'init',
      chapterIndex: 1
    });
    expect(current(engine).progress).toBeCloseTo(1000 / CHAPTER_DURATION_MS, 2);
  });
  it('opens focused detail', () => { const clock = new ManualAnimationClock(); const engine = createPlaybackEngine(clock); engine.dispatch({ type: 'OPEN_DETAIL', scene: 'attention' }); clock.advance(500); expect(current(engine).focus).toMatchObject({ scene: 'attention', phase: 'open', progress: 1 }); });
  it('opens the linear-attention detail inside the prefill chapter', () => { const clock = new ManualAnimationClock(); const engine = createPlaybackEngine(clock); engine.dispatch({ type: 'SET_CHAPTER', chapter: 'prefill' }); engine.dispatch({ type: 'OPEN_DETAIL', scene: 'linear' }); clock.advance(500); expect(current(engine)).toMatchObject({ chapter: 'prefill', focus: { scene: 'linear', phase: 'open', progress: 1 } }); });
});
