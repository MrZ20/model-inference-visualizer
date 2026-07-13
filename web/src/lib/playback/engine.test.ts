import { describe, expect, it } from 'vitest';
import { createPlaybackEngine, ManualAnimationClock, type PlaybackSnapshot } from './engine';
const current = (engine: ReturnType<typeof createPlaybackEngine>) => { let value!: PlaybackSnapshot; const off = engine.state.subscribe((v) => value = v); off(); return value; };
describe('PlaybackEngine', () => {
  it('crosses chapters', () => { const clock = new ManualAnimationClock(); const engine = createPlaybackEngine(clock); engine.dispatch({ type: 'PLAY' }); clock.advance(6500); expect(current(engine).chapter).toBe('init'); expect(current(engine).progress).toBeCloseTo(.0833, 2); });
  it('opens focused detail', () => { const clock = new ManualAnimationClock(); const engine = createPlaybackEngine(clock); engine.dispatch({ type: 'OPEN_DETAIL', scene: 'attention' }); clock.advance(500); expect(current(engine).focus).toMatchObject({ scene: 'attention', phase: 'open', progress: 1 }); });
});
