import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildTraceExperience } from '$lib/experience/scene-model';
import type { FlowBezier, FlowGeometry, FlowPathId, Point } from './flow-geometry';
import { buildGlobalFlowModel, projectGlobalFlow } from './global-flow-model';
import {
  createParticlePlan,
  projectParticleFrame,
  type ParticlePlan
} from './particle-projection';

const RUN_ID = 'qwen35-a3b-w8a8-20260710-p4r4';
const root = resolve(dirname(fileURLToPath(import.meta.url)), `../../../../data/web/${RUN_ID}`);
const read = (path: string) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));

const experience = buildTraceExperience({
  initEvents: read('chapters/init.json'),
  prefillEvents: read('chapters/prefill.json'),
  decodeEvents: read('chapters/decode.json'),
  validation: read('qwen-validation-report.json'),
  attention: read('attention-derived.json'),
  parallel: read('parallel-summary.json'),
  moeQuantization: read('moe-quantization.json'),
  eventCount: 1722
});

const model = buildGlobalFlowModel(experience);
const pathIds: FlowPathId[] = [
  'weights-to-tokens',
  'tokens-to-embedding',
  'embedding-to-transformer',
  'transformer-to-logits',
  'logits-to-completion',
  'decode-loop'
];

const point = (x: number, y: number): Point => ({ x, y });
const bezier = (id: FlowPathId, source: Point, target: Point): FlowBezier => {
  const direction = target.x >= source.x ? 1 : -1;
  const reach = Math.max(48, Math.abs(target.x - source.x) * 0.42);
  const control1 = point(source.x + reach * direction, source.y);
  const control2 = point(target.x - reach * direction, target.y);
  return {
    id,
    source,
    control1,
    control2,
    target,
    d: `M ${source.x} ${source.y} C ${control1.x} ${control1.y}, ${control2.x} ${control2.y}, ${target.x} ${target.y}`
  };
};

const geometry: FlowGeometry = {
  width: 1200,
  height: 480,
  paths: {
    'weights-to-tokens': bezier('weights-to-tokens', point(120, 238), point(180, 238)),
    'tokens-to-embedding': bezier('tokens-to-embedding', point(270, 238), point(330, 238)),
    'embedding-to-transformer': bezier('embedding-to-transformer', point(450, 238), point(500, 238)),
    'transformer-to-logits': bezier('transformer-to-logits', point(850, 238), point(900, 238)),
    'logits-to-completion': bezier('logits-to-completion', point(1020, 238), point(1060, 238)),
    'decode-loop': bezier('decode-loop', point(1140, 330), point(650, 355))
  }
};

const countByPath = (plan: ParticlePlan, pathId: FlowPathId) =>
  plan.particles.filter((particle) => particle.pathId === pathId).length;

describe('deterministic Global Flow particles', () => {
  it('derives one stable bounded plan from trace facts', () => {
    const first = createParticlePlan(model);
    const second = createParticlePlan(model);

    expect(first).toEqual(second);
    expect(first.particles).toHaveLength(140);
    expect(first.decodeLoopPasses).toBe(4);
    expect(pathIds.map((id) => countByPath(first, id))).toEqual([22, 15, 30, 44, 20, 9]);

    const changed = structuredClone(model);
    changed.generation.generatedTokenIds[0] += 1;
    expect(createParticlePlan(changed).seed).not.toBe(first.seed);
  });

  it('projects identical coordinates and checksum for identical progress', () => {
    const plan = createParticlePlan(model);
    const frame = projectGlobalFlow(model, 0.6, 'full');
    const first = projectParticleFrame(plan, geometry, frame);
    const second = projectParticleFrame(plan, geometry, frame);

    expect(first).toEqual(second);
    expect(first.particles).toHaveLength(140);
    expect(first.movingParticleCount).toBeGreaterThan(0);
    expect(first.checksum).toMatch(/^[0-9a-f]{8}$/);
    expect(first.particles.every((particle) =>
      Number.isFinite(particle.x) && Number.isFinite(particle.y)
    )).toBe(true);
  });

  it('moves only from playback progress and settles completed paths', () => {
    const plan = createParticlePlan(model);
    const first = projectParticleFrame(plan, geometry, projectGlobalFlow(model, 0.59, 'full'));
    const second = projectParticleFrame(plan, geometry, projectGlobalFlow(model, 0.61, 'full'));

    expect(second.checksum).not.toBe(first.checksum);
    expect(second.particles.filter((particle) => particle.motion === 'traveling').every(
      (particle) => particle.pathId === 'transformer-to-logits'
    )).toBe(true);
    expect(second.particles.filter((particle) => particle.pathId === 'weights-to-tokens').every(
      (particle) => particle.motion === 'settled'
    )).toBe(true);
    expect(second.particles.filter((particle) => particle.pathId === 'decode-loop').every(
      (particle) => particle.visible === false
    )).toBe(true);
  });

  it('clamps boundaries and returns static markers for reduced motion', () => {
    const plan = createParticlePlan(model);
    const before = projectParticleFrame(plan, geometry, projectGlobalFlow(model, -2, 'full'));
    const start = projectParticleFrame(plan, geometry, projectGlobalFlow(model, 0, 'full'));
    const after = projectParticleFrame(plan, geometry, projectGlobalFlow(model, 2, 'full'));
    const end = projectParticleFrame(plan, geometry, projectGlobalFlow(model, 1, 'full'));
    const reducedA = projectParticleFrame(plan, geometry, projectGlobalFlow(model, 0.59, 'reduced'));
    const reducedB = projectParticleFrame(plan, geometry, projectGlobalFlow(model, 0.61, 'reduced'));

    expect(before).toEqual(start);
    expect(after).toEqual(end);
    expect(reducedA.movingParticleCount).toBe(0);
    expect(reducedA.particles.every((particle) => particle.motion !== 'traveling')).toBe(true);
    expect(reducedB.particles.filter((particle) => particle.pathId === 'transformer-to-logits')
      .map(({ x, y }) => [x, y]))
      .toEqual(reducedA.particles.filter((particle) => particle.pathId === 'transformer-to-logits')
        .map(({ x, y }) => [x, y]));
  });

  it('starts KV-reuse particles only after the prefill selection completes', () => {
    const plan = createParticlePlan(model);
    const duringPrefillSelection = projectParticleFrame(
      plan,
      geometry,
      projectGlobalFlow(model, (5 + 0.1) / 6, 'full')
    );
    const duringFirstDecodePass = projectParticleFrame(
      plan,
      geometry,
      projectGlobalFlow(model, (5 + 0.21) / 6, 'full')
    );

    expect(duringPrefillSelection.particles
      .filter((particle) => particle.pathId === 'decode-loop')
      .every((particle) => particle.motion === 'hidden')).toBe(true);
    expect(duringFirstDecodePass.particles
      .filter((particle) => particle.pathId === 'decode-loop')
      .every((particle) => particle.motion === 'traveling')).toBe(true);
  });
});
