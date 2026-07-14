<script lang="ts">
  import { onMount } from 'svelte';
  import type { TraceExperience } from '$lib/experience/scene-model';
  import type { Locale, SceneId } from '$lib/playback/engine';
  import { createCatalog } from '$lib/i18n/catalog';
  import FlowRibbons from '$lib/components/global-flow/FlowRibbons.svelte';
  import ParticleField from '$lib/components/global-flow/ParticleField.svelte';
  import {
    measureFlowGeometry,
    observeFlowGeometry,
    type FlowGeometry
  } from '$lib/visualization/flow-geometry';
  import {
    buildGlobalFlowModel,
    projectGlobalFlow,
    type GlobalFlowMotion
  } from '$lib/visualization/global-flow-model';
  import {
    createParticlePlan,
    projectParticleFrame
  } from '$lib/visualization/particle-projection';

  export let experience: TraceExperience;
  export let progress = 0;
  export let locale: Locale = 'en';
  export let motion: GlobalFlowMotion = 'full';
  export let onNavigate: (scene: SceneId) => void;

  let rootElement: HTMLDivElement;
  let geometry: FlowGeometry | null = null;
  let localeMeasurementFrame: number | null = null;

  $: t = createCatalog(locale);
  $: model = buildGlobalFlowModel(experience);
  $: frame = projectGlobalFlow(model, progress, motion);
  $: particlePlan = createParticlePlan(model);
  $: particleFrame = geometry ? projectParticleFrame(particlePlan, geometry, frame) : null;
  $: generationDecisionIndex = frame.activeGenerationDecision ?? (
    frame.stageState.completion === 'complete'
      ? model.generation.steps.length - 1
      : Math.max(0, frame.completedGenerationDecisions - 1)
  );
  $: generationDecision = model.generation.steps[generationDecisionIndex];
  $: visibleCandidates = generationDecision.topCandidates.slice(0, 8);
  $: candidateMinimum = Math.min(...visibleCandidates.map((candidate) => candidate.logit));
  $: candidateMaximum = Math.max(...visibleCandidates.map((candidate) => candidate.logit));
  $: completionIsExact = frame.completedGenerationDecisions >= model.generation.generatedTokenCount;
  $: completionRevealLength = Math.round(
    model.generation.completion.length * frame.completedGenerationDecisions / model.generation.generatedTokenCount
  );
  $: visibleCompletionText = completionIsExact
    ? model.generation.finalText
    : `${model.generation.prompt}${model.generation.completion.slice(0, completionRevealLength)} …`;
  $: prefillSelectionCount = model.generation.generatedTokenCount - model.generation.decodePassCount;

  const formatShape = (shape: number[]) => `[${shape.join(', ')}]`;
  const gibibytes = (bytes: number) => `${(bytes / 2 ** 30).toFixed(1)} GiB`;
  const cellValue = (row: number, column: number) =>
    ((experience.run.promptTokenIds[row] * 17 + column * 29 + row * 11) % 100) / 100;
  const candidateHeight = (logit: number) => {
    const span = candidateMaximum - candidateMinimum;
    return span === 0 ? 0.72 : 0.28 + ((logit - candidateMinimum) / span) * 0.72;
  };

  onMount(() => {
    const stopObserving = observeFlowGeometry(rootElement, (nextGeometry) => {
      geometry = nextGeometry;
    });
    return () => {
      stopObserving();
      if (localeMeasurementFrame !== null) cancelAnimationFrame(localeMeasurementFrame);
    };
  });

  $: if (rootElement && locale) {
    if (localeMeasurementFrame !== null) cancelAnimationFrame(localeMeasurementFrame);
    localeMeasurementFrame = requestAnimationFrame(() => {
      localeMeasurementFrame = null;
      geometry = measureFlowGeometry(rootElement);
    });
  }
</script>

<div
  bind:this={rootElement}
  class="global-flow-experience"
  data-active-stage={frame.activeStage}
  data-active-layer={frame.activeLayer ?? 'none'}
  data-motion-progress={frame.progress.toFixed(3)}
  data-motion={motion}
  data-particle-seed={particlePlan.seed}
  data-particle-checksum={particleFrame?.checksum ?? 'unmeasured'}
