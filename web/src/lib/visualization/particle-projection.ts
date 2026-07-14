import {
  pointOnFlowBezier,
  type FlowBezier,
  type FlowGeometry,
  type FlowPathId,
  type Point
} from './flow-geometry';
import type {
  GlobalFlowFrame,
  GlobalFlowModel,
  GlobalFlowStageId,
  GlobalFlowStageState
} from './global-flow-model';

export const PARTICLE_DPR_LIMIT = 2;

export type ParticleMotion = 'hidden' | 'traveling' | 'settled' | 'static';

export interface ParticleSpec {
  id: string;
  pathId: FlowPathId;
  stage: GlobalFlowStageId;
  offset: number;
  radius: number;
  laneOffset: number;
  alpha: number;
  tailLength: number;
  travelCycles: number;
  color: string;
}

export interface ParticlePlan {
  seed: number;
  decodeLoopPasses: number;
  fidelity: 'SCHEMATIC';
  particles: ParticleSpec[];
}

export interface ProjectedParticle extends ParticleSpec {
  x: number;
  y: number;
  tailX: number;
  tailY: number;
  phase: number;
  visible: boolean;
  motion: ParticleMotion;
  projectedAlpha: number;
}

export interface ParticleFrame {
  width: number;
  height: number;
  checksum: string;
  movingParticleCount: number;
  particles: ProjectedParticle[];
}

interface PathBudget {
  pathId: FlowPathId;
  stage: GlobalFlowStageId;
  count: number;
  travelCycles: number;
  color: string;
  laneSpread: number;
}

const PATH_BUDGETS: PathBudget[] = [
  {
    pathId: 'weights-to-tokens',
    stage: 'weights',
    count: 22,
    travelCycles: 1.25,
    color: '#5146ff',
    laneSpread: 15
  },
  {
    pathId: 'tokens-to-embedding',
    stage: 'tokens',
    count: 15,
    travelCycles: 1.45,
    color: '#21a6bd',
    laneSpread: 12
  },
  {
    pathId: 'embedding-to-transformer',
    stage: 'embedding',
    count: 30,
    travelCycles: 1.7,
    color: '#21a6bd',
    laneSpread: 19
  },
  {
    pathId: 'transformer-to-logits',
    stage: 'transformer',
    count: 44,
    travelCycles: 2.35,
    color: '#8d77ff',
    laneSpread: 22
  },
  {
    pathId: 'logits-to-completion',
    stage: 'logits',
    count: 20,
    travelCycles: 1.4,
    color: '#5146ff',
    laneSpread: 16
  },
  {
    pathId: 'decode-loop',
    stage: 'completion',
    count: 9,
    travelCycles: 4,
    color: '#35b995',
    laneSpread: 10
  }
];

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const fract = (value: number) => value - Math.floor(value);

const hashNumbers = (values: number[]) => {
  let hash = 0x811c9dc5;
  for (const value of values) {
    let word = value >>> 0;
    for (let byte = 0; byte < 4; byte += 1) {
      hash ^= word & 0xff;
      hash = Math.imul(hash, 0x01000193);
      word >>>= 8;
    }
  }
  return hash >>> 0;
};

const mulberry32 = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const tangentOnBezier = (path: FlowBezier, progress: number): Point => {
  const t = clamp(progress);
  const inverse = 1 - t;
  return {
    x:
      3 * inverse ** 2 * (path.control1.x - path.source.x) +
      6 * inverse * t * (path.control2.x - path.control1.x) +
      3 * t ** 2 * (path.target.x - path.control2.x),
    y:
      3 * inverse ** 2 * (path.control1.y - path.source.y) +
      6 * inverse * t * (path.control2.y - path.control1.y) +
      3 * t ** 2 * (path.target.y - path.control2.y)
  };
};

const offsetPoint = (path: FlowBezier, progress: number, laneOffset: number) => {
  const base = pointOnFlowBezier(path, progress);
  const tangent = tangentOnBezier(path, progress);
  const length = Math.hypot(tangent.x, tangent.y) || 1;
  return {
    x: base.x - (tangent.y / length) * laneOffset,
    y: base.y + (tangent.x / length) * laneOffset
  };
};

