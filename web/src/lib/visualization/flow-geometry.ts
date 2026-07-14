export interface Point {
  x: number;
  y: number;
}

export interface RelativeRect extends Point {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export const FLOW_PATH_IDS = [
  'weights-to-tokens',
  'tokens-to-embedding',
  'embedding-to-transformer',
  'transformer-to-logits',
  'logits-to-completion',
  'decode-loop'
] as const;

export type FlowPathId = (typeof FLOW_PATH_IDS)[number];

export interface FlowBezier {
  id: FlowPathId;
  source: Point;
  control1: Point;
  control2: Point;
  target: Point;
  d: string;
}

export interface FlowGeometry {
  width: number;
  height: number;
  paths: Record<FlowPathId, FlowBezier>;
}

type RectLike = Pick<DOMRectReadOnly, 'left' | 'top' | 'width' | 'height'>;

type FlowAnchorName =
  | 'weights-out'
  | 'tokens-in'
  | 'tokens-out'
  | 'embedding-in'
  | 'embedding-out'
  | 'transformer-in'
  | 'transformer-out'
  | 'logits-in'
  | 'logits-selected'
  | 'decode-in'
  | 'decode-loop-out'
  | 'transformer-loop-in';

const FLOW_ANCHOR_NAMES: FlowAnchorName[] = [
  'weights-out',
  'tokens-in',
  'tokens-out',
  'embedding-in',
  'embedding-out',
  'transformer-in',
  'transformer-out',
  'logits-in',
  'logits-selected',
  'decode-in',
  'decode-loop-out',
  'transformer-loop-in'
];

const finite = (value: number) => (Number.isFinite(value) ? value : 0);
const nonNegative = (value: number) => Math.max(0, finite(value));
const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(finite(value), minimum), Math.max(minimum, finite(maximum)));

export function relativeRect(rect: RectLike, container: RectLike): RelativeRect {
  const left = finite(rect.left) - finite(container.left);
  const top = finite(rect.top) - finite(container.top);
  const width = nonNegative(rect.width);
  const height = nonNegative(rect.height);

  return {
    x: left,
    y: top,
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    centerX: left + width / 2,
    centerY: top + height / 2
  };
}

const formatCoordinate = (value: number) => {
  const rounded = Math.round(finite(value) * 1000) / 1000;
  return Object.is(rounded, -0) ? '0' : String(rounded);
};

const pathData = (source: Point, control1: Point, control2: Point, target: Point) =>
  `M ${formatCoordinate(source.x)} ${formatCoordinate(source.y)} C ${formatCoordinate(control1.x)} ${formatCoordinate(control1.y)}, ${formatCoordinate(control2.x)} ${formatCoordinate(control2.y)}, ${formatCoordinate(target.x)} ${formatCoordinate(target.y)}`;

const boundedPoint = (point: Point, width: number, height: number): Point => ({
  x: clamp(point.x, 0, width),
  y: clamp(point.y, 0, height)
});

const forwardBezier = (
  id: Exclude<FlowPathId, 'decode-loop'>,
  sourcePoint: Point,
  targetPoint: Point,
  width: number,
  height: number
): FlowBezier => {
  const source = boundedPoint(sourcePoint, width, height);
  const target = boundedPoint(targetPoint, width, height);
  const deltaX = target.x - source.x;
  const direction = deltaX < 0 ? -1 : 1;
  const handle = Math.min(width * 0.16, Math.max(12, Math.abs(deltaX) * 0.48));
  const control1 = boundedPoint({ x: source.x + direction * handle, y: source.y }, width, height);
  const control2 = boundedPoint({ x: target.x - direction * handle, y: target.y }, width, height);

  return {
    id,
    source,
    control1,
    control2,
    target,
    d: pathData(source, control1, control2, target)
  };
};

