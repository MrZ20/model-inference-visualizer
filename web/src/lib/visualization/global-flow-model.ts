import type { ModelLayer, TensorSummary, TraceExperience } from '$lib/experience/scene-model';

export type GlobalFlowStageId =
  | 'weights'
  | 'tokens'
  | 'embedding'
  | 'transformer'
  | 'logits'
  | 'completion';

export type GlobalFlowMotion = 'full' | 'reduced';
export type GlobalFlowStageState = 'pending' | 'active' | 'complete';

export interface GlobalFlowFrame {
  progress: number;
  motion: GlobalFlowMotion;
  activeStage: GlobalFlowStageId;
  activeStageIndex: number;
  stageProgress: Record<GlobalFlowStageId, number>;
  stageState: Record<GlobalFlowStageId, GlobalFlowStageState>;
  shardProgress: number[];
  tokenProgress: number[];
  embeddingRowProgress: number[];
  activeLayer: number | null;
  traversedLayerCount: number;
  activeGenerationDecision: number | null;
  completedGenerationDecisions: number;
  completedDecodePasses: number;
  decodeLoopProgress: number;
}

export interface GlobalFlowModel {
  weights: {
    shards: Array<{
      index: number;
      name: string;
      bytes: number;
      normalizedSize: number;
    }>;
    totalCheckpointBytes: number;
    quantization: {
      type: string;
      quantizedLeafCount: number;
      floatLeafCount: number;
    };
    tensorParallelSize: number;
    expertParallel: boolean;
    fidelity: 'EXACT';
  };
  tokens: {
    prompt: string;
    items: Array<{
      index: number;
      text: string;
      id: number;
      textFidelity: 'DERIVED';
    }>;
    idsFidelity: 'EXACT';
  };
  embedding: TensorSummary & {
    rank: number;
    sampleCount: number;
    valueCoverage: 'PREFIX';
    fidelity: 'SUMMARY';
  };
  transformer: {
    layerCount: number;
    linearCount: number;
    fullCount: number;
    layers: ModelLayer[];
    fidelity: 'EXACT';
  };
  generation: {
    steps: Array<{
      outputIndex: number;
      sourcePhase: 'prefill' | 'decode';
      logicalStepIndex: number;
      logitsShape: number[];
      topCandidates: Array<{ tokenId: number; logit: number }>;
      selectedTokenId: number;
      logitsFidelity: 'SUMMARY';
      selectionFidelity: 'EXACT';
    }>;
    generatedTokenIds: number[];
    generatedTokenCount: number;
    decodePassCount: number;
    prompt: string;
    completion: string;
    finalText: string;
    outputFidelity: 'EXACT';
    partialTextFidelity: 'SCHEMATIC';
    kvLoopFidelity: 'STRUCTURAL';
  };
}

const fail = (message: string): never => {
  throw new Error(`Global Flow invariant failed: ${message}`);
};