>
  <div class="flow-depth-grid" aria-hidden="true"></div>
  <FlowRibbons {geometry} {frame} />
  <ParticleField frame={particleFrame} />

  <div class="global-flow-stage-grid">
    <button
      class="global-stage weights-stage"
      class:active={frame.activeStage === 'weights'}
      class:complete={frame.stageState.weights === 'complete'}
      data-global-flow-stage="weights"
      aria-label={t('openInitialization')}
      aria-describedby="global-flow-weights-facts"
      title={t('weightAssemblyHint')}
      on:click={() => onNavigate('init')}
    >
      <span class="stage-index">01</span>
      <span class="stage-heading"><strong>{t('weightAssembly')}</strong><small>{t('captured')}</small></span>
      <span class="weight-volume" aria-hidden="true">
        <span data-flow-anchor="weights-source" class="flow-anchor weights-source"></span>
        {#each model.weights.shards as shard, index}
          <i
            data-weight-shard={shard.index}
            style={`--i:${index};--size:${shard.normalizedSize};--item-progress:${frame.shardProgress[index]}`}
          ></i>
        {/each}
      </span>
      <span class="model-memory">
        <span data-flow-anchor="weights-out" class="flow-anchor weights-out"></span>
        <b>{t('modelMemory')}</b>
        <span style={`--tp-bank-count:${model.weights.tensorParallelSize}`}>
          {#each Array(model.weights.tensorParallelSize) as _, rank}<i data-tp-bank={rank}>TP{rank}</i>{/each}
        </span>
      </span>
      <span id="global-flow-weights-facts" class="stage-facts">
        <b>{model.weights.shards.length} {t('checkpointShards')}</b>
        <small>{gibibytes(model.weights.totalCheckpointBytes)} {t('checkpointBytes')}</small>
        <small>{model.weights.quantization.type} · TP={model.weights.tensorParallelSize} · EP={String(model.weights.expertParallel)}</small>
      </span>
    </button>

    <button
      class="global-stage tokens-stage"
      class:active={frame.activeStage === 'tokens'}
      class:complete={frame.stageState.tokens === 'complete'}
      data-global-flow-stage="tokens"
      aria-label={t('openTokens')}
      aria-describedby="global-flow-token-facts"
      title={t('tokenStreamHint')}
      on:click={() => onNavigate('tokens')}
    >
      <span class="stage-index">02</span>
      <span class="stage-heading"><strong>{t('tokens')}</strong><small>{t('tokenTextDerived')}</small></span>
      <span data-flow-anchor="tokens-in" class="flow-anchor tokens-in"></span>
      <span class="prompt-stream mono">“{model.tokens.prompt}”</span>
      <span class="token-capsules">
        {#each model.tokens.items as token, index}
          <span data-token-capsule={token.index} style={`--item-progress:${frame.tokenProgress[index]}`}>
            <b>{token.text}</b><small class="mono">{token.id}</small>
          </span>
        {/each}
      </span>
      <span data-flow-anchor="tokens-out" class="flow-anchor tokens-out"></span>
      <span id="global-flow-token-facts" class="stage-facts"><b>{model.tokens.items.length} {t('promptTokens')}</b><small>{t('tokenId')} · {t('tokenTextLabel')}</small></span>
    </button>

    <button
      class="global-stage embedding-stage-global"
      class:active={frame.activeStage === 'embedding'}
      class:complete={frame.stageState.embedding === 'complete'}
      data-global-flow-stage="embedding"
      aria-label={t('openEmbedding')}
      aria-describedby="global-flow-embedding-facts"
      title={t('embeddingTensorHint')}
      on:click={() => onNavigate('tokens')}
    >
      <span class="stage-index">03</span>
      <span class="stage-heading"><strong>{t('embedding')}</strong><small>{t('summary')}</small></span>
      <span data-flow-anchor="embedding-in" class="flow-anchor embedding-in"></span>
      <span class="embedding-plane-global" aria-hidden="true">
        {#each model.tokens.items as token, row}
          <span style={`--row-progress:${frame.embeddingRowProgress[row]}`}>
            {#each Array(20) as _, column}<i style={`--v:${cellValue(row, column)}`}></i>{/each}
          </span>
        {/each}
      </span>
      <span data-flow-anchor="embedding-out" class="flow-anchor embedding-out"></span>
      <span id="global-flow-embedding-facts" class="stage-facts">
        <b class="mono">{formatShape(model.embedding.shape)}</b>
        <small>{model.embedding.dtype?.replace('torch.', '')} · {t('sampledChannels')}</small>
      </span>
    </button>

    <button
      class="global-stage transformer-stage"
      class:active={frame.activeStage === 'transformer'}
      class:complete={frame.stageState.transformer === 'complete'}
      data-global-flow-stage="transformer"
      aria-label={t('openPrefill')}
      aria-describedby="global-flow-transformer-facts"
      title={t('transformerTunnelHint')}
      on:click={() => onNavigate('prefill')}
    >
      <span class="stage-index">04</span>
      <span class="stage-heading"><strong>{t('transformerTunnel')}</strong><small>{t('structural')}</small></span>
      <span data-flow-anchor="transformer-in" class="flow-anchor transformer-in"></span>
      <span data-flow-anchor="transformer-loop-in" class="flow-anchor transformer-loop-in"></span>
      <span class="transformer-tunnel" aria-label={`${model.transformer.layerCount} ${t('layers')}`}>
        {#each model.transformer.layers as layer}
          <i
            data-layer-plate={layer.index}
            class:full={layer.type === 'full_attention'}
            class:active={frame.activeLayer !== null && layer.index === frame.activeLayer}
            class:traversed={layer.index < frame.traversedLayerCount}
            title={`Layer ${layer.index} · ${layer.type}`}
            style={`--i:${layer.index};--layer-progress:${Math.min(1, Math.max(0, frame.stageProgress.transformer * model.transformer.layerCount - layer.index))}`}
          ><span>{layer.index}</span></i>
        {/each}
      </span>
      <span data-flow-anchor="transformer-out" class="flow-anchor transformer-out"></span>
      <span id="global-flow-transformer-facts" class="stage-facts tunnel-facts">
        <b>{model.transformer.layerCount} {t('layers')}</b>
        <small>{model.transformer.linearCount} {t('linearShort')} · {model.transformer.fullCount} {t('fullShort')}</small>
        <small>{frame.activeLayer === null
          ? `${frame.traversedLayerCount} / ${model.transformer.layerCount} ${t('layersTraversed')}`
          : `${t('currentLayer')} ${frame.activeLayer + 1} / ${model.transformer.layerCount}`}</small>
      </span>
    </button>

    <button
      class="global-stage logits-stage-global"
      class:active={frame.activeStage === 'logits'}
      class:complete={frame.stageState.logits === 'complete'}
      data-global-flow-stage="logits"
      aria-label={t('openDecode')}
      aria-describedby="global-flow-logits-facts"
      title={t('topLogitsHint')}
      on:click={() => onNavigate('decode')}
    >
      <span class="stage-index">05</span>
      <span class="stage-heading"><strong>{t('topLogits')}</strong><small>{t('summary')}</small></span>
      <span data-flow-anchor="logits-in" class="flow-anchor logits-in"></span>
      <span class="logit-field" aria-label={t('topLogits')}>
        {#each visibleCandidates as candidate, index}
          <span data-logit-candidate={candidate.tokenId} class:top={index === 0}>
            <i style={`--h:${candidateHeight(candidate.logit)};--candidate-progress:${frame.stageProgress.logits}`}></i>
            <small class="mono">{candidate.tokenId}</small>
          </span>
        {/each}
      </span>
      <span data-flow-anchor="logits-selected" class="flow-anchor logits-selected"></span>
      <span id="global-flow-logits-facts" class="stage-facts">
        <b class="mono">{formatShape(generationDecision.logitsShape)}</b>
        <small>{t('selectedTopOne')} · {generationDecision.selectedTokenId}</small>
      </span>
    </button>

    <button
      class="global-stage completion-stage-global"
      class:active={frame.activeStage === 'completion'}
      class:complete={frame.stageState.completion === 'complete'}
      data-global-flow-stage="completion"
      aria-label={t('openCompletion')}
      aria-describedby="global-flow-completion-facts"
      title={t('decodeLoopHint')}
      on:click={() => onNavigate('decode')}
    >
      <span class="stage-index">06</span>
      <span class="stage-heading"><strong>{t('completion')}</strong><small>{t('captured')}</small></span>
      <span data-flow-anchor="decode-in" class="flow-anchor decode-in"></span>
      <span class="generation-track">
        {#each model.generation.steps as step, index}
          <span
            data-generation-decision={step.outputIndex}
            class:active={frame.activeGenerationDecision !== null && index === frame.activeGenerationDecision}
            class:complete={index < frame.completedGenerationDecisions}
          >
            <small>{step.sourcePhase === 'prefill' ? t('prefillSelection') : `${t('decodePass')} ${step.logicalStepIndex}`}</small>
            <b class="mono">{step.selectedTokenId}</b>
          </span>
        {/each}
      </span>
      <span
        class="completion-text mono"
        data-text-fidelity={completionIsExact ? 'EXACT' : model.generation.partialTextFidelity}
      >
        {visibleCompletionText}
      </span>
      <span class="kv-loop-legend">
        <span data-flow-anchor="decode-loop-out" class="flow-anchor decode-loop-out"></span>
        <b>{t('kvReuse')}</b><small>{prefillSelectionCount} {t('prefillSelections')} + {model.generation.decodePassCount} {t('decodePasses')}</small>
      </span>
      <span id="global-flow-completion-facts" class="stage-facts"><b>{model.generation.generatedTokenCount} {t('generatedTokens')}</b><small class="mono">[{model.generation.generatedTokenIds.join(', ')}]</small></span>
    </button>
  </div>

  <div class="global-flow-fidelity">
    <span class="fidelity schematic">{t('schematic')}</span>
    <p>{t('globalFlowSchematicNote')}</p>
    <span class="fidelity real">{t('captured')}</span>
    <p>{t('globalFlowExactNote')}</p>
  </div>
</div>
