import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildTraceExperience } from './scene-model';

const RUN_ID = 'qwen35-a3b-w8a8-20260710-p4r4';
const root = resolve(dirname(fileURLToPath(import.meta.url)), `../../../../data/web/${RUN_ID}`);
const read = (path: string) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));

const artifacts = {
  initEvents: read('chapters/init.json'),
  prefillEvents: read('chapters/prefill.json'),
  decodeEvents: read('chapters/decode.json'),
  validation: read('qwen-validation-report.json'),
  attention: read('attention-derived.json'),
  parallel: read('parallel-summary.json'),
  moeQuantization: read('moe-quantization.json')
};

describe('buildTraceExperience', () => {
  it('projects the exact 40-layer architecture from the p4r4 model.config event', () => {
    const experience = buildTraceExperience(artifacts);

    expect(experience.layers).toHaveLength(40);
    expect(experience.layers.filter((layer) => layer.type === 'linear_attention')).toHaveLength(30);
    expect(experience.layers.filter((layer) => layer.type === 'full_attention')).toHaveLength(10);
    expect(experience.layers[0]).toEqual({ index: 0, type: 'linear_attention', fidelity: 'EXACT' });
    expect(experience.layers[3]).toEqual({ index: 3, type: 'full_attention', fidelity: 'EXACT' });
  });

  it('projects the captured layer-0 linear-attention representative', () => {
    const experience = buildTraceExperience(artifacts);

    expect(experience.linearAttention).toMatchObject({
      layerIndex: 0,
      module: 'QwenGatedDeltaNetAttention',
      rank: 0,
      hiddenShape: [5, 2048],
      outputShape: [5, 2048],
      hiddenStates: { shape: [5, 2048], dtype: 'torch.bfloat16', device: 'npu:0' },
      output: { shape: [5, 2048], dtype: 'torch.bfloat16', device: 'npu:0' },
      fidelity: 'SUMMARY'
    });
    expect(experience.linearAttention.hiddenStates.sample).toHaveLength(64);
    expect(experience.linearAttention.output.stats?.std).toBeCloseTo(0.0162337776);
  });

  it('projects the derived layer-3 full-attention representative', () => {
    const experience = buildTraceExperience(artifacts);

    expect(experience.fullAttention.layerIndex).toBe(3);
    expect(experience.fullAttention.queryShape).toEqual([5, 2048]);
    expect(experience.fullAttention.keyShape).toEqual([5, 256]);
    expect(experience.fullAttention.valueShape).toEqual([5, 256]);
    expect(experience.fullAttention.headCount).toBe(16);
    expect(experience.fullAttention.heads).toHaveLength(16);
    expect(experience.fullAttention.heads[0]).toMatchObject({ displayHead: 0, rank: 0, localHead: 0, kvHead: 0 });
    expect(experience.fullAttention.heads[8]).toMatchObject({ displayHead: 8, rank: 1, localHead: 0, kvHead: 0 });
    expect(experience.fullAttention.probabilityMatrix[1]).toEqual([0.5858675071252931, 0.41413249287470694, 0, 0, 0]);
    expect(experience.fullAttention.fidelity).toBe('DERIVED');
  });

  it('projects all five exact decode steps from p4r4 validation', () => {
    const experience = buildTraceExperience(artifacts);

    expect(experience.decode.finalText).toBe('Hello, my name is [Your Name], and');
    expect(experience.decode.steps).toEqual([
      expect.objectContaining({ index: 0, tokenId: 498, logitsShape: [1, 248320] }),
      expect.objectContaining({ index: 1, tokenId: 7525, logitsShape: [1, 248320] }),
      expect.objectContaining({ index: 2, tokenId: 3855, logitsShape: [1, 248320] }),
      expect.objectContaining({ index: 3, tokenId: 1089, logitsShape: [1, 248320] }),
      expect.objectContaining({ index: 4, tokenId: 321, logitsShape: [1, 248320] })
    ]);
    expect(experience.decode.steps[0].topCandidates[0]).toMatchObject({ tokenId: 498 });
    expect(experience.decode.steps[4].topCandidates[0]).toMatchObject({ tokenId: 321 });
    expect(experience.decode.fidelity).toBe('EXACT');
  });

  it('projects initialization, MoE quantization and both tensor-parallel lanes', () => {
    const experience = buildTraceExperience(artifacts);

    expect(experience.run.promptTokenIds).toEqual([9419, 11, 821, 803, 369]);
    expect(experience.run.promptPieces).toEqual(['Hello', ',', 'my', 'name', 'is']);
    expect(experience.initialization.weightShards).toHaveLength(10);
    expect(experience.initialization.quantization.type).toBe('W8A8_DYNAMIC');
    expect(experience.initialization.ranks[0].loadDurationMs).toBeGreaterThan(54_000);
    expect(experience.moe.tokenRoutes[0]).toEqual({
      tokenIndex: 0,
      expertIds: [214, 202, 163, 113, 123, 108, 171, 75],
      weights: [0.166015625, 0.15625, 0.1533203125, 0.12890625, 0.11083984375, 0.1005859375, 0.0947265625, 0.0888671875]
    });
    expect(experience.moe.ranks[0].dispatch.shape).toEqual([40, 2048]);
    expect(experience.moe.ranks[1].gmm1Activation.shape).toEqual([40, 256]);
    expect(experience.tensorParallel.ranks).toHaveLength(2);
    expect(experience.tensorParallel.ranks[0]).toMatchObject({
      device: 'npu:0',
      qkvWeightShape: [2048, 4608],
      qkvOutputShape: [5, 4608],
      localLogitsShape: [1, 248320],
      queryHeads: 8,
      kvHeads: 1
    });
  });

  it('rejects a trace that cannot prove the layer architecture', () => {
    const invalid = structuredClone(artifacts);
    invalid.initEvents.find((event: any) => event.stage === 'model.config').payload.layerTypes = [];

    expect(() => buildTraceExperience(invalid)).toThrow('missing an exact layerTypes list');
  });
});
