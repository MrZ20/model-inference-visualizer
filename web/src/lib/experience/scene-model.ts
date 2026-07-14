export type TensorSummary = {
  shape: number[];
  dtype?: string;
  device?: string;
  sample?: number[];
  stats?: { min: number; max: number; mean: number; std: number };
};

export type TraceEvent = {
  stage: string;
  fidelity?: string;
  rank?: string;
  phase?: string;
  logicalStep?: { index?: number; kind?: string };
  payload?: Record<string, any>;
};

export interface TraceArtifacts {
  initEvents: TraceEvent[];
  prefillEvents: TraceEvent[];
  decodeEvents: TraceEvent[];
  validation: Record<string, any>;
  attention: Record<string, any>;
  parallel: Record<string, any>;
  moeQuantization: Record<string, any>;
  eventCount?: number;
}

export interface ModelLayer {
  index: number;
  type: 'linear_attention' | 'full_attention';
  fidelity: 'EXACT';
}

export interface TraceExperience {
  run: {
    prompt: string;
    promptPieces: string[];
    promptTokenIds: number[];
    eventCount: number;
    tensorParallelSize: number;
    expertParallel: boolean;
  };
  initialization: {
    model: {
      hiddenSize: number;
      vocabSize: number;
      layerCount: number;
      expertCount: number;
      expertsPerToken: number;
      queryHeads: number;
      kvHeads: number;
      headSize: number;
    };
    quantization: {
      type: string;
      quantizedLeafCount: number;
      floatLeafCount: number;
    };
    weightShards: Array<{ index: number; name: string; bytes: number }>;
    totalWeightBytes: number;
    ranks: Array<{
      rank: number;
      device: string;
      loadDurationMs: number;
      kvCacheDurationMs: number;
      runtimeProbeDurationMs: number;
    }>;
    fidelity: 'EXACT';
  };
  layers: ModelLayer[];
  linearAttention: {
    layerIndex: number;
    module: string;
    rank: number;
    hiddenShape: number[];
    outputShape: number[];
    hiddenStates: TensorSummary;
    output: TensorSummary;
    fidelity: 'SUMMARY';
  };
  fullAttention: {
    layerIndex: number;
    queryShape: number[];
    keyShape: number[];
    valueShape: number[];
    headCount: number;
    headSize: number;
    scale: number;
    probabilityMatrix: number[][];
    heads: Array<{
      displayHead: number;
      rank: number;
      localHead: number;
      kvHead: number;
      scores: Array<Array<number | null>>;
      probabilities: number[][];
    }>;
    rankComparisons: Array<{
      rank: number;
      cosineSimilarity: number;
      maxAbsError: number;
      derivedShape: number[];
      fusedShape: number[];
      derivedSample: number[];
      fusedSample: number[];
    }>;
    fidelity: 'DERIVED';
  };
  moe: {
    expertCount: number;
    expertsPerToken: number;
    tokenRoutes: Array<{ tokenIndex: number; expertIds: number[]; weights: number[] }>;
    ranks: Array<{
      rank: number;
      device: string;
      dispatch: TensorSummary;
      dispatchScale: TensorSummary;
      gmm1Activation: TensorSummary;
      gmm1Scale: TensorSummary;
      gmm2Output: TensorSummary;
      combinedOutput: TensorSummary;
    }>;
    fidelity: 'SUMMARY';
  };
  tensorParallel: {
    size: number;
    expertParallel: boolean;
    ranks: Array<{
      rank: number;
      device: string;
      qkvWeightShape: number[];
      qkvOutputShape: number[];
      localLogitsShape: number[];
      queryHeads: number;
      kvHeads: number;
      spans: Array<{ stage: string; durationMs: number; outputShape: number[] }>;
    }>;
    fidelity: 'SUMMARY';
  };
  decode: {
    prompt: string;
    finalText: string;
    completion: string;
    steps: Array<{
      index: number;
      tokenId: number;
      logitsShape: number[];
      topCandidates: Array<{ tokenId: number; logit: number }>;
    }>;
    fidelity: 'EXACT';
  };
}

const requireEvent = (events: TraceEvent[], stage: string) => {
  const event = events.find((candidate) => candidate.stage === stage);
  if (!event?.payload) throw new Error(`p4r4 trace is missing ${stage}`);
  return event;
};