const particleState = (
  state: GlobalFlowStageState,
  localProgress: number,
  spec: ParticleSpec,
  reduced: boolean
) => {
  if (state === 'pending') {
    return { visible: false, motion: 'hidden' as const, phase: 0, alpha: 0 };
  }
  if (reduced) {
    return {
      visible: true,
      motion: 'static' as const,
      phase: state === 'complete' ? 1 : 0.5,
      alpha: state === 'complete' ? spec.alpha * 0.22 : spec.alpha * 0.72
    };
  }
  if (state === 'complete') {
    return {
      visible: true,
      motion: 'settled' as const,
      phase: 1,
      alpha: spec.alpha * 0.18
    };
  }
  return {
    visible: true,
    motion: 'traveling' as const,
    phase: fract(clamp(localProgress) * spec.travelCycles + spec.offset),
    alpha: spec.alpha
  };
};

const checksum = (particles: ProjectedParticle[]) => {
  const values = particles.flatMap((particle) => [
    particle.id.length,
    Math.round(particle.phase * 1_000_000),
    particle.visible ? 1 : 0,
    particle.motion === 'traveling' ? 3 : particle.motion === 'settled' ? 2 : particle.motion === 'static' ? 1 : 0
  ]);
  return hashNumbers(values).toString(16).padStart(8, '0');
};

export function createParticlePlan(model: GlobalFlowModel): ParticlePlan {
  const seed = hashNumbers([
    ...model.tokens.items.map((token) => token.id),
    model.transformer.layerCount,
    ...model.generation.generatedTokenIds
  ]);
  const random = mulberry32(seed);
  const particles: ParticleSpec[] = [];

  for (const budget of PATH_BUDGETS) {
    const travelCycles = budget.pathId === 'decode-loop'
      ? Math.max(1, model.generation.decodePassCount)
      : budget.travelCycles;
    for (let index = 0; index < budget.count; index += 1) {
      particles.push({
        id: `${budget.pathId}-${index}`,
        pathId: budget.pathId,
        stage: budget.stage,
        offset: random(),
        radius: 1.25 + random() * 1.85,
        laneOffset: (random() * 2 - 1) * budget.laneSpread,
        alpha: 0.44 + random() * 0.46,
        tailLength: 0.012 + random() * 0.026,
        travelCycles,
        color: budget.color
      });
    }
  }

  return {
    seed,
    decodeLoopPasses: model.generation.decodePassCount,
    fidelity: 'SCHEMATIC',
    particles
  };
}

export function projectParticleFrame(
  plan: ParticlePlan,
  geometry: FlowGeometry,
  frame: GlobalFlowFrame
): ParticleFrame {
  const reduced = frame.motion === 'reduced';
  const particles = plan.particles.map((spec): ProjectedParticle => {
    const isDecodeLoop = spec.pathId === 'decode-loop';
    const stageState = isDecodeLoop && frame.stageState.completion === 'active' && frame.decodeLoopProgress <= 0
      ? 'pending'
      : frame.stageState[spec.stage];
    const state = particleState(
      stageState,
      isDecodeLoop ? frame.decodeLoopProgress : frame.stageProgress[spec.stage],
      spec,
      reduced
    );
    const path = geometry.paths[spec.pathId];
    const point = offsetPoint(path, state.phase, spec.laneOffset);
    const tailPhase = Math.max(0, state.phase - spec.tailLength);
    const tail = offsetPoint(path, tailPhase, spec.laneOffset);

    return {
      ...spec,
      x: point.x,
      y: point.y,
      tailX: tail.x,
      tailY: tail.y,
      phase: state.phase,
      visible: state.visible,
      motion: state.motion,
      projectedAlpha: state.alpha
    };
  });

  return {
    width: geometry.width,
    height: geometry.height,
    checksum: checksum(particles),
    movingParticleCount: particles.filter((particle) => particle.motion === 'traveling').length,
    particles
  };
}
