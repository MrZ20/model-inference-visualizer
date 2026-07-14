import { writable, type Readable } from 'svelte/store';

export const CHAPTERS = ['overview', 'init', 'tokens', 'prefill', 'attention', 'moe', 'tp', 'decode'] as const;
export type SceneId = (typeof CHAPTERS)[number];
export type DetailId = 'linear' | 'attention' | 'moe' | 'tp';
export type Locale = 'en' | 'zh-CN';
export type MotionMode = 'full' | 'reduced';
export type StartOrigin = 'beginning' | 'page' | 'step';
export type RunMode = 'continuous' | 'single';

export const SCENE_STEP_COUNTS: Record<SceneId, number> = {
  overview: 6,
  init: 8,
  tokens: 5,
  prefill: 40,
  attention: 6,
  moe: 6,
  tp: 7,
  decode: 5
};

export interface FocusState {
  scene: DetailId;
  progress: number;
  phase: 'opening' | 'open' | 'closing';
}

export interface PlaybackSnapshot {
  transport: 'playing' | 'paused';
  /** The inference cursor. It advances only through explicit playback commands. */
  chapter: SceneId;
  chapterIndex: number;
  progress: number;
  /** The page currently in view. Browsing does not move the inference cursor. */
  viewChapter: SceneId;
  viewChapterIndex: number;
  progressByChapter: Record<SceneId, number>;
  speed: number;
  locale: Locale;
  motion: MotionMode;
  focus: FocusState | null;
}

export type PlaybackCommand =
  | { type: 'PLAY' | 'PAUSE' | 'TOGGLE' | 'NEXT' | 'PREVIOUS' | 'CLOSE_DETAIL' }
  | { type: 'START'; origin: StartOrigin; mode: RunMode }
  | { type: 'SEEK'; progress: number }
  | { type: 'SEEK_SCENE'; scene: SceneId; progress: number }
  | { type: 'SET_CHAPTER'; chapter: SceneId }
  | { type: 'SET_VIEW_CHAPTER'; chapter: SceneId }
  | { type: 'OPEN_DETAIL'; scene: DetailId }
  | { type: 'SET_SPEED'; speed: number }
  | { type: 'SET_LOCALE'; locale: Locale }
  | { type: 'SET_MOTION'; motion: MotionMode };

export interface AnimationClock {
  now(): number;
  request(callback: (time: number) => void): number;
  cancel(id: number): void;
}

export interface PlaybackEngine {
  readonly state: Readable<PlaybackSnapshot>;
  dispatch(command: PlaybackCommand): void;
  destroy(): void;
}

export class BrowserAnimationClock implements AnimationClock {
  now() { return performance.now(); }
  request(callback: (time: number) => void) { return requestAnimationFrame(callback); }
  cancel(id: number) { cancelAnimationFrame(id); }
}

