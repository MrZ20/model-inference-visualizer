// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FLOW_PATH_IDS,
  measureFlowGeometry,
  observeFlowGeometry,
  relativeRect,
  type FlowPathId
} from './flow-geometry';

type RectInput = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const rect = ({ left, top, width, height }: RectInput): DOMRect =>
  ({
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({})
  }) as DOMRect;

const ANCHOR_RECTS: Record<string, RectInput> = {
  'weights-out': { left: 180, top: 210, width: 8, height: 8 },
  'tokens-in': { left: 238, top: 210, width: 8, height: 8 },
  'tokens-out': { left: 340, top: 210, width: 8, height: 8 },
  'embedding-in': { left: 398, top: 206, width: 8, height: 8 },
  'embedding-out': { left: 520, top: 206, width: 8, height: 8 },
  'transformer-in': { left: 572, top: 204, width: 8, height: 8 },
  'transformer-out': { left: 860, top: 204, width: 8, height: 8 },
  'logits-in': { left: 914, top: 206, width: 8, height: 8 },
  'logits-selected': { left: 1010, top: 210, width: 8, height: 8 },
  'decode-in': { left: 1062, top: 210, width: 8, height: 8 },
  'decode-loop-out': { left: 1150, top: 330, width: 8, height: 8 },
  'transformer-loop-in': { left: 660, top: 332, width: 8, height: 8 }
};

const originalFontsDescriptor = Object.getOwnPropertyDescriptor(document, 'fonts');

function createFlowRoot() {
  const root = document.createElement('section');
  root.getBoundingClientRect = () => rect({ left: 100, top: 40, width: 1100, height: 440 });

  for (const [anchor, bounds] of Object.entries(ANCHOR_RECTS)) {
    const element = document.createElement('span');
    element.dataset.flowAnchor = anchor;
    element.getBoundingClientRect = () => rect(bounds);
    root.append(element);
  }

  document.body.append(root);
  return root;
}

afterEach(() => {
  document.body.replaceChildren();
  if (originalFontsDescriptor) {
    Object.defineProperty(document, 'fonts', originalFontsDescriptor);
  } else {
    Reflect.deleteProperty(document, 'fonts');
  }
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('relativeRect', () => {
  it('projects a DOM rectangle into one container coordinate system without negative dimensions', () => {
    expect(
      relativeRect(
        rect({ left: 145, top: 86, width: -12, height: -9 }),
        rect({ left: 100, top: 40, width: 900, height: 500 })
      )
    ).toEqual({
      x: 45,
      y: 46,
      left: 45,
      top: 46,
      right: 45,
      bottom: 46,
      width: 0,
      height: 0,
      centerX: 45,
      centerY: 46
    });
  });
});

describe('measureFlowGeometry', () => {
  it('measures six reusable cubic paths from semantic DOM anchors', () => {
    const geometry = measureFlowGeometry(createFlowRoot());

    expect(geometry).toMatchObject({ width: 1100, height: 440 });
    expect(Object.keys(geometry.paths)).toEqual([...FLOW_PATH_IDS]);
    expect(geometry.paths['weights-to-tokens']).toMatchObject({
      source: { x: 84, y: 174 },
      target: { x: 142, y: 174 }
    });
    expect(geometry.paths['decode-loop'].source.x).toBeGreaterThan(
      geometry.paths['decode-loop'].target.x
    );
    expect(geometry.paths['decode-loop'].control1.y).toBeGreaterThanOrEqual(
      geometry.paths['decode-loop'].source.y
    );

    for (const pathId of FLOW_PATH_IDS) {
      const path = geometry.paths[pathId];
      expect(path.id).toBe(pathId);
      expect(path.d).toMatch(/^M [-\d.]+ [-\d.]+ C [-\d.]+ [-\d.]+, [-\d.]+ [-\d.]+, [-\d.]+ [-\d.]+$/);
      expect(path.d).not.toContain('NaN');
      expect(path.d).not.toContain('Infinity');
      for (const point of [path.source, path.control1, path.control2, path.target]) {
        expect(Number.isFinite(point.x)).toBe(true);
        expect(Number.isFinite(point.y)).toBe(true);
        expect(point.x).toBeGreaterThanOrEqual(0);
        expect(point.y).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('reports the missing semantic anchor instead of producing invalid geometry', () => {
    const root = createFlowRoot();
    root.querySelector('[data-flow-anchor="tokens-in"]')?.remove();

    expect(() => measureFlowGeometry(root)).toThrow('tokens-in');
  });
});

describe('observeFlowGeometry', () => {
  it('still performs the initial measurement when ResizeObserver is unavailable', () => {
    const root = createFlowRoot();
    const animationFrames = new Map<number, FrameRequestCallback>();
    const request = vi.fn((callback: FrameRequestCallback) => {
      animationFrames.set(1, callback);
      return 1;
    });
    vi.stubGlobal('requestAnimationFrame', request);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('ResizeObserver', undefined);

    const onChange = vi.fn();
    let cleanup: (() => void) | undefined;

    expect(() => {
      cleanup = observeFlowGeometry(root, onChange);
    }).not.toThrow();
    expect(request).toHaveBeenCalledTimes(1);

    animationFrames.get(1)?.(0);
    expect(onChange).toHaveBeenCalledTimes(1);
    cleanup?.();
  });

  it('batches initial, font-ready, and resize measurement and fully cleans up', async () => {
    const root = createFlowRoot();
    const animationFrames = new Map<number, FrameRequestCallback>();
    let nextFrame = 1;
    const request = vi.fn((callback: FrameRequestCallback) => {
      const id = nextFrame++;
      animationFrames.set(id, callback);
      return id;
    });
    const cancel = vi.fn((id: number) => animationFrames.delete(id));
    vi.stubGlobal('requestAnimationFrame', request);
    vi.stubGlobal('cancelAnimationFrame', cancel);

    let resizeCallback: ResizeObserverCallback | undefined;
    const observe = vi.fn();
    const disconnect = vi.fn();
    class TestResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }
      observe = observe;
      disconnect = disconnect;
    }
    vi.stubGlobal('ResizeObserver', TestResizeObserver);

    let resolveFonts!: () => void;
    const fontsReady = new Promise<void>((resolve) => {
      resolveFonts = resolve;
    });
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { ready: fontsReady }
    });

    const onChange = vi.fn();
    const cleanup = observeFlowGeometry(root, onChange);

    expect(observe).toHaveBeenCalledTimes(13);
    expect(request).toHaveBeenCalledTimes(1);
    resizeCallback?.([], {} as ResizeObserver);
    resizeCallback?.([], {} as ResizeObserver);
    expect(request).toHaveBeenCalledTimes(1);

    const initialFrame = animationFrames.get(1);
    expect(initialFrame).toBeDefined();
    animationFrames.delete(1);
    initialFrame?.(0);
    expect(onChange).toHaveBeenCalledTimes(1);

    resolveFonts();
    await fontsReady;
    await Promise.resolve();
    expect(request).toHaveBeenCalledTimes(2);

    resizeCallback?.([], {} as ResizeObserver);
    expect(request).toHaveBeenCalledTimes(2);
    cleanup();
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledWith(2);

    resizeCallback?.([], {} as ResizeObserver);
    expect(request).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

const _allPathIdsAreTyped: FlowPathId[] = [...FLOW_PATH_IDS];
void _allPathIdsAreTyped;
