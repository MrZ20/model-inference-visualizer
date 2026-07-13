import { writable, type Readable } from 'svelte/store';

export const CHAPTERS = ['overview', 'init', 'tokens', 'prefill', 'attention', 'moe', 'tp', 'decode'] as const;
export type SceneId = (typeof CHAPTERS)[number];
export type Locale = 'en' | 'zh';
export type MotionMode = 'full' | 'reduced';
export interface FocusState { scene: SceneId; progress: number; phase: 'opening' | 'open' | 'closing'; }
export interface PlaybackSnapshot {
  transport: 'playing' | 'paused'; chapter: SceneId; chapterIndex: number; progress: number;
  speed: number; locale: Locale; motion: MotionMode; focus: FocusState | null;
}
export type PlaybackCommand =
  | { type: 'PLAY' | 'PAUSE' | 'TOGGLE' | 'NEXT' | 'PREVIOUS' | 'CLOSE_DETAIL' }
  | { type: 'SEEK'; progress: number } | { type: 'SET_CHAPTER'; chapter: SceneId }
  | { type: 'OPEN_DETAIL'; scene: SceneId } | { type: 'SET_SPEED'; speed: number }
  | { type: 'SET_LOCALE'; locale: Locale } | { type: 'SET_MOTION'; motion: MotionMode };

export interface AnimationClock { now(): number; request(callback: (time: number) => void): number; cancel(id: number): void; }
export interface PlaybackEngine { readonly state: Readable<PlaybackSnapshot>; dispatch(command: PlaybackCommand): void; destroy(): void; }
export class BrowserAnimationClock implements AnimationClock {
  now() { return performance.now(); }
  request(callback: (time: number) => void) { return requestAnimationFrame(callback); }
  cancel(id: number) { cancelAnimationFrame(id); }
}
export class ManualAnimationClock implements AnimationClock {
  private time = 0; private nextId = 1; private callbacks = new Map<number, (time: number) => void>();
  now() { return this.time; }
  request(callback: (time: number) => void) { const id = this.nextId++; this.callbacks.set(id, callback); return id; }
  cancel(id: number) { this.callbacks.delete(id); }
  advance(milliseconds: number) { this.time += milliseconds; const callbacks = [...this.callbacks.values()]; this.callbacks.clear(); callbacks.forEach((callback) => callback(this.time)); }
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));
export function createPlaybackEngine(clock: AnimationClock = new BrowserAnimationClock(), initial: Partial<PlaybackSnapshot> = {}): PlaybackEngine {
  let snapshot: PlaybackSnapshot = { transport: 'paused', chapter: 'overview', chapterIndex: 0, progress: 0, speed: 1, locale: 'en', motion: 'full', focus: null, ...initial };
  const store = writable(snapshot); let frame: number | null = null; let lastTime = clock.now();
  const publish = (next: PlaybackSnapshot) => { snapshot = next; store.set(snapshot); };
  const schedule = () => { if (frame === null) frame = clock.request(tick); };
  const tick = (time: number) => {
    frame = null; const delta = time - lastTime; lastTime = time; let next = snapshot;
    if (next.transport === 'playing') {
      let progress = next.progress + delta * next.speed / 6000; let index = next.chapterIndex;
      if (progress >= 1) { if (index < CHAPTERS.length - 1) { index++; progress %= 1; } else { progress = 1; next = { ...next, transport: 'paused' }; } }
      next = { ...next, chapter: CHAPTERS[index], chapterIndex: index, progress };
    }
    if (next.focus && next.focus.phase !== 'open') {
      const direction = next.focus.phase === 'opening' ? 1 : -1;
      const progress = clamp(next.focus.progress + direction * delta / 420);
      next = progress === 0 ? { ...next, focus: null } : { ...next, focus: { ...next.focus, progress, phase: progress === 1 ? 'open' : next.focus.phase } };
    }
    publish(next); if (next.transport === 'playing' || (next.focus && next.focus.phase !== 'open')) schedule();
  };
  const dispatch = (command: PlaybackCommand) => {
    switch (command.type) {
      case 'PLAY': publish({ ...snapshot, transport: 'playing' }); lastTime = clock.now(); schedule(); break;
      case 'PAUSE': publish({ ...snapshot, transport: 'paused' }); break;
      case 'TOGGLE': dispatch({ type: snapshot.transport === 'playing' ? 'PAUSE' : 'PLAY' }); break;
      case 'NEXT': { const i = Math.min(CHAPTERS.length - 1, snapshot.chapterIndex + 1); publish({ ...snapshot, chapterIndex: i, chapter: CHAPTERS[i], progress: 0 }); break; }
      case 'PREVIOUS': { const i = Math.max(0, snapshot.chapterIndex - 1); publish({ ...snapshot, chapterIndex: i, chapter: CHAPTERS[i], progress: 0 }); break; }
      case 'SEEK': publish({ ...snapshot, progress: clamp(command.progress) }); break;
      case 'SET_CHAPTER': publish({ ...snapshot, chapter: command.chapter, chapterIndex: CHAPTERS.indexOf(command.chapter), progress: 0 }); break;
      case 'OPEN_DETAIL': publish({ ...snapshot, focus: { scene: command.scene, progress: snapshot.motion === 'reduced' ? 1 : 0, phase: snapshot.motion === 'reduced' ? 'open' : 'opening' } }); if (snapshot.motion === 'full') { lastTime = clock.now(); schedule(); } break;
      case 'CLOSE_DETAIL': if (snapshot.focus) { publish(snapshot.motion === 'reduced' ? { ...snapshot, focus: null } : { ...snapshot, focus: { ...snapshot.focus, phase: 'closing' } }); if (snapshot.motion === 'full') { lastTime = clock.now(); schedule(); } } break;
      case 'SET_SPEED': publish({ ...snapshot, speed: Math.max(.25, Math.min(2, command.speed)) }); break;
      case 'SET_LOCALE': publish({ ...snapshot, locale: command.locale }); break;
      case 'SET_MOTION': publish({ ...snapshot, motion: command.motion }); break;
    }
  };
  return { state: { subscribe: store.subscribe }, dispatch, destroy() { if (frame !== null) clock.cancel(frame); } };
}
