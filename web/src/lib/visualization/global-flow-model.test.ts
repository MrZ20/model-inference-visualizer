import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildTraceExperience, type TraceExperience } from '$lib/experience/scene-model';
import { buildGlobalFlowModel, projectGlobalFlow } from './global-flow-model';

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

describe('buildGlobalFlowModel', () => {
  it('builds one trace-grounded model for the six-stage overview', () => {
    const model = buildGlobalFlowModel(experience);

    expect(model.weights.shards).toHaveLength(10);
    expect(model.weights.totalCheckpointBytes).toBe(39_767_942_304);
    expect(model.weights.quantization).toMatchObject({
      type: 'W8A8_DYNAMIC',
      quantizedLeafCount: 92_251,
      floatLeafCount: 1_701
    });
    expect(model.tokens.items).toEqual([
      { index: 0, text: 'Hello', id: 9419, textFidelity: 'DERIVED' },
      { index: 1, text: ',', id: 11, textFidelity: 'DERIVED' },
      { index: 2, text: 'my', id: 821, textFidelity: 'DERIVED' },
      { index: 3, text: 'name', id: 803, textFidelity: 'DERIVED' },
      { index: 4, text: 'is', id: 369, textFidelity: 'DERIVED' }
    ]);
    expect(model.embedding).toMatchObject({
      shape: [5, 2048],
      dtype: 'torch.bfloat16',
      sampleCount: 64,
      valueCoverage: 'PREFIX',
      fidelity: 'SUMMARY'
    });
    expect(model.transformer.layers).toHaveLength(40);
    expect(model.transformer).toMatchObject({ layerCount: 40, linearCount: 30, fullCount: 10 });
    expect(model.generation.steps).toHaveLength(5);
    expect(model.generation.steps.map((step) => step.sourcePhase)).toEqual([
      'prefill', 'decode', 'decode', 'decode', 'decode'
    ]);
    expect(model.generation.steps[0]).toMatchObject({
      selectedTokenId: 498,
      logitsShape: [1, 248320]
    });
    expect(model.generation.steps[0].topCandidates).toHaveLength(20);
    expect(model.generation.generatedTokenIds).toEqual([498, 7525, 3855, 1089, 321]);
    expect(model.generation).toMatchObject({
      generatedTokenCount: 5,
      decodePassCount: 4,
      finalText: 'Hello, my name is [Your Name], and'
    });
  });

  it('projects six deterministic semantic stages from one playback progress', () => {
    const model = buildGlobalFlowModel(experience);
    const transformer = projectGlobalFlow(model, 0.6, 'full');
    const generation = projectGlobalFlow(model, 0.9, 'full');
    const complete = projectGlobalFlow(model, 2, 'reduced');

    expect(transformer).toMatchObject({
      progress: 0.6,
      activeStage: 'transformer',
      activeStageIndex: 3,
      activeLayer: 24,
      traversedLayerCount: 24,
      motion: 'full'
    });
    expect(transformer.stageProgress.transformer).toBeCloseTo(0.6);
    expect(generation).toMatchObject({
      activeStage: 'completion',
      activeGenerationDecision: 2,
      completedGenerationDecisions: 2,
      completedDecodePasses: 1
    });
    expect(complete).toMatchObject({
      progress: 1,
      activeStage: 'completion',
      activeStageIndex: 5,
      activeLayer: null,
      traversedLayerCount: 40,
      activeGenerationDecision: null,
      completedGenerationDecisions: 5,
      completedDecodePasses: 4,
      motion: 'reduced'
    });
    expect(projectGlobalFlow(model, 0.6, 'full')).toEqual(transformer);
  });

  it('only marks internal layer and generation cursors active inside their own stage', () => {
    const model = buildGlobalFlowModel(experience);

    expect(projectGlobalFlow(model, 0, 'full')).toMatchObject({
      activeStage: 'weights',
      activeLayer: null,
      activeGenerationDecision: null
    });
    expect(projectGlobalFlow(model, 0.49, 'full')).toMatchObject({
      activeStage: 'embedding',
      activeLayer: null,
      activeGenerationDecision: null
    });
    expect(projectGlobalFlow(model, 0.5, 'full')).toMatchObject({
      activeStage: 'transformer',
      activeLayer: 0,
      activeGenerationDecision: null
    });
    expect(projectGlobalFlow(model, 0.8, 'full')).toMatchObject({
      activeStage: 'logits',
      activeLayer: null,
      activeGenerationDecision: null
    });
    expect(projectGlobalFlow(model, 5 / 6, 'full')).toMatchObject({
      activeStage: 'completion',
      activeLayer: null,
      activeGenerationDecision: 0
    });
  });

  const invalidCases: Array<{
    name: string;
    mutate: (invalid: TraceExperience) => void;
    message: string;
  }> = [
    {
      name: 'checkpoint byte totals',
      mutate: (invalid) => { invalid.initialization.totalWeightBytes += 1; },
      message: 'weight shard bytes'
    },
    {
      name: 'token text and ID cardinality',
      mutate: (invalid) => { invalid.run.promptPieces.pop(); },
      message: 'prompt pieces'
    },
    {
      name: 'embedding width',
      mutate: (invalid) => { invalid.embedding.shape[1] -= 1; },
      message: 'embedding width'
    },
    {
      name: 'retained embedding sample metadata',
      mutate: (invalid) => { invalid.embedding.sampleCount = undefined; },
      message: 'embedding sampleCount is missing'
    },
    {
      name: 'the complete layer list',
      mutate: (invalid) => { invalid.layers.pop(); },
      message: 'layer list'
    },
    {
      name: 'the prefill source for the first selection',
      mutate: (invalid) => { invalid.decode.steps[0].sourcePhase = 'decode'; },
      message: 'first generated token must come from prefill logits'
    },
    {
      name: 'decode provenance after the first selection',
      mutate: (invalid) => { invalid.decode.steps[1].sourcePhase = 'prefill'; },
      message: 'generation decision 1 must be a decode pass'
    },
    {
      name: 'greedy top-1 agreement',
      mutate: (invalid) => { invalid.decode.steps[0].tokenId += 1; },
      message: 'does not match top logit'
    }
  ];

  for (const invalidCase of invalidCases) {
    it(`rejects contradictory ${invalidCase.name} instead of inventing fallback data`, () => {
      const invalid = structuredClone(experience);
      invalidCase.mutate(invalid);

      expect(() => buildGlobalFlowModel(invalid)).toThrow(invalidCase.message);
    });
  }
});