const sameShape = (left: number[], right: number[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const STAGES: GlobalFlowStageId[] = [
  'weights',
  'tokens',
  'embedding',
  'transformer',
  'logits',
  'completion'
];

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const PROGRESS_EPSILON = 1e-9;

const stageLocalProgress = (progress: number, index: number) =>
  clamp((progress - index / STAGES.length) * STAGES.length);

const sequenceProgress = (progress: number, index: number, count: number) => {
  if (count <= 0) return 0;
  const start = 0.1;
  const end = 0.9;
  const slot = (end - start) / count;
  return clamp((progress - start - index * slot) / slot);
};

export function buildGlobalFlowModel(experience: TraceExperience): GlobalFlowModel {
  const { initialization, run, embedding, layers, decode } = experience;
  const shards = initialization.weightShards;
  if (!shards.length) fail('weight shards are missing');

  const shardBytes = shards.reduce((total, shard) => total + shard.bytes, 0);
  if (shardBytes !== initialization.totalWeightBytes) {
    fail(`weight shard bytes ${shardBytes} do not equal checkpoint bytes ${initialization.totalWeightBytes}`);
  }
  const largestShard = Math.max(...shards.map((shard) => shard.bytes));

  if (run.promptPieces.length !== run.promptTokenIds.length) {
    fail(`prompt pieces (${run.promptPieces.length}) do not match token IDs (${run.promptTokenIds.length})`);
  }
  if (embedding.shape.length !== 2) fail(`embedding shape must be rank 2, received [${embedding.shape}]`);
  if (embedding.shape[0] !== run.promptTokenIds.length) {
    fail(`embedding rows ${embedding.shape[0]} do not match token count ${run.promptTokenIds.length}`);
  }
  if (embedding.shape[1] !== initialization.model.hiddenSize) {
    fail(`embedding width ${embedding.shape[1]} does not match hidden size ${initialization.model.hiddenSize}`);
  }
  const embeddingSampleCount = embedding.sampleCount ?? fail('embedding sampleCount is missing');
  if (embeddingSampleCount !== embedding.sample?.length) {
    fail('embedding sampleCount does not match the retained prefix sample');
  }

  if (layers.length !== initialization.model.layerCount) {
    fail(`layer list ${layers.length} does not match configured layer count ${initialization.model.layerCount}`);
  }
  const linearCount = layers.filter((layer) => layer.type === 'linear_attention').length;
  const fullCount = layers.filter((layer) => layer.type === 'full_attention').length;
  if (linearCount + fullCount !== layers.length) fail('linear and full layer counts are inconsistent');

  if (!decode.steps.length) fail('generation decisions are missing');
  if (decode.steps[0].sourcePhase !== 'prefill') fail('the first generated token must come from prefill logits');

  const generationSteps = decode.steps.map((step, index) => {
    if (index > 0 && step.sourcePhase !== 'decode') {
      fail(`generation decision ${index} must be a decode pass`);
    }
    if (!sameShape(step.logitsShape, [1, initialization.model.vocabSize])) {
      fail(`generation decision ${index} has invalid logits shape [${step.logitsShape}]`);
    }
    if (!step.topCandidates.length) fail(`generation decision ${index} has no top logits`);
    if (step.topCandidates[0].tokenId !== step.tokenId) {
      fail(`generation decision ${index} selected token ${step.tokenId} does not match top logit ${step.topCandidates[0].tokenId}`);
    }
    return {
      outputIndex: index,
      sourcePhase: step.sourcePhase,
      logicalStepIndex: step.logicalStepIndex,
      logitsShape: [...step.logitsShape],
      topCandidates: step.topCandidates.map((candidate) => ({ ...candidate })),
      selectedTokenId: step.tokenId,
      logitsFidelity: step.logitsFidelity,
      selectionFidelity: step.selectionFidelity
    };
  });

  const generatedTokenIds = generationSteps.map((step) => step.selectedTokenId);
  const decodePassCount = generationSteps.filter((step) => step.sourcePhase === 'decode').length;

  return {
    weights: {
      shards: shards.map((shard) => ({
        ...shard,
        normalizedSize: shard.bytes / largestShard
      })),
      totalCheckpointBytes: initialization.totalWeightBytes,
      quantization: { ...initialization.quantization },
      tensorParallelSize: run.tensorParallelSize,
      expertParallel: run.expertParallel,
      fidelity: 'EXACT'
    },
    tokens: {
      prompt: run.prompt,
      items: run.promptPieces.map((text, index) => ({
        index,
        text,
        id: run.promptTokenIds[index],
        textFidelity: 'DERIVED'
      })),
      idsFidelity: 'EXACT'
    },
    embedding: {
      ...embedding,
      sampleCount: embeddingSampleCount,
      fidelity: 'SUMMARY'
    },
    transformer: {
      layerCount: layers.length,
      linearCount,
      fullCount,
      layers: layers.map((layer) => ({ ...layer })),
      fidelity: 'EXACT'
    },
    generation: {
      steps: generationSteps,
      generatedTokenIds,
      generatedTokenCount: generationSteps.length,
      decodePassCount,
      prompt: decode.prompt,
      completion: decode.completion,
      finalText: decode.finalText,
      outputFidelity: 'EXACT',
      partialTextFidelity: 'SCHEMATIC',
      kvLoopFidelity: 'STRUCTURAL'
    }
  };
}

export function projectGlobalFlow(
  model: GlobalFlowModel,
  progress: number,
  motion: GlobalFlowMotion
): GlobalFlowFrame {
  const normalizedProgress = clamp(progress);
  const activeStageIndex = normalizedProgress >= 1
    ? STAGES.length - 1
    : Math.floor(normalizedProgress * STAGES.length);
  const stageProgress = Object.fromEntries(
    STAGES.map((stage, index) => [stage, stageLocalProgress(normalizedProgress, index)])
  ) as Record<GlobalFlowStageId, number>;
  const stageState = Object.fromEntries(
    STAGES.map((stage, index) => [
      stage,
      index < activeStageIndex || normalizedProgress >= 1
        ? 'complete'
        : index === activeStageIndex
          ? 'active'
          : 'pending'
    ])
  ) as Record<GlobalFlowStageId, GlobalFlowStageState>;

  const transformerProgress = stageProgress.transformer;
  const traversedLayerCount = Math.min(
    model.transformer.layerCount,
    Math.floor(transformerProgress * model.transformer.layerCount + PROGRESS_EPSILON)
  );
  const activeLayer = stageState.transformer === 'active'
    ? Math.min(
        model.transformer.layerCount - 1,
        Math.floor(transformerProgress * model.transformer.layerCount + PROGRESS_EPSILON)
      )
    : null;

  const completionProgress = stageProgress.completion;
  const decisionCount = model.generation.steps.length;
  const completedGenerationDecisions = Math.min(
    decisionCount,
    Math.floor(completionProgress * decisionCount + PROGRESS_EPSILON)
  );
  const activeGenerationDecision = stageState.completion === 'active'
    ? Math.min(
        decisionCount - 1,
        Math.floor(completionProgress * decisionCount + PROGRESS_EPSILON)
      )
    : null;
  const completedDecodePasses = model.generation.steps
    .slice(0, completedGenerationDecisions)
    .filter((step) => step.sourcePhase === 'decode').length;
  const prefillDecisionCount = decisionCount - model.generation.decodePassCount;
  const decodeStart = prefillDecisionCount / decisionCount;
  const decodeLoopProgress = clamp(
    (completionProgress - decodeStart) / Math.max(PROGRESS_EPSILON, 1 - decodeStart)
  );

  return {
    progress: normalizedProgress,
    motion,
    activeStage: STAGES[activeStageIndex],
    activeStageIndex,
    stageProgress,
    stageState,
    shardProgress: model.weights.shards.map((_, index) =>
      sequenceProgress(stageProgress.weights, index, model.weights.shards.length)
    ),
    tokenProgress: model.tokens.items.map((_, index) =>
      sequenceProgress(stageProgress.tokens, index, model.tokens.items.length)
    ),
    embeddingRowProgress: model.tokens.items.map((_, index) =>
      sequenceProgress(stageProgress.embedding, index, model.tokens.items.length)
    ),
    activeLayer,
    traversedLayerCount,
    activeGenerationDecision,
    completedGenerationDecisions,
    completedDecodePasses,
    decodeLoopProgress
  };
}