export class ManualAnimationClock implements AnimationClock {
  private time = 0;
  private nextId = 1;
  private callbacks = new Map<number, (time: number) => void>();
  now() { return this.time; }
  request(callback: (time: number) => void) { const id = this.nextId++; this.callbacks.set(id, callback); return id; }
  cancel(id: number) { this.callbacks.delete(id); }
  advance(milliseconds: number) {
    this.time += milliseconds;
    const callbacks = [...this.callbacks.values()];
    this.callbacks.clear();
    callbacks.forEach((callback) => callback(this.time));
  }
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const emptyProgress = () => Object.fromEntries(CHAPTERS.map((chapter) => [chapter, 0])) as Record<SceneId, number>;
const withSceneProgress = (snapshot: PlaybackSnapshot, scene: SceneId, progress: number) => ({
  ...snapshot.progressByChapter,
  [scene]: clamp(progress)
});

export const CHAPTER_DURATION_MS = 18_000;

export function createPlaybackEngine(
  clock: AnimationClock = new BrowserAnimationClock(),
  initial: Partial<PlaybackSnapshot> = {}
): PlaybackEngine {
  const chapter = initial.chapter ?? 'overview';
  const progress = clamp(initial.progress ?? 0);
  const viewChapter = initial.viewChapter ?? chapter;
  let snapshot: PlaybackSnapshot = {
    transport: 'paused',
    speed: 1,
    locale: 'en',
    motion: 'full',
    focus: null,
    ...initial,
    chapter,
    chapterIndex: CHAPTERS.indexOf(chapter),
    progress,
    viewChapter,
    viewChapterIndex: CHAPTERS.indexOf(viewChapter),
    progressByChapter: {
      ...emptyProgress(),
      ...initial.progressByChapter,
      [chapter]: progress
    }
  };
  const store = writable(snapshot);
  let frame: number | null = null;
  let lastTime = clock.now();

  const publish = (next: PlaybackSnapshot) => {
    snapshot = next;
    store.set(snapshot);
  };
  const schedule = () => {
    if (frame === null) frame = clock.request(tick);
  };
  const setCursor = (scene: SceneId, nextProgress: number, moveView = true) => {
    const boundedProgress = clamp(nextProgress);
    publish({
      ...snapshot,
      chapter: scene,
      chapterIndex: CHAPTERS.indexOf(scene),
      progress: boundedProgress,
      progressByChapter: withSceneProgress(snapshot, scene, boundedProgress),
      ...(moveView ? { viewChapter: scene, viewChapterIndex: CHAPTERS.indexOf(scene) } : {})
    });
  };
  const advanceOneStage = (scene: SceneId, currentProgress: number) => {
    const stepCount = SCENE_STEP_COUNTS[scene];
    const nextStep = Math.min(stepCount, Math.floor(currentProgress * stepCount + 1e-6) + 1);
    return nextStep / stepCount;
  };

  const tick = (time: number) => {
    frame = null;
    const delta = Math.max(0, time - lastTime);
    lastTime = time;
    let next = snapshot;

    if (next.transport === 'playing') {
      let progressToApply = next.progress + delta * next.speed / CHAPTER_DURATION_MS;
      let index = next.chapterIndex;
      let progressByChapter = { ...next.progressByChapter };

      while (progressToApply >= 1 && index < CHAPTERS.length - 1) {
        progressByChapter[CHAPTERS[index]] = 1;
        progressToApply -= 1;
        index += 1;
      }

      const chapterAtCursor = CHAPTERS[index];
      const reachedEnd = index === CHAPTERS.length - 1 && progressToApply >= 1;
      const boundedProgress = reachedEnd ? 1 : clamp(progressToApply);
      progressByChapter[chapterAtCursor] = boundedProgress;
      next = {
        ...next,
        transport: reachedEnd ? 'paused' : 'playing',
        chapter: chapterAtCursor,
        chapterIndex: index,
        progress: boundedProgress,
        progressByChapter
      };
    }

    if (next.focus && next.focus.phase !== 'open') {
      const direction = next.focus.phase === 'opening' ? 1 : -1;
      const focusProgress = clamp(next.focus.progress + direction * delta / 420);
      next = focusProgress === 0
        ? { ...next, focus: null }
        : {
            ...next,
            focus: {
              ...next.focus,
              progress: focusProgress,
              phase: focusProgress === 1 ? 'open' : next.focus.phase
            }
          };
    }

    publish(next);
    if (next.transport === 'playing' || (next.focus && next.focus.phase !== 'open')) schedule();
  };

  const start = (origin: StartOrigin, mode: RunMode) => {
    let scene = snapshot.chapter;
    let nextProgress = snapshot.progress;
    let progressByChapter = { ...snapshot.progressByChapter };

    if (origin === 'beginning') {
      scene = 'init';
      nextProgress = 0;
      progressByChapter = emptyProgress();
    } else if (origin === 'page') {
      scene = snapshot.viewChapter;
      nextProgress = 0;
      progressByChapter[scene] = 0;
    }

    if (mode === 'single') nextProgress = advanceOneStage(scene, nextProgress);
    progressByChapter[scene] = nextProgress;
    const atEnd = scene === CHAPTERS.at(-1) && nextProgress >= 1;
    publish({
      ...snapshot,
      transport: mode === 'continuous' && !atEnd ? 'playing' : 'paused',
      chapter: scene,
      chapterIndex: CHAPTERS.indexOf(scene),
      progress: nextProgress,
      progressByChapter,
      viewChapter: scene,
      viewChapterIndex: CHAPTERS.indexOf(scene)
    });
    if (mode === 'continuous' && !atEnd) {
      lastTime = clock.now();
      schedule();
    }
  };

  const dispatch = (command: PlaybackCommand) => {
    switch (command.type) {
      case 'PLAY': {
        const atEnd = snapshot.chapterIndex === CHAPTERS.length - 1 && snapshot.progress >= 1;
        start(atEnd ? 'beginning' : 'step', 'continuous');
        break;
      }
      case 'PAUSE':
        publish({ ...snapshot, transport: 'paused' });
        break;
      case 'TOGGLE':
        dispatch({ type: snapshot.transport === 'playing' ? 'PAUSE' : 'PLAY' });
        break;
      case 'START':
        start(command.origin, command.mode);
        break;
      case 'NEXT': {
        const index = Math.min(CHAPTERS.length - 1, snapshot.viewChapterIndex + 1);
        publish({ ...snapshot, viewChapterIndex: index, viewChapter: CHAPTERS[index] });
        break;
      }
      case 'PREVIOUS': {
        const index = Math.max(0, snapshot.viewChapterIndex - 1);
        publish({ ...snapshot, viewChapterIndex: index, viewChapter: CHAPTERS[index] });
        break;
      }
      case 'SEEK':
        setCursor(snapshot.chapter, command.progress);
        break;
      case 'SEEK_SCENE':
        setCursor(command.scene, command.progress);
        break;
      case 'SET_CHAPTER':
        setCursor(command.chapter, 0);
        break;
      case 'SET_VIEW_CHAPTER':
        publish({
          ...snapshot,
          viewChapter: command.chapter,
          viewChapterIndex: CHAPTERS.indexOf(command.chapter)
        });
        break;
      case 'OPEN_DETAIL':
        publish({
          ...snapshot,
          focus: {
            scene: command.scene,
            progress: snapshot.motion === 'reduced' ? 1 : 0,
            phase: snapshot.motion === 'reduced' ? 'open' : 'opening'
          }
        });
        if (snapshot.motion === 'full') {
          lastTime = clock.now();
          schedule();
        }
        break;
      case 'CLOSE_DETAIL':
        if (snapshot.focus) {
          publish(snapshot.motion === 'reduced'
            ? { ...snapshot, focus: null }
            : { ...snapshot, focus: { ...snapshot.focus, phase: 'closing' } });
          if (snapshot.motion === 'full') {
            lastTime = clock.now();
            schedule();
          }
        }
        break;
      case 'SET_SPEED':
        publish({ ...snapshot, speed: Math.max(0.25, Math.min(2, command.speed)) });
        break;
      case 'SET_LOCALE':
        publish({ ...snapshot, locale: command.locale });
        break;
      case 'SET_MOTION':
        publish({ ...snapshot, motion: command.motion });
        break;
    }
  };

  return {
    state: { subscribe: store.subscribe },
    dispatch,
    destroy() { if (frame !== null) clock.cancel(frame); }
  };
}