const reverseLoopBezier = (
  sourcePoint: Point,
  targetPoint: Point,
  width: number,
  height: number
): FlowBezier => {
  const source = boundedPoint(sourcePoint, width, height);
  const target = boundedPoint(targetPoint, width, height);
  const loopDepth = Math.max(44, Math.min(height * 0.22, 112));
  const loopY = clamp(Math.max(source.y, target.y) + loopDepth, 0, height);
  const control1 = boundedPoint({ x: source.x, y: loopY }, width, height);
  const control2 = boundedPoint({ x: target.x, y: loopY }, width, height);

  return {
    id: 'decode-loop',
    source,
    control1,
    control2,
    target,
    d: pathData(source, control1, control2, target)
  };
};

const anchorCenter = (rect: RelativeRect): Point => ({ x: rect.centerX, y: rect.centerY });

function getFlowAnchors(root: HTMLElement) {
  const anchors = {} as Record<FlowAnchorName, Element>;
  for (const name of FLOW_ANCHOR_NAMES) {
    const anchor = root.querySelector(`[data-flow-anchor="${name}"]`);
    if (!anchor) throw new Error(`Global Flow geometry anchor is missing: ${name}`);
    anchors[name] = anchor;
  }
  return anchors;
}

export function measureFlowGeometry(root: HTMLElement): FlowGeometry {
  const rootBounds = root.getBoundingClientRect();
  const width = nonNegative(rootBounds.width);
  const height = nonNegative(rootBounds.height);
  const elements = getFlowAnchors(root);
  const anchors = {} as Record<FlowAnchorName, RelativeRect>;

  for (const name of FLOW_ANCHOR_NAMES) {
    anchors[name] = relativeRect(elements[name].getBoundingClientRect(), rootBounds);
  }

  const forward = (
    id: Exclude<FlowPathId, 'decode-loop'>,
    source: FlowAnchorName,
    target: FlowAnchorName
  ) => forwardBezier(id, anchorCenter(anchors[source]), anchorCenter(anchors[target]), width, height);

  return {
    width,
    height,
    paths: {
      'weights-to-tokens': forward('weights-to-tokens', 'weights-out', 'tokens-in'),
      'tokens-to-embedding': forward('tokens-to-embedding', 'tokens-out', 'embedding-in'),
      'embedding-to-transformer': forward(
        'embedding-to-transformer',
        'embedding-out',
        'transformer-in'
      ),
      'transformer-to-logits': forward(
        'transformer-to-logits',
        'transformer-out',
        'logits-in'
      ),
      'logits-to-completion': forward(
        'logits-to-completion',
        'logits-selected',
        'decode-in'
      ),
      'decode-loop': reverseLoopBezier(
        anchorCenter(anchors['decode-loop-out']),
        anchorCenter(anchors['transformer-loop-in']),
        width,
        height
      )
    }
  };
}

export function pointOnFlowBezier(path: FlowBezier, progress: number): Point {
  const t = clamp(progress, 0, 1);
  const inverse = 1 - t;
  const sourceWeight = inverse ** 3;
  const control1Weight = 3 * inverse ** 2 * t;
  const control2Weight = 3 * inverse * t ** 2;
  const targetWeight = t ** 3;

  return {
    x:
      sourceWeight * path.source.x +
      control1Weight * path.control1.x +
      control2Weight * path.control2.x +
      targetWeight * path.target.x,
    y:
      sourceWeight * path.source.y +
      control1Weight * path.control1.y +
      control2Weight * path.control2.y +
      targetWeight * path.target.y
  };
}

export function observeFlowGeometry(
  root: HTMLElement,
  onChange: (geometry: FlowGeometry) => void
): () => void {
  let active = true;
  let frameId: number | null = null;

  const scheduleMeasurement = () => {
    if (!active || frameId !== null) return;
    frameId = requestAnimationFrame(() => {
      frameId = null;
      if (active) onChange(measureFlowGeometry(root));
    });
  };

  const ResizeObserverConstructor = globalThis.ResizeObserver;
  const observer =
    typeof ResizeObserverConstructor === 'function'
      ? new ResizeObserverConstructor(scheduleMeasurement)
      : null;
  observer?.observe(root);
  for (const anchor of Object.values(getFlowAnchors(root))) observer?.observe(anchor);

  scheduleMeasurement();
  document.fonts?.ready.then(scheduleMeasurement, () => undefined);

  return () => {
    active = false;
    observer?.disconnect();
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
  };
}