const rankDuration = (events: TraceEvent[], suffix: string, rank: number) => {
  const event = events.find(
    (candidate) => candidate.rank === String(rank) && candidate.stage.endsWith(suffix)
  );
  const durationNs = event?.payload?.durationNs;
  if (typeof durationNs !== 'number') throw new Error(`p4r4 trace is missing rank ${rank} ${suffix}`);
  return durationNs / 1_000_000;
};

const tensor = (value: any, label: string): TensorSummary => {
  if (!Array.isArray(value?.shape)) throw new Error(`p4r4 trace is missing ${label}`);
  return {
    shape: value.shape,
    dtype: value.dtype,
    device: value.device,
    sample: value.sample,
    stats: value.stats
  };
};

export function buildTraceExperience(artifacts: TraceArtifacts): TraceExperience {
  const modelConfig = requireEvent(artifacts.initEvents, 'model.config');
  const quantization = requireEvent(artifacts.initEvents, 'model.quantization');
  const weightShards = requireEvent(artifacts.initEvents, 'model.weight_shards');
  const runStart = requireEvent(artifacts.initEvents, 'run.start');
  const runOutput = requireEvent(artifacts.initEvents, 'run.output');
  const layerTypes = modelConfig.payload?.layerTypes;
  if (!Array.isArray(layerTypes) || layerTypes.length !== modelConfig.payload?.num_hidden_layers) {
    throw new Error('p4r4 model.config is missing an exact layerTypes list');
  }

  const outputTokenIds = runOutput.payload?.outputs?.[0]?.tokenIds;
  const promptTokenCount = artifacts.validation.promptTokenCount;
  if (!Array.isArray(outputTokenIds) || typeof promptTokenCount !== 'number') {
    throw new Error('p4r4 trace is missing prompt token IDs');
  }
  const prompt = runStart.payload?.prompts?.[0];
  if (typeof prompt !== 'string') throw new Error('p4r4 trace is missing the prompt');

  const linearAttention = artifacts.prefillEvents.find(
    (event) => event.stage === 'tensor.linear_attention.layer0' && event.rank === '0'
  ) ?? artifacts.prefillEvents.find((event) => event.stage === 'tensor.linear_attention.layer0');
  if (!linearAttention?.payload?.hiddenStates?.shape || !linearAttention.payload.output?.shape) {
    throw new Error('p4r4 prefill trace is missing the layer-0 linear-attention representative');
  }

  const qkvShapes = artifacts.validation.qkvShapes;
  const attentionOverview = artifacts.attention.overview;
  const attentionRanks = artifacts.attention.ranks;
  if (!qkvShapes?.query || !attentionOverview?.meanProbabilityMatrix || !Array.isArray(attentionRanks)) {
    throw new Error('p4r4 trace is missing the layer-3 full-attention projection');
  }

  const generatedTokenIds = artifacts.validation.generatedTokenIds;
  const logitsShapes = artifacts.validation.logitsShapes;
  if (!Array.isArray(generatedTokenIds) || generatedTokenIds.length !== logitsShapes?.length) {
    throw new Error('p4r4 validation has inconsistent decode tokens and logits');
  }

  const firstMoeStep = artifacts.moeQuantization.steps?.find(
    (step: any) => step.rank === '0' && step.phase === 'prefill' && step.logicalStep?.index === 0
  );
  const routeIds = firstMoeStep?.events?.routing?.payload?.topkIds?.sample;
  const routeWeights = firstMoeStep?.events?.routing?.payload?.topkWeights?.sample;
  const expertsPerToken = modelConfig.payload?.num_experts_per_tok;
  if (!Array.isArray(routeIds) || !Array.isArray(routeWeights) || typeof expertsPerToken !== 'number') {
    throw new Error('p4r4 trace is missing MoE top-k routing');
  }

  const rankZeroPrefillLogits = artifacts.prefillEvents.find(
    (event) => event.rank === '0' && event.stage === 'tensor.logits' && event.logicalStep?.kind === 'prefill'
  );
  const decodeLogits = artifacts.decodeEvents
    .filter(
      (event) => event.rank === '0' && event.stage === 'tensor.logits' && event.logicalStep?.kind === 'decode'
    )
    .sort((left, right) => (left.logicalStep?.index ?? 0) - (right.logicalStep?.index ?? 0));
  const generationLogits = [rankZeroPrefillLogits, ...decodeLogits].filter(
    (event): event is TraceEvent => Boolean(event?.payload)
  );

  const ranks = [0, 1];
  const parallelRanks = ranks.map((rank) => {
    const rankText = String(rank);
    const qkvShard = artifacts.parallel.moduleShards?.find(
      (shard: any) => shard.rank === rankText && shard.spanStage === 'layer3.qkv_projection'
    );
    const attentionShard = artifacts.parallel.moduleShards?.find(
      (shard: any) => shard.rank === rankText && shard.spanStage === 'layer3.fused_attention'
    );
    const qkvWeight = qkvShard?.localParameters?.find((parameter: any) => parameter.name === 'weight')?.tensor;
    const spans = artifacts.parallel.spans?.filter(
      (span: any) => span.rank === rankText && span.phase === 'prefill' && span.logicalStep?.index === 0
    );
    const localLogits = artifacts.prefillEvents.find(
      (event) => event.rank === rankText && event.stage === 'tensor.logits'
    )?.payload;
    if (!qkvWeight?.shape || !attentionShard?.attributes || !Array.isArray(spans) || !localLogits?.shape) {
      throw new Error(`p4r4 trace is missing tensor-parallel rank ${rank}`);
    }
    const qkvSpan = spans.find((span: any) => span.stage === 'layer3.qkv_projection');
    return {
      rank,
      device: `npu:${rank}`,
      qkvWeightShape: qkvWeight.shape,
      qkvOutputShape: qkvSpan.output.shape,
      localLogitsShape: localLogits.shape,
      queryHeads: attentionShard.attributes.num_heads,
      kvHeads: attentionShard.attributes.num_kv_heads,
      spans: spans.map((span: any) => ({
        stage: span.stage,
        durationMs: span.durationNs / 1_000_000,
        outputShape: span.output.shape
      }))
    };
  });

  const moeRanks = ranks.map((rank) => {
    const step = artifacts.moeQuantization.steps?.find(
      (candidate: any) => candidate.rank === String(rank) && candidate.phase === 'prefill' && candidate.logicalStep?.index === 0
    );
    const events = step?.events;
    if (!events) throw new Error(`p4r4 trace is missing MoE rank ${rank}`);
    return {
      rank,
      device: `npu:${rank}`,
      dispatch: tensor(events.dispatch?.payload?.quantizedHiddenStates, `MoE rank ${rank} dispatch`),
      dispatchScale: tensor(events.dispatch?.payload?.dynamicScale, `MoE rank ${rank} dispatch scale`),
      gmm1Activation: tensor(events.gmm1Output?.payload?.quantizedActivation, `MoE rank ${rank} GMM1 output`),
      gmm1Scale: tensor(events.gmm1Output?.payload?.outputScale, `MoE rank ${rank} GMM1 scale`),
      gmm2Output: tensor(events.gmm2Output?.payload?.output, `MoE rank ${rank} GMM2 output`),
      combinedOutput: tensor(events.combine?.payload?.routedOutput, `MoE rank ${rank} combine`)
    };
  });

  return {
    run: {
      prompt,
      promptPieces: prompt.match(/[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu) ?? [prompt],
      promptTokenIds: outputTokenIds.slice(0, promptTokenCount),
      eventCount: artifacts.eventCount ?? 0,
      tensorParallelSize: runStart.payload?.tensorParallelSize,
      expertParallel: runStart.payload?.expertParallel
    },
    initialization: {
      model: {
        hiddenSize: modelConfig.payload?.hidden_size,
        vocabSize: modelConfig.payload?.vocab_size,
        layerCount: modelConfig.payload?.num_hidden_layers,
        expertCount: modelConfig.payload?.num_experts,
        expertsPerToken: modelConfig.payload?.num_experts_per_tok,
        queryHeads: modelConfig.payload?.num_attention_heads,
        kvHeads: modelConfig.payload?.num_key_value_heads,
        headSize: modelConfig.payload?.head_dim
      },
      quantization: {
        type: quantization.payload?.modelQuantType,
        quantizedLeafCount: quantization.payload?.leafTypeCounts?.W8A8_DYNAMIC,
        floatLeafCount: quantization.payload?.leafTypeCounts?.FLOAT
      },
      weightShards: weightShards.payload?.shards?.map((shard: any, index: number) => ({
        index,
        name: shard.name,
        bytes: shard.bytes
      })),
      totalWeightBytes: weightShards.payload?.totalBytes,
      ranks: ranks.map((rank) => ({
        rank,
        device: `npu:${rank}`,
        loadDurationMs: rankDuration(artifacts.initEvents, 'NPUModelRunner.load_model.end', rank),
        kvCacheDurationMs: rankDuration(artifacts.initEvents, 'NPUModelRunner.initialize_kv_cache.end', rank),
        runtimeProbeDurationMs: rankDuration(artifacts.initEvents, 'NPUModelRunner.execute_model.end', rank)
      })),
      fidelity: 'EXACT'
    },
    layers: layerTypes.map((type, index) => {
      if (type !== 'linear_attention' && type !== 'full_attention') {
        throw new Error(`Unsupported layer type at index ${index}: ${String(type)}`);
      }
      return { index, type, fidelity: 'EXACT' as const };
    }),
    linearAttention: {
      layerIndex: 0,
      module: linearAttention.payload.module,
      rank: Number(linearAttention.rank ?? 0),
      hiddenShape: linearAttention.payload.hiddenStates.shape,
      outputShape: linearAttention.payload.output.shape,
      hiddenStates: tensor(linearAttention.payload.hiddenStates, 'linear-attention hidden states'),
      output: tensor(linearAttention.payload.output, 'linear-attention output'),
      fidelity: 'SUMMARY'
    },
    fullAttention: {
      layerIndex: 3,
      queryShape: qkvShapes.query,
      keyShape: qkvShapes.key,
      valueShape: qkvShapes.value,
      headCount: attentionOverview.headCount,
      headSize: attentionRanks[0].headSize,
      scale: attentionRanks[0].scale,
      probabilityMatrix: attentionOverview.meanProbabilityMatrix,
      heads: attentionRanks.flatMap((rank: any) => rank.heads.map((head: any) => ({
        displayHead: head.displayHead,
        rank: Number(rank.rank),
        localHead: head.localHead,
        kvHead: head.kvHead,
        scores: head.scores,
        probabilities: head.probabilities
      }))),
      rankComparisons: attentionRanks.map((rank: any) => ({
        rank: Number(rank.rank),
        cosineSimilarity: rank.outputComparison.cosineSimilarity,
        maxAbsError: rank.outputComparison.maxAbsError,
        derivedShape: rank.outputComparison.derivedShape,
        fusedShape: rank.outputComparison.fusedShape,
        derivedSample: rank.outputComparison.derivedSample,
        fusedSample: rank.outputComparison.fusedSample
      })),
      fidelity: 'DERIVED'
    },
    moe: {
      expertCount: modelConfig.payload?.num_experts,
      expertsPerToken,
      tokenRoutes: Array.from({ length: promptTokenCount }, (_, tokenIndex) => ({
        tokenIndex,
        expertIds: routeIds.slice(tokenIndex * expertsPerToken, (tokenIndex + 1) * expertsPerToken),
        weights: routeWeights.slice(tokenIndex * expertsPerToken, (tokenIndex + 1) * expertsPerToken)
      })),
      ranks: moeRanks,
      fidelity: 'SUMMARY'
    },
    tensorParallel: {
      size: artifacts.parallel.configured?.tensorParallelSize,
      expertParallel: artifacts.parallel.configured?.expertParallel,
      ranks: parallelRanks,
      fidelity: 'SUMMARY'
    },
    decode: {
      prompt,
      finalText: artifacts.validation.finalText,
      completion: artifacts.validation.finalText.slice(prompt.length),
      steps: generatedTokenIds.map((tokenId: number, index: number) => {
        const logits = generationLogits[index]?.payload;
        const indices = logits?.topk?.indices?.[0] ?? [];
        const values = logits?.topk?.values?.[0] ?? [];
        return {
          index,
          tokenId,
          logitsShape: logitsShapes[index],
          topCandidates: indices.slice(0, 5).map((candidateId: number, candidateIndex: number) => ({
            tokenId: candidateId,
            logit: values[candidateIndex]
          }))
        };
      }),
      fidelity: 'EXACT'
    }
  };
}
